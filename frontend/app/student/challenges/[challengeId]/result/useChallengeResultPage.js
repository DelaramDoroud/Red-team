import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '#js/apiError';
import { ChallengeStatus } from '#js/constants';
import { useParams } from '#js/router';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { markBadgeSeen } from '#js/store/slices/auth';
import {
  setCodeReviewVotesVisibility,
  setSolutionFeedbackVisibility,
} from '#js/store/slices/ui';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import useChallenge from '#js/useChallenge';
import useTitle from '#js/useTitle';
import { useDuration } from '../(context)/DurationContext';

export default function useChallengeResultPage() {
  const params = useParams();
  const dispatch = useAppDispatch();
  const durationContext = useDuration();
  const challengeStatus = durationContext?.status;
  const hasChallengeStatus =
    challengeStatus !== null && challengeStatus !== undefined;
  const isChallengeEnded =
    challengeStatus === ChallengeStatus.ENDED_PEER_REVIEW;
  const canLoadResults =
    !durationContext || (hasChallengeStatus && isChallengeEnded);
  const {
    user,
    loading: authLoading,
    isLoggedIn,
  } = useAppSelector((state) => state.auth);
  const solutionFeedbackVisibility = useAppSelector(
    (state) => state.ui.solutionFeedbackVisibility
  );
  const codeReviewVotesVisibility = useAppSelector(
    (state) => state.ui.codeReviewVotesVisibility
  );
  const badgeSeen = useAppSelector((state) => state.auth.badgeSeen);
  const studentId = user?.id;
  const challengeId = params?.challengeId;
  const solutionFeedbackKey = challengeId ? String(challengeId) : null;
  const codeReviewVotesKey = challengeId ? String(challengeId) : null;
  const isSolutionFeedbackOpen = Boolean(
    studentId &&
      solutionFeedbackKey &&
      solutionFeedbackVisibility?.[studentId]?.[solutionFeedbackKey]
  );
  const isCodeReviewVotesOpen = Boolean(
    studentId &&
      codeReviewVotesKey &&
      codeReviewVotesVisibility?.[studentId]?.[codeReviewVotesKey]
  );
  const { getChallengeResults, getStudentVotes } = useChallenge();
  const redirectOnError = useApiErrorRedirect();
  const { evaluateTitle } = useTitle();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [finalization, setFinalization] = useState(null);
  const [isFinalizationPending, setIsFinalizationPending] = useState(false);
  const [awaitingChallengeEnd, setAwaitingChallengeEnd] = useState(false);
  const [reviewVotes, setReviewVotes] = useState(null);
  const [reviewVotesLoading, setReviewVotesLoading] = useState(false);
  const [reviewVotesError, setReviewVotesError] = useState('');
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [activeBadge, setActiveBadge] = useState(null);
  const [showBadge, setShowBadge] = useState(false);
  const [newTitle, setNewTitle] = useState(null);

  const loadResults = useCallback(async () => {
    if (!challengeId || !studentId || !isLoggedIn) return;
    setAwaitingChallengeEnd(false);
    setLoading(true);
    setError(null);
    try {
      const res = await getChallengeResults(challengeId, studentId);
      if (res?.success === false) {
        const apiMessage = res?.error?.message || getApiErrorMessage(res, null);
        if (apiMessage?.toLowerCase().includes('has not ended yet')) {
          setAwaitingChallengeEnd(true);
          setLoading(false);
          setError(null);
          return;
        }
        if (redirectOnError(res)) return;
        setError(getApiErrorMessage(res, 'Unable to load results.'));
        setResultData(null);
        setFinalization(null);
        return;
      }

      const payload = res?.data || res;
      if (payload?.badges?.newlyUnlocked?.length > 0) {
        const unseenBadges = payload.badges.newlyUnlocked.filter(
          (badge) => !badgeSeen?.[studentId]?.[badge.id]
        );
        if (unseenBadges.length > 0) {
          setBadgeQueue((prev) => {
            const existingIds = new Set(prev.map((badge) => badge.id));
            const toAdd = unseenBadges.filter(
              (badge) => !existingIds.has(badge.id)
            );
            if (toAdd.length === 0) return prev;
            return [...prev, ...toAdd];
          });
        }
      }

      const finalizationInfo = payload?.finalization || null;
      const scoringStatus = payload?.challenge?.scoringStatus;
      const isComputing = scoringStatus === 'computing';
      const areSubmissionsPending = finalizationInfo?.resultsReady === false;
      const shouldShowSpinner = isComputing || areSubmissionsPending;

      setFinalization(finalizationInfo);
      setResultData(payload);

      if (shouldShowSpinner) {
        setIsFinalizationPending(true);
        return;
      }
      setIsFinalizationPending(false);
    } catch {
      setError('Unable to load results.');
    } finally {
      setLoading(false);
    }
  }, [
    challengeId,
    studentId,
    isLoggedIn,
    getChallengeResults,
    redirectOnError,
    badgeSeen,
  ]);

  const handleBadgeClose = () => {
    if (activeBadge && studentId) {
      dispatch(markBadgeSeen({ studentId, badgeId: activeBadge.id }));
    }
    setBadgeQueue((prevQueue) => {
      const [, ...rest] = prevQueue;
      if (rest.length > 0) {
        setActiveBadge(rest[0]);
      } else {
        setActiveBadge(null);
        setShowBadge(false);
      }
      return rest;
    });
  };

  const loadReviewVotes = useCallback(async () => {
    if (!challengeId || !studentId || !isLoggedIn) return;
    setReviewVotesError('');
    setReviewVotesLoading(true);
    try {
      const res = await getStudentVotes(challengeId);
      if (res?.success) {
        setReviewVotes(Array.isArray(res.votes) ? res.votes : []);
      } else {
        setReviewVotes([]);
        setReviewVotesError(
          getApiErrorMessage(res, 'Unable to load peer review votes.')
        );
      }
    } catch (requestError) {
      setReviewVotes([]);
      setReviewVotesError(
        getApiErrorMessage(requestError, 'Unable to load peer review votes.')
      );
    } finally {
      setReviewVotesLoading(false);
    }
  }, [challengeId, studentId, isLoggedIn, getStudentVotes]);

  useEffect(() => {
    let cancelled = false;
    if (!challengeId || !studentId || !isLoggedIn) return undefined;
    const run = async () => {
      if (cancelled) return;
      await loadResults();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    challengeId,
    durationContext,
    hasChallengeStatus,
    isChallengeEnded,
    isLoggedIn,
    loadResults,
    studentId,
  ]);

  useEffect(() => {
    if (!isFinalizationPending || !canLoadResults) return undefined;
    const timeoutId = setTimeout(() => {
      loadResults();
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [canLoadResults, isFinalizationPending, loadResults]);

  useEffect(() => {
    if (!resultData?.challenge) return;
    const peerReviewEndValue = resultData.challenge.endPeerReviewDateTime;
    const peerReviewEnded =
      peerReviewEndValue &&
      new Date(peerReviewEndValue).getTime() <= Date.now() &&
      resultData.challenge.status === ChallengeStatus.ENDED_PEER_REVIEW;

    if (!peerReviewEnded || !isCodeReviewVotesOpen) return;
    if (reviewVotes !== null || reviewVotesLoading) return;
    loadReviewVotes();
  }, [
    isCodeReviewVotesOpen,
    loadReviewVotes,
    resultData,
    reviewVotes,
    reviewVotesLoading,
  ]);

  const hasEvaluatedRef = useRef(false);

  useEffect(() => {
    hasEvaluatedRef.current = false;
  }, [challengeId]);

  useEffect(() => {
    const resultReady =
      !loading &&
      !awaitingChallengeEnd &&
      !isFinalizationPending &&
      Boolean(resultData) &&
      Boolean(finalization);

    if (!resultReady || hasEvaluatedRef.current) return;
    hasEvaluatedRef.current = true;

    const checkTitleEligibility = async () => {
      try {
        const res = await evaluateTitle();
        if (res?.eligible && res?.titleChanged && res?.title) {
          setNewTitle(res.title);
        }
      } catch {
        // Title popup errors should not block result rendering.
      }
    };

    checkTitleEligibility();
  }, [
    loading,
    awaitingChallengeEnd,
    resultData,
    finalization,
    isFinalizationPending,
    evaluateTitle,
  ]);

  useEffect(() => {
    if (badgeQueue.length > 0 && !activeBadge) {
      setActiveBadge(badgeQueue[0]);
      setShowBadge(true);
    }
  }, [badgeQueue, activeBadge]);

  const isWaitingForResults =
    awaitingChallengeEnd ||
    (durationContext && hasChallengeStatus && !isChallengeEnded);

  const challenge = resultData?.challenge || null;
  const matchSetting = resultData?.matchSetting || null;
  const scoreBreakdown = resultData?.scoreBreakdown || null;
  const studentSubmission = resultData?.studentSubmission || null;
  const publicResults = Array.isArray(studentSubmission?.publicTestResults)
    ? studentSubmission.publicTestResults
    : [];
  const privateResults = Array.isArray(studentSubmission?.privateTestResults)
    ? studentSubmission.privateTestResults
    : [];
  const peerReviewEndTimestamp = challenge?.endPeerReviewDateTime
    ? new Date(challenge.endPeerReviewDateTime).getTime()
    : null;
  const hasPeerReviewEnded =
    peerReviewEndTimestamp !== null
      ? peerReviewEndTimestamp <= Date.now()
      : false;
  const isFullyEnded =
    challenge?.status === ChallengeStatus.ENDED_PEER_REVIEW &&
    hasPeerReviewEnded;
  const peerReviewTests =
    isFullyEnded && Array.isArray(resultData?.peerReviewTests)
      ? resultData.peerReviewTests
      : [];
  const otherSubmissions =
    isFullyEnded && Array.isArray(resultData?.otherSubmissions)
      ? resultData.otherSubmissions
      : [];
  const hasPeerReviewTests = peerReviewTests.some(
    (review) => Array.isArray(review.tests) && review.tests.length > 0
  );
  const feedbackSectionId = solutionFeedbackKey
    ? `solution-feedback-${solutionFeedbackKey}`
    : 'solution-feedback';
  const peerReviewSectionId = codeReviewVotesKey
    ? `peer-review-votes-${codeReviewVotesKey}`
    : 'peer-review-votes';

  const handleToggleSolutionFeedback = () => {
    if (!studentId || !solutionFeedbackKey) return;
    dispatch(
      setSolutionFeedbackVisibility({
        userId: studentId,
        challengeId: solutionFeedbackKey,
        value: !isSolutionFeedbackOpen,
      })
    );
  };

  const handleTogglePeerReviewVotes = () => {
    if (!studentId || !codeReviewVotesKey) return;
    dispatch(
      setCodeReviewVotesVisibility({
        userId: studentId,
        challengeId: codeReviewVotesKey,
        value: !isCodeReviewVotesOpen,
      })
    );
  };

  const voteItems = (Array.isArray(reviewVotes) ? reviewVotes : []).map(
    (voteItem, index) => {
      const revieweeName =
        voteItem.reviewedSubmission?.student?.username || 'Submission';
      const submissionLabel = voteItem.reviewedSubmission?.problemTitle
        ? `${voteItem.reviewedSubmission.problemTitle} • ${revieweeName}`
        : `Solution ${index + 1} • ${revieweeName}`;
      const expectedEvaluation = voteItem.expectedEvaluation || 'unknown';
      return {
        id: voteItem.assignmentId || voteItem.submissionId || `vote-${index}`,
        submissionLabel,
        vote: voteItem.vote,
        expectedEvaluation,
        isCorrect: Boolean(voteItem.isCorrect),
        testCaseInput: voteItem.testCaseInput,
        expectedOutput: voteItem.expectedOutput,
        referenceOutput: voteItem.referenceOutput,
        actualOutput: voteItem.actualOutput,
        isExpectedOutputCorrect: voteItem.isExpectedOutputCorrect,
        isVoteCorrect: voteItem.isVoteCorrect,
        evaluationStatus: voteItem.evaluationStatus,
      };
    }
  );

  return {
    authLoading,
    isLoggedIn,
    studentId,
    durationContext,
    hasChallengeStatus,
    loading,
    error,
    resultData,
    isFinalizationPending,
    finalization,
    isWaitingForResults,
    challenge,
    matchSetting,
    scoreBreakdown,
    studentSubmission,
    publicResults,
    privateResults,
    isFullyEnded,
    peerReviewTests,
    otherSubmissions,
    hasPeerReviewTests,
    feedbackSectionId,
    peerReviewSectionId,
    isSolutionFeedbackOpen,
    isCodeReviewVotesOpen,
    handleToggleSolutionFeedback,
    handleTogglePeerReviewVotes,
    voteItems,
    reviewVotesLoading,
    reviewVotesError,
    showBadge,
    activeBadge,
    handleBadgeClose,
    newTitle,
    setNewTitle,
  };
}
