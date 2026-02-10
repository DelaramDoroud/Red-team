import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '#js/apiError';
import { ChallengeStatus } from '#js/constants';
import { useParams, useRouter } from '#js/router';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { setPeerReviewExit } from '#js/store/slices/ui';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import useChallenge from '#js/useChallenge';
import useRoleGuard from '#js/useRoleGuard';
import useSseEvent from '#js/useSseEvent';
import { useDuration } from '../(context)/DurationContext';
import fetchPeerReviewSummaryRequest from './fetchPeerReviewSummary';
import {
  buildTimeLeft,
  MESSAGE_PEER_REVIEW_WAIT,
  resolveCodingPhaseMessage,
} from './peerReviewHelpers';

export default function usePeerReviewBaseState() {
  const params = useParams();
  const router = useRouter();
  const hasFinalizedRef = useRef(false);
  const dispatch = useAppDispatch();
  const durationContext = useDuration();
  const durationStatus = durationContext?.status;
  const authState = useAppSelector((state) => state.auth);
  const authUser = authState?.user;
  const authLoading = authState?.loading;
  const isLoggedIn = authState?.isLoggedIn;
  const { user: guardUser, isAuthorized } = useRoleGuard({
    allowedRoles: ['student'],
  });
  const effectiveUser = authUser || guardUser;
  const studentId = effectiveUser?.id;
  const isStudentUser = effectiveUser?.role === 'student';
  const challengeId = params?.challengeId;
  const {
    getStudentPeerReviewAssignments,
    getPeerReviewSummary,
    submitPeerReviewVote,
    getStudentVotes,
    finalizePeerReview,
    exitPeerReview,
    getChallengeResults,
  } = useChallenge();
  const redirectOnError = useApiErrorRedirect();

  const [assignments, setAssignments] = useState([]);
  const [challengeInfo, setChallengeInfo] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [voteMap, setVoteMap] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [finalSummary, setFinalSummary] = useState(null);
  const [submissionSummary, setSubmissionSummary] = useState(null);
  const [finalization, setFinalization] = useState(null);
  const [finalizationError, setFinalizationError] = useState(null);
  const [isFinalizationPending, setIsFinalizationPending] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [hasExited, setHasExited] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const isTestEnv = process.env.NODE_ENV === 'test';

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const redirectTimeoutRef = useRef(null);
  const voteAutosaveTimeoutRef = useRef({});
  const theme = useAppSelector((state) => state.ui.theme);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const isVotingDisabled =
    hasExited ||
    isExiting ||
    timeLeft === 0 ||
    challengeInfo?.status !== ChallengeStatus.STARTED_PEER_REVIEW;

  const loadFinalization = useCallback(async () => {
    if (!challengeId || !studentId) return;
    const res = await getChallengeResults(challengeId, studentId);
    if (res?.success === false) {
      if (redirectOnError(res)) return;
      setFinalizationError(
        getApiErrorMessage(res, 'Unable to load submission summary.')
      );
      setFinalization(null);
      setSubmissionSummary(null);
      setIsFinalizationPending(false);
      return;
    }
    const payload = res?.data || res;
    const finalizationInfo = payload?.finalization || null;
    const resultsReady = finalizationInfo?.resultsReady === true;
    setFinalization(finalizationInfo);
    setSubmissionSummary(payload?.submissionSummary || null);
    setIsFinalizationPending(!resultsReady);
    setFinalizationError(null);
  }, [challengeId, studentId, getChallengeResults, redirectOnError]);

  const fetchPeerReviewSummary = useCallback(
    () =>
      fetchPeerReviewSummaryRequest({
        challengeId,
        studentId,
        getPeerReviewSummary,
      }),
    [challengeId, studentId, getPeerReviewSummary]
  );

  useEffect(() => {
    if (!challengeId || !studentId || !isStudentUser) return undefined;
    let cancelled = false;

    const loadData = async () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      setLoading(true);
      setError(null);
      try {
        const [assignmentsRes, votesRes] = await Promise.all([
          getStudentPeerReviewAssignments(challengeId, studentId),
          getStudentVotes(challengeId),
        ]);

        if (cancelled) return;

        if (assignmentsRes?.success === false) {
          if (redirectOnError(assignmentsRes)) return;
          setError(
            getApiErrorMessage(assignmentsRes, 'Unable to load peer review.')
          );
          setAssignments([]);
          return;
        }

        const nextAssignments = Array.isArray(assignmentsRes?.assignments)
          ? assignmentsRes.assignments
          : [];
        setAssignments(nextAssignments);
        setChallengeInfo(assignmentsRes?.challenge || null);

        const initialVoteMap = {};
        if (votesRes?.success && Array.isArray(votesRes.votes)) {
          votesRes.votes.forEach((vote) => {
            initialVoteMap[vote.submissionId] = {
              type: vote.vote,
              input: vote.testCaseInput || '',
              output: vote.expectedOutput || '',
            };
          });
        }
        setVoteMap(initialVoteMap);

        const challengeStatus = assignmentsRes?.challenge?.status;
        if (nextAssignments.length > 0) {
          setSelectedIndex(0);
          const allAssignmentsHaveVotes = nextAssignments.every((assignment) =>
            Boolean(initialVoteMap[assignment.submissionId]?.type)
          );

          if (
            allAssignmentsHaveVotes &&
            challengeStatus === ChallengeStatus.STARTED_PEER_REVIEW
          ) {
            dispatch(
              setPeerReviewExit({
                userId: studentId,
                challengeId: String(challengeId),
                value: true,
              })
            );
            setHasExited(true);
            toast.success('Thanks for your participation.');
            redirectTimeoutRef.current = setTimeout(() => {
              redirectTimeoutRef.current = null;
              router.push(`/student/challenges/${challengeId}/result`);
            }, 1500);
          }
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load data.');
          setAssignments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, [
    challengeId,
    dispatch,
    studentId,
    isStudentUser,
    durationStatus,
    getStudentPeerReviewAssignments,
    getStudentVotes,
    redirectOnError,
    router,
  ]);

  const peerReviewStart = challengeInfo?.startPeerReviewDateTime;
  const peerReviewDuration = challengeInfo?.durationPeerReview;
  const peerReviewEnd = challengeInfo?.endPeerReviewDateTime;

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }, []);

  useEffect(() => {
    if (!peerReviewStart || !peerReviewDuration) return undefined;
    const tick = () => {
      setTimeLeft(
        buildTimeLeft(peerReviewStart, peerReviewDuration, peerReviewEnd)
      );
    };

    tick();
    if (isTestEnv) return undefined;
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [peerReviewStart, peerReviewDuration, peerReviewEnd, isTestEnv]);

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme);
    }
  }, [monacoTheme]);

  useEffect(() => {
    if (timeLeft === 0 && challengeId && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;

      finalizePeerReview(challengeId)
        .then(async () => {
          const result = await fetchPeerReviewSummary();
          if (result.success) {
            setFinalSummary(result.summary);
            setShowSummaryDialog(true);
          } else {
            toast.error(result.error);
          }
        })
        .catch(() => {
          setError('Unable to finalize peer review.');
        });
    }
  }, [timeLeft, challengeId, finalizePeerReview, fetchPeerReviewSummary]);

  const effectiveStatus = durationStatus || challengeInfo?.status;
  const isPeerReviewActive =
    effectiveStatus === ChallengeStatus.STARTED_PEER_REVIEW ||
    effectiveStatus === ChallengeStatus.ENDED_PEER_REVIEW;
  const isCodingPhaseComplete =
    effectiveStatus === ChallengeStatus.ENDED_CODING_PHASE;

  useEffect(() => {
    if (!challengeId || !studentId || !isStudentUser) return undefined;

    if (!isCodingPhaseComplete) {
      setSubmissionSummary(null);
      setFinalization(null);
      setFinalizationError(null);
      setIsFinalizationPending(false);
      return undefined;
    }

    setIsFinalizationPending(true);
    loadFinalization();
    return undefined;
  }, [
    challengeId,
    studentId,
    isStudentUser,
    isCodingPhaseComplete,
    loadFinalization,
  ]);

  const handleFinalizationEvent = useCallback(
    (payload) => {
      if (!challengeId || !studentId || !isStudentUser) return;
      if (!isCodingPhaseComplete) return;
      const payloadId = Number(payload?.challengeId);
      if (!payloadId || payloadId === Number(challengeId)) {
        loadFinalization();
      }
    },
    [
      challengeId,
      studentId,
      isStudentUser,
      isCodingPhaseComplete,
      loadFinalization,
    ]
  );

  useSseEvent('finalization-updated', handleFinalizationEvent);
  useSseEvent('challenge-updated', handleFinalizationEvent);

  const selectedAssignment = assignments[selectedIndex] || null;
  const selectedSubmissionId = selectedAssignment?.submissionId;
  const currentVoteEntry = selectedSubmissionId
    ? voteMap[selectedSubmissionId]
    : null;
  const hasExplicitVote = Boolean(currentVoteEntry?.type);
  const currentVote = hasExplicitVote ? currentVoteEntry.type : 'abstain';

  const completedCount = useMemo(
    () =>
      assignments.filter((assignment) => {
        const vote = voteMap[assignment.submissionId];
        if (!vote?.type) return false;
        if (vote.type === 'incorrect') {
          return !validationErrors[assignment.submissionId];
        }
        return true;
      }).length,
    [assignments, voteMap, validationErrors]
  );

  const progressValue = assignments.length
    ? Math.round((completedCount / assignments.length) * 100)
    : 0;
  const isFirst = selectedIndex <= 0;
  const isLast =
    assignments.length === 0 || selectedIndex >= assignments.length - 1;
  const codingPhaseMessage = resolveCodingPhaseMessage(submissionSummary);

  return {
    challengeId,
    studentId,
    authLoading,
    isLoggedIn,
    isAuthorized,
    isStudentUser,
    assignments,
    selectedIndex,
    setSelectedIndex,
    selectedAssignment,
    selectedSubmissionId,
    voteMap,
    setVoteMap,
    validationErrors,
    setValidationErrors,
    showSummaryDialog,
    setShowSummaryDialog,
    error,
    loading,
    timeLeft,
    finalSummary,
    setFinalSummary,
    submissionSummary,
    finalization,
    finalizationError,
    isFinalizationPending,
    exitDialogOpen,
    setExitDialogOpen,
    hasExited,
    setHasExited,
    isExiting,
    setIsExiting,
    theme,
    monacoTheme,
    handleEditorMount,
    redirectTimeoutRef,
    voteAutosaveTimeoutRef,
    challengeInfo,
    isVotingDisabled,
    getPeerReviewSummary,
    submitPeerReviewVote,
    exitPeerReview,
    dispatch,
    router,
    fetchPeerReviewSummary,
    effectiveStatus,
    isPeerReviewActive,
    isCodingPhaseComplete,
    completedCount,
    progressValue,
    hasExplicitVote,
    currentVote,
    isFirst,
    isLast,
    codingPhaseMessage,
    messagePeerReviewWait: MESSAGE_PEER_REVIEW_WAIT,
  };
}
