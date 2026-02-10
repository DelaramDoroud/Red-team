import { setLastSuccessfulCode } from '#js/store/slices/ui';
import {
  getUserFacingErrorMessage,
  MESSAGE_FINALIZING_SUBMISSION,
  MESSAGE_PHASE1_SUBMITTED,
  MESSAGE_SUBMISSION_PRIVATE_FAIL,
  MESSAGE_SUBMISSION_PUBLIC_FAIL,
  MESSAGE_SUBMISSION_SUCCESS,
  normalizeCode,
} from './matchHelpers';

export const submitManualSolution = async ({
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
}) => {
  setMessage(null);
  setError(null);
  if (isTimeUp) {
    setError({ message: 'Time is up. You can no longer submit code.' });
    return false;
  }
  if (!canSubmit) {
    setError({ message: 'Run your code successfully before submitting.' });
    return false;
  }

  setIsSubmitting(true);

  try {
    const res = await getStudentAssignedMatch(challengeId, studentId);

    if (!res?.success || !res?.data?.id) {
      setError({ message: 'No match found for submission.' });
      return false;
    }

    const resolvedMatchId = res.data.id;
    setMatchId(resolvedMatchId);
    const persistKey = resolvedMatchId
      ? `match-${resolvedMatchId}`
      : storageKeyBase;

    if (!studentCode.trim()) {
      setError({ message: 'Empty code cannot be submitted.' });
      return false;
    }

    const submissionRes = await submitSubmission({
      matchId: resolvedMatchId,
      code: assembledCode,
    });

    if (submissionRes?.success) {
      const { publicTestResults, privateTestResults } =
        submissionRes.data || {};
      let submissionMessage = MESSAGE_SUBMISSION_SUCCESS;

      if (
        publicTestResults &&
        Array.isArray(publicTestResults) &&
        privateTestResults &&
        Array.isArray(privateTestResults)
      ) {
        const allPublicPassed = publicTestResults.every(
          (result) => result.passed === true
        );

        const allPrivatePassed = privateTestResults.every(
          (result) => result.passed === true
        );

        if (!allPublicPassed) {
          submissionMessage = MESSAGE_SUBMISSION_PUBLIC_FAIL;
        } else if (allPublicPassed && !allPrivatePassed) {
          submissionMessage = MESSAGE_SUBMISSION_PRIVATE_FAIL;
        }
      }

      setMessage(submissionMessage);
      setLastSuccessCode(assembledCode);
      setLastManualSubmission(assembledCode);
      if (studentId) {
        dispatch(
          setLastSuccessfulCode({
            userId: studentId,
            key: persistKey,
            imports,
            studentCode,
            signature: challengeSignature,
          })
        );
      }
      return true;
    }

    try {
      const lastValid = await getLastSubmission(resolvedMatchId);
      const fallbackCode =
        lastValid?.data?.submission?.code || getLastSuccessCode();
      if (fallbackCode && fallbackCode.trim()) {
        setMessage('New code failed. Kept your last valid submission.');
        setLastSuccessCode(fallbackCode);
        return true;
      }
    } catch {
      // Ignore fallback failures and surface original submission error below.
    }

    const errorMessage = getUserFacingErrorMessage(
      submissionRes,
      'Submission failed.'
    );
    setError({ message: errorMessage });
    return false;
  } catch (err) {
    setError({ message: `Error: ${err.message}` });
    return false;
  } finally {
    setIsSubmitting(false);
    setIsSubmittingActive(false);
  }
};

const buildPendingFinalizationHandlers = ({
  clearFinalizationTimer,
  setIsChallengeFinished,
  setIsFinalizationPending,
  setMessage,
}) => {
  const finishWithPendingFinalization = () => {
    clearFinalizationTimer();
    setMessage(MESSAGE_FINALIZING_SUBMISSION);
    setIsChallengeFinished(true);
    setIsFinalizationPending(true);
  };

  const finishWithoutFinalization = (finalMessage) => {
    clearFinalizationTimer();
    setMessage(finalMessage);
    setIsChallengeFinished(true);
    setIsFinalizationPending(false);
  };

  return {
    finishWithPendingFinalization,
    finishWithoutFinalization,
  };
};

const resolveLastSubmittedCode = async ({
  getLastSubmission,
  getLastSuccessCode,
  resolvedMatchId,
  setLastManualSubmission,
  setLastSuccessCode,
}) => {
  const localCode = getLastSuccessCode();
  if (normalizeCode(localCode)) return localCode;
  try {
    const lastRes = await getLastSubmission(resolvedMatchId);
    const lastSubmission = lastRes?.data?.submission;
    const lastCode = lastSubmission?.code;
    if (normalizeCode(lastCode)) {
      setLastSuccessCode(lastCode);
      if (lastSubmission?.isAutomaticSubmission === false) {
        setLastManualSubmission(lastCode);
      }
      return lastCode;
    }
  } catch {
    return null;
  }
  return null;
};

const runAutoSubmissionCompilation = async ({
  assembledCode,
  challengeId,
  matchData,
  runCode,
}) => {
  const matchSettingId =
    matchData?.id ||
    matchData?.matchSettingId ||
    matchData?.challengeMatchSettingId ||
    challengeId;

  if (!runCode || !matchSettingId) {
    return { success: false };
  }

  try {
    return await runCode({
      matchSettingId,
      code: assembledCode,
      language: 'cpp',
    });
  } catch {
    return { success: false };
  }
};

export const finalizeOnTimerEnd = async ({
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
}) => {
  setMessage(null);
  setError(null);
  setIsTimeUp(true);
  setCanSubmit(false);
  setIsSubmitting(true);
  setIsSubmittingActive(false);
  setIsRunning(false);
  setRunResult({
    type: 'error',
    message: 'Time is up. You can no longer run or submit code.',
  });

  const { finishWithPendingFinalization, finishWithoutFinalization } =
    buildPendingFinalizationHandlers({
      clearFinalizationTimer,
      setIsChallengeFinished,
      setIsFinalizationPending,
      setMessage,
    });

  try {
    const res = await getStudentAssignedMatch(challengeId, studentId);

    if (!res?.success || !res?.data?.id) {
      finishWithPendingFinalization();
      return false;
    }

    const resolvedMatchId = res.data.id;
    setMatchId(resolvedMatchId);
    const persistKey = resolvedMatchId
      ? `match-${resolvedMatchId}`
      : storageKeyBase;

    const lastSubmittedCode = await resolveLastSubmittedCode({
      getLastSubmission,
      getLastSuccessCode,
      resolvedMatchId,
      setLastManualSubmission,
      setLastSuccessCode,
    });
    const lastSubmittedNormalized = normalizeCode(lastSubmittedCode);
    const hasManualSubmission = Boolean(lastSubmittedNormalized);
    const manualSubmissionCode = normalizeCode(getLastManualSubmission());
    const autoSubmissionCode = normalizeCode(assembledCode);

    if (!studentCode.trim()) {
      finishWithPendingFinalization();
      return hasManualSubmission;
    }

    const runOutcome = await runAutoSubmissionCompilation({
      assembledCode,
      challengeId,
      matchData,
      runCode,
    });

    const runSuccess = runOutcome?.success === true;
    const runCompiled =
      runOutcome?.data?.isCompiled !== undefined
        ? runOutcome.data.isCompiled
        : runOutcome?.isCompiled;
    const runPassed =
      runOutcome?.data?.isPassed !== undefined
        ? runOutcome.data.isPassed
        : runOutcome?.isPassed;

    if (!runSuccess || runCompiled === false || !runPassed) {
      finishWithPendingFinalization();
      return hasManualSubmission;
    }

    const submissionRes = await submitSubmission({
      matchId: resolvedMatchId,
      code: assembledCode,
      isAutomatic: true,
    });

    if (submissionRes?.success) {
      const shouldSkipFinalizationWait =
        Boolean(manualSubmissionCode) &&
        manualSubmissionCode === autoSubmissionCode;

      if (shouldSkipFinalizationWait) {
        finishWithoutFinalization(MESSAGE_PHASE1_SUBMITTED);
      } else {
        finishWithPendingFinalization();
      }
      setLastSuccessCode(assembledCode);
      if (studentId) {
        dispatch(
          setLastSuccessfulCode({
            userId: studentId,
            key: persistKey,
            imports,
            studentCode,
            signature: challengeSignature,
          })
        );
      }
      return true;
    }

    finishWithPendingFinalization();
    return hasManualSubmission;
  } catch {
    finishWithPendingFinalization();
    return false;
  } finally {
    setIsSubmitting(false);
  }
};
