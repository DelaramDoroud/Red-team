import { useEffect } from 'react';
import { getApiErrorMessage } from '#js/apiError';

const resetMatchRuntimeState = ({
  clearFinalizationTimer,
  resetDraftEditorState,
  resetSessionRefs,
  setCanSubmit,
  setCustomRunOrder,
  setCustomRunResult,
  setCustomTestResults,
  setCustomTests,
  setError,
  setIsCompiled,
  setIsCustomRunning,
  setIsFinalizationPending,
  setIsRunning,
  setIsSubmitting,
  setIsSubmittingActive,
  setIsTimeUp,
  setMatchData,
  setMatchId,
  setMessage,
  setRunResult,
  setTestResults,
}) => {
  clearFinalizationTimer();
  setMessage(null);
  setError(null);
  setRunResult(null);
  setIsRunning(false);
  setIsSubmitting(false);
  setIsSubmittingActive(false);
  setTestResults([]);
  setCustomTests([]);
  setCustomRunResult(null);
  setCustomTestResults([]);
  setCustomRunOrder([]);
  setIsCustomRunning(false);
  setCanSubmit(false);
  setIsCompiled(null);
  setIsTimeUp(false);
  setIsFinalizationPending(false);
  setMatchData(null);
  setMatchId(null);
  resetSessionRefs();
  resetDraftEditorState();
};

export default function useMatchLifecycle({
  challengeId,
  studentId,
  clearFinalizationTimer,
  getStudentAssignedMatch,
  getStudentAssignedMatchSetting,
  hasDurationContext,
  isCodingPhaseActive,
  isStatusKnown,
  isWaitingForStart,
  redirectOnError,
  resetDraftEditorState,
  resetSessionRefs,
  setCanSubmit,
  setCustomRunOrder,
  setCustomRunResult,
  setCustomTestResults,
  setCustomTests,
  setError,
  setIsCompiled,
  setIsCustomRunning,
  setIsFinalizationPending,
  setIsRunning,
  setIsSubmitting,
  setIsSubmittingActive,
  setIsTimeUp,
  setLoading,
  setMatchData,
  setMatchId,
  setMessage,
  setRunResult,
  setTestResults,
}) {
  useEffect(() => {
    if (!challengeId || !studentId) return () => {};

    const resetAll = () => {
      resetMatchRuntimeState({
        clearFinalizationTimer,
        resetDraftEditorState,
        resetSessionRefs,
        setCanSubmit,
        setCustomRunOrder,
        setCustomRunResult,
        setCustomTestResults,
        setCustomTests,
        setError,
        setIsCompiled,
        setIsCustomRunning,
        setIsFinalizationPending,
        setIsRunning,
        setIsSubmitting,
        setIsSubmittingActive,
        setIsTimeUp,
        setMatchData,
        setMatchId,
        setMessage,
        setRunResult,
        setTestResults,
      });
    };

    if (hasDurationContext && !isCodingPhaseActive) {
      if (!isStatusKnown) {
        setLoading(true);
        return () => {};
      }

      setLoading(false);
      if (isWaitingForStart) {
        resetAll();
      }
      return () => {};
    }

    let cancelled = false;

    async function fetchMatch() {
      resetAll();
      setLoading(true);

      try {
        const res = await getStudentAssignedMatchSetting(
          challengeId,
          studentId
        );
        if (cancelled) return;

        if (res?.success === false) {
          if (redirectOnError(res)) return;
          setError({
            message: getApiErrorMessage(
              res,
              'Unable to load your match for this challenge.'
            ),
            code: res.code,
          });
          return;
        }

        const { data } = res;
        setMatchData(data);

        try {
          const matchRes = await getStudentAssignedMatch(
            challengeId,
            studentId
          );
          if (matchRes?.success && matchRes.data?.id) {
            setMatchId(matchRes.data.id);
          } else {
            setMatchId(null);
          }
        } catch {
          setMatchId(null);
        }
      } catch {
        if (!cancelled) {
          setError({
            message: 'Network error while loading your match. Try again.',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatch();

    return () => {
      cancelled = true;
    };
  }, [
    challengeId,
    clearFinalizationTimer,
    getStudentAssignedMatch,
    getStudentAssignedMatchSetting,
    hasDurationContext,
    isCodingPhaseActive,
    isStatusKnown,
    isWaitingForStart,
    redirectOnError,
    resetDraftEditorState,
    resetSessionRefs,
    setCanSubmit,
    setCustomRunOrder,
    setCustomRunResult,
    setCustomTestResults,
    setCustomTests,
    setError,
    setIsCompiled,
    setIsCustomRunning,
    setIsFinalizationPending,
    setIsRunning,
    setIsSubmitting,
    setIsSubmittingActive,
    setIsTimeUp,
    setLoading,
    setMatchData,
    setMatchId,
    setMessage,
    setRunResult,
    setTestResults,
    studentId,
  ]);
}
