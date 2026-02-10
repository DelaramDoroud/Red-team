import { useCallback, useEffect } from 'react';
import {
  addCustomTestCase,
  removeCustomTestCase,
  runCodeAction,
  runCustomTestsAction,
  updateCustomTestCase,
} from './matchRunActions';
import {
  finalizeOnTimerEnd,
  submitManualSolution,
} from './matchSubmissionActions';

export default function useMatchActions({
  assembledCode,
  canSubmit,
  challengeId,
  challengeSignature,
  dispatch,
  clearFinalizationTimer,
  getLastSubmission,
  getStudentAssignedMatch,
  getLastSuccessCode,
  getLastManualSubmission,
  imports,
  isAutoSubmitTriggered,
  isChallengeFinished,
  isCodingPhaseOver,
  isSubmitting,
  isTimeUp,
  markAutoSubmitTriggered,
  matchData,
  customTests,
  runCode,
  runCustomTests,
  setLastManualSubmission,
  setLastSuccessCode,
  setCanSubmit,
  setCustomRunOrder,
  setCustomRunResult,
  setCustomTestResults,
  setCustomTests,
  setError,
  setIsChallengeFinished,
  setIsCompiled,
  setIsCustomRunning,
  setIsFinalizationPending,
  setIsRunning,
  setIsSubmitting,
  setIsSubmittingActive,
  setIsTimeUp,
  setMatchId,
  setMessage,
  setRunResult,
  setTestResults,
  storageKeyBase,
  studentCode,
  studentId,
  submitSubmission,
  storeLastCompiled,
}) {
  const handleRun = useCallback(
    () =>
      runCodeAction({
        assembledCode,
        challengeId,
        isTimeUp,
        matchData,
        runCode,
        setCanSubmit,
        setError,
        setIsCompiled,
        setIsRunning,
        setIsSubmittingActive,
        setMessage,
        setRunResult,
        setTestResults,
        storeLastCompiled,
      }),
    [
      assembledCode,
      challengeId,
      isTimeUp,
      matchData,
      runCode,
      setCanSubmit,
      setError,
      setIsCompiled,
      setIsRunning,
      setIsSubmittingActive,
      setMessage,
      setRunResult,
      setTestResults,
      storeLastCompiled,
    ]
  );

  const addCustomTest = useCallback(
    () => addCustomTestCase(setCustomTests),
    [setCustomTests]
  );

  const updateCustomTest = useCallback(
    (id, field, value) =>
      updateCustomTestCase(setCustomTests, id, field, value),
    [setCustomTests]
  );

  const removeCustomTest = useCallback(
    (id) => removeCustomTestCase(setCustomTests, id),
    [setCustomTests]
  );

  const handleRunCustomTests = useCallback(
    () =>
      runCustomTestsAction({
        assembledCode,
        challengeId,
        customTests,
        isTimeUp,
        runCustomTests,
        setCustomRunOrder,
        setCustomRunResult,
        setCustomTestResults,
        setIsCustomRunning,
        studentId,
      }),
    [
      assembledCode,
      challengeId,
      customTests,
      isTimeUp,
      runCustomTests,
      setCustomRunOrder,
      setCustomRunResult,
      setCustomTestResults,
      setIsCustomRunning,
      studentId,
    ]
  );

  const handleSubmit = useCallback(
    () =>
      submitManualSolution({
        assembledCode,
        canSubmit,
        challengeId,
        challengeSignature,
        dispatch,
        getLastSubmission,
        getStudentAssignedMatch,
        getLastSuccessCode,
        imports,
        isTimeUp,
        setError,
        setIsSubmitting,
        setIsSubmittingActive,
        setMatchId,
        setMessage,
        setLastManualSubmission,
        setLastSuccessCode,
        storageKeyBase,
        studentCode,
        studentId,
        submitSubmission,
      }),
    [
      assembledCode,
      canSubmit,
      challengeId,
      challengeSignature,
      dispatch,
      getLastSubmission,
      getStudentAssignedMatch,
      getLastSuccessCode,
      imports,
      isTimeUp,
      setError,
      setIsSubmitting,
      setIsSubmittingActive,
      setMatchId,
      setMessage,
      setLastManualSubmission,
      setLastSuccessCode,
      storageKeyBase,
      studentCode,
      studentId,
      submitSubmission,
    ]
  );

  const handleTimerFinish = useCallback(
    () =>
      finalizeOnTimerEnd({
        assembledCode,
        challengeId,
        challengeSignature,
        clearFinalizationTimer,
        dispatch,
        getLastManualSubmission,
        getLastSubmission,
        getLastSuccessCode,
        getStudentAssignedMatch,
        imports,
        matchData,
        runCode,
        setCanSubmit,
        setError,
        setIsChallengeFinished,
        setIsFinalizationPending,
        setIsRunning,
        setIsSubmitting,
        setIsSubmittingActive,
        setIsTimeUp,
        setMatchId,
        setMessage,
        setRunResult,
        setLastManualSubmission,
        setLastSuccessCode,
        storageKeyBase,
        studentCode,
        studentId,
        submitSubmission,
      }),
    [
      assembledCode,
      challengeId,
      challengeSignature,
      clearFinalizationTimer,
      dispatch,
      getLastManualSubmission,
      getLastSubmission,
      getLastSuccessCode,
      getStudentAssignedMatch,
      imports,
      matchData,
      runCode,
      setCanSubmit,
      setError,
      setIsChallengeFinished,
      setIsFinalizationPending,
      setIsRunning,
      setIsSubmitting,
      setIsSubmittingActive,
      setIsTimeUp,
      setMatchId,
      setMessage,
      setRunResult,
      setLastManualSubmission,
      setLastSuccessCode,
      storageKeyBase,
      studentCode,
      studentId,
      submitSubmission,
    ]
  );

  useEffect(() => {
    if (!isCodingPhaseOver) return;
    if (isAutoSubmitTriggered()) return;
    if (isTimeUp || isChallengeFinished || isSubmitting) return;
    markAutoSubmitTriggered();
    handleTimerFinish();
  }, [
    handleTimerFinish,
    isChallengeFinished,
    isAutoSubmitTriggered,
    isCodingPhaseOver,
    isSubmitting,
    isTimeUp,
    markAutoSubmitTriggered,
  ]);

  return {
    handleRun,
    handleSubmit,
    handleTimerFinish,
    addCustomTest,
    updateCustomTest,
    removeCustomTest,
    handleRunCustomTests,
  };
}
