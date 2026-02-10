'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '#js/apiError';
import { ChallengeStatus } from '#js/constants';
import { useParams, useRouter } from '#js/router';
import { useAppSelector } from '#js/store/hooks';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import useChallenge from '#js/useChallenge';
import useSseEvent from '#js/useSseEvent';
import useChallengeDetailAdminActions from './useChallengeDetailAdminActions';
import useChallengeDetailDerived from './useChallengeDetailDerived';
import useChallengeDetailWorkflowActions from './useChallengeDetailWorkflowActions';

const PEER_REVIEW_STARTED_MESSAGE = 'Peer review started successfully.';

export default function useChallengeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const {
    getChallengeMatches,
    assignChallenge,
    getChallengeParticipants,
    startChallenge,
    endCodingPhase,
    assignPeerReviews,
    updateExpectedReviews,
    startPeerReview,
    endPeerReview,
    unpublishChallenge,
    endChallenge,
    getTeacherChallengeResults,
    addMatchSettingPrivateTest,
  } = useChallenge();

  const challengeId = params?.id;
  const redirectOnError = useApiErrorRedirect();
  const authUser = useAppSelector((state) => state.auth.user);
  const isTeacher = authUser?.role === 'teacher';

  const [challenge, setChallenge] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigningReviews, setAssigningReviews] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingPeerReview, setStartingPeerReview] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [expectedReviews, setExpectedReviews] = useState('');
  const [expectedReviewsError, setExpectedReviewsError] = useState('');
  const [expectedReviewsSaved, setExpectedReviewsSaved] = useState('');
  const [savingExpectedReviews, setSavingExpectedReviews] = useState(false);
  const [peerReviewMessages, setPeerReviewMessages] = useState([]);
  const [phaseNow, setPhaseNow] = useState(Date.now());
  const [dangerAction, setDangerAction] = useState(null);
  const [dangerPending, setDangerPending] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [teacherResultsOpen, setTeacherResultsOpen] = useState(false);
  const [teacherResultsLoading, setTeacherResultsLoading] = useState(false);
  const [teacherResultsError, setTeacherResultsError] = useState('');
  const [teacherResults, setTeacherResults] = useState(null);
  const [privateTestActions, setPrivateTestActions] = useState({});

  const getChallengeParticipantsRef = useRef(getChallengeParticipants);

  useEffect(() => {
    getChallengeParticipantsRef.current = getChallengeParticipants;
  }, [getChallengeParticipants]);

  const load = useCallback(async () => {
    if (!challengeId) return;
    setError(null);
    setLoading(true);

    try {
      const [matchesRes, participantsRes] = await Promise.all([
        getChallengeMatches(challengeId),
        getChallengeParticipants(challengeId),
      ]);

      if (matchesRes?.success) {
        setChallenge(matchesRes.challenge);
        setAssignments(matchesRes.assignments || []);
        setExpectedReviews(
          matchesRes.challenge?.allowedNumberOfReview != null
            ? String(matchesRes.challenge.allowedNumberOfReview)
            : ''
        );
        setExpectedReviewsSaved('');
      } else {
        if (redirectOnError(matchesRes)) return;
        setError(getApiErrorMessage(matchesRes, 'Unable to load matches'));
        setAssignments([]);
      }

      if (participantsRes?.success && Array.isArray(participantsRes.data)) {
        setStudentCount(participantsRes.data.length);
        setParticipants(participantsRes.data);
      } else {
        setStudentCount(0);
        setParticipants([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load matches'));
      setAssignments([]);
      setStudentCount(0);
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [
    challengeId,
    getChallengeMatches,
    getChallengeParticipants,
    redirectOnError,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const loadTeacherResults = useCallback(async () => {
    if (!challengeId) return;
    setTeacherResultsError('');
    setTeacherResultsLoading(true);
    try {
      const res = await getTeacherChallengeResults(challengeId, true);
      if (res?.success) {
        setTeacherResults(res?.data || null);
      } else {
        setTeacherResults(null);
        setTeacherResultsError(
          getApiErrorMessage(res, 'Unable to load student results.')
        );
      }
    } catch (err) {
      setTeacherResults(null);
      setTeacherResultsError(
        getApiErrorMessage(err, 'Unable to load student results.')
      );
    } finally {
      setTeacherResultsLoading(false);
    }
  }, [challengeId, getTeacherChallengeResults]);

  const handleToggleTeacherResults = useCallback(() => {
    const nextOpen = !teacherResultsOpen;
    setTeacherResultsOpen(nextOpen);
    if (nextOpen && !teacherResults && !teacherResultsLoading) {
      loadTeacherResults();
    }
  }, [
    loadTeacherResults,
    teacherResults,
    teacherResultsLoading,
    teacherResultsOpen,
  ]);

  const handleParticipantJoined = useCallback(
    async (payload) => {
      const payloadId = Number(payload?.challengeId);
      if (!payloadId || payloadId !== Number(challengeId)) return;

      if (typeof payload?.count === 'number') {
        setStudentCount(payload.count);
      }

      try {
        const res = await getChallengeParticipantsRef.current(payloadId);
        if (res?.success && Array.isArray(res.data)) {
          setStudentCount(res.data.length);
          setParticipants(res.data);
        }
      } catch {
        // Keep the last known list if refresh fails.
      }
    },
    [challengeId]
  );

  const handleChallengeUpdated = useCallback(
    (payload) => {
      const payloadId = Number(payload?.challengeId);
      if (!payloadId || payloadId === Number(challengeId)) {
        load();
      }
    },
    [challengeId, load]
  );

  useSseEvent('challenge-participant-joined', handleParticipantJoined);
  useSseEvent('challenge-updated', handleChallengeUpdated);
  useSseEvent('finalization-updated', handleChallengeUpdated);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    const id = setInterval(() => {
      setPhaseNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!challenge?.status) return;
    if (challenge.status === ChallengeStatus.ENDED_PEER_REVIEW) {
      setPeerReviewMessages([]);
      return;
    }
    if (challenge.status !== ChallengeStatus.STARTED_PEER_REVIEW) {
      setPeerReviewMessages((prev) =>
        prev.filter((message) => message.text !== PEER_REVIEW_STARTED_MESSAGE)
      );
    }
  }, [challenge?.status]);

  const {
    handleAddPrivateTest,
    handleAssign,
    handleStart,
    handleAssignReviews,
    handleStartPeerReview,
    handleSaveExpectedReviews,
  } = useChallengeDetailWorkflowActions({
    addMatchSettingPrivateTest,
    assignChallenge,
    assignPeerReviews,
    assignments,
    challenge,
    challengeId,
    expectedReviews,
    expectedReviewsLocked:
      challenge?.status === ChallengeStatus.STARTED_PEER_REVIEW ||
      challenge?.status === ChallengeStatus.ENDED_PEER_REVIEW,
    load,
    privateTestActions,
    setAssigning,
    setAssigningReviews,
    setError,
    setExpectedReviews,
    setExpectedReviewsError,
    setExpectedReviewsSaved,
    setPeerReviewMessages,
    setPrivateTestActions,
    setSavingExpectedReviews,
    setStarting,
    setStartingPeerReview,
    startChallenge,
    startPeerReview,
    studentCount,
    updateExpectedReviews,
  });

  const {
    activeDangerAction,
    handleConfirmDangerAction,
    handleCancelDangerAction,
    handleEditClick,
    handleEditCancel,
    handleConfirmUnpublish,
  } = useChallengeDetailAdminActions({
    challenge,
    challengeId,
    dangerAction,
    dangerPending,
    endChallenge,
    endCodingPhase,
    endPeerReview,
    load,
    router,
    setDangerAction,
    setDangerPending,
    setEditDialogOpen,
    setEditPending,
    setError,
    unpublishChallenge,
  });

  const derived = useChallengeDetailDerived({
    assignments,
    challenge,
    editPending,
    error,
    expectedReviews,
    expectedReviewsError,
    expectedReviewsSaved,
    handleSaveExpectedReviews,
    isTeacher,
    loading,
    phaseNow,
    savingExpectedReviews,
    setExpectedReviews,
    setExpectedReviewsError,
    setExpectedReviewsSaved,
    studentCount,
    participants,
    teacherResults,
  });

  return {
    challengeId,
    isTeacher,
    challenge,
    assignments,
    participants,
    studentCount,
    error,
    loading,
    assigning,
    assigningReviews,
    starting,
    startingPeerReview,
    expectedReviews,
    expectedReviewsError,
    expectedReviewsSaved,
    savingExpectedReviews,
    setExpectedReviews,
    setExpectedReviewsError,
    setExpectedReviewsSaved,
    peerReviewMessages,
    dangerPending,
    setDangerAction,
    activeDangerAction,
    editDialogOpen,
    editPending,
    teacherResultsOpen,
    teacherResultsLoading,
    teacherResultsError,
    privateTestActions,
    handleAddPrivateTest,
    handleAssign,
    handleStart,
    handleAssignReviews,
    handleStartPeerReview,
    handleConfirmDangerAction,
    handleCancelDangerAction,
    handleEditClick,
    handleConfirmUnpublish,
    handleEditCancel,
    load,
    handleToggleTeacherResults,
    ...derived,
  };
}
