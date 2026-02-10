import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '#js/apiError';
import { setPeerReviewExit } from '#js/store/slices/ui';
import { validateIncorrectInput } from '#js/utils';
import PeerReviewSummaryToastCard from './PeerReviewSummaryToastCard';
import { EMPTY_PEER_REVIEW_SUMMARY } from './peerReviewSummaryDefaults';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function usePeerReviewVotingActions({
  challengeId,
  studentId,
  assignments,
  setSelectedIndex,
  selectedAssignment,
  voteMap,
  setVoteMap,
  setValidationErrors,
  hasExited,
  setHasExited,
  isExiting,
  setIsExiting,
  setExitDialogOpen,
  setShowSummaryDialog,
  setFinalSummary,
  showSummaryDialog,
  voteAutosaveTimeoutRef,
  redirectTimeoutRef,
  submitPeerReviewVote,
  exitPeerReview,
  getPeerReviewSummary,
  dispatch,
  router,
}) {
  const autosaveRef = voteAutosaveTimeoutRef;
  const redirectRef = redirectTimeoutRef;

  const saveVoteToBackend = useCallback(
    async (assignmentId, voteType, input = null, output = null) => {
      if (hasExited || isExiting) return;

      const res = await submitPeerReviewVote(
        assignmentId,
        voteType,
        input,
        output
      );

      if (!res?.success) {
        const message = res?.error?.message || 'Failed to save vote';
        toast.error(message);
      }
    },
    [hasExited, isExiting, submitPeerReviewVote]
  );

  const queueVoteAutosave = useCallback(
    (assignmentId, voteType, input = null, output = null) => {
      if (!assignmentId) return;
      const existingTimer = autosaveRef.current[assignmentId];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      autosaveRef.current[assignmentId] = setTimeout(() => {
        delete autosaveRef.current[assignmentId];
        saveVoteToBackend(assignmentId, voteType, input, output);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [autosaveRef, saveVoteToBackend]
  );

  useEffect(
    () => () => {
      Object.values(autosaveRef.current).forEach((timerId) => {
        clearTimeout(timerId);
      });
      autosaveRef.current = {};
    },
    [autosaveRef]
  );

  const saveCurrentVotes = useCallback(async () => {
    if (!challengeId || !studentId || hasExited || isExiting) {
      return false;
    }

    const votesToSubmit = assignments
      .filter((assignment) => {
        const vote = voteMap[assignment.submissionId];
        return vote && vote.type;
      })
      .map((assignment) => {
        const vote = voteMap[assignment.submissionId];
        return {
          submissionId: assignment.submissionId,
          vote: vote.type,
          testCaseInput: vote.type === 'incorrect' ? vote.input || null : null,
          expectedOutput:
            vote.type === 'incorrect' ? vote.output || null : null,
        };
      });

    const res = await exitPeerReview(challengeId, studentId, votesToSubmit);
    if (res?.success === false) {
      const errorMessage =
        getApiErrorMessage(res, 'Unable to save votes') ||
        'Failed to save votes';
      toast.error(errorMessage);
      return false;
    }

    return true;
  }, [
    assignments,
    challengeId,
    exitPeerReview,
    hasExited,
    isExiting,
    studentId,
    voteMap,
  ]);

  const handleCloseSummaryDialog = useCallback(() => {
    setShowSummaryDialog(false);
    setFinalSummary(null);
    if (studentId && challengeId) {
      dispatch(
        setPeerReviewExit({
          userId: studentId,
          challengeId: String(challengeId),
          value: true,
        })
      );
    }
    router.push(`/student/challenges/${challengeId}/result`);
  }, [
    challengeId,
    dispatch,
    router,
    setFinalSummary,
    setShowSummaryDialog,
    studentId,
  ]);

  useEffect(() => {
    const timeoutId = showSummaryDialog
      ? setTimeout(() => {
          handleCloseSummaryDialog();
        }, 10000)
      : null;
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showSummaryDialog, handleCloseSummaryDialog]);

  const handleVoteChange = useCallback(
    (newVoteType) => {
      if (!selectedAssignment || hasExited || isExiting) return;

      const { submissionId } = selectedAssignment;
      const assignmentId = selectedAssignment.id;

      setVoteMap((prev) => ({
        ...prev,
        [submissionId]: {
          ...prev[submissionId],
          type: newVoteType,
        },
      }));

      if (newVoteType === 'correct' || newVoteType === 'abstain') {
        queueVoteAutosave(assignmentId, newVoteType, null, null);
        setValidationErrors((prev) => ({ ...prev, [submissionId]: null }));
      } else {
        setValidationErrors((prev) => ({
          ...prev,
          [submissionId]: {
            warning:
              "This vote won't count until you provide both input and expected output",
          },
        }));
      }
    },
    [
      hasExited,
      isExiting,
      queueVoteAutosave,
      selectedAssignment,
      setValidationErrors,
      setVoteMap,
    ]
  );

  const handleIncorrectDetailsChange = useCallback(
    (field, value) => {
      if (!selectedAssignment || hasExited || isExiting) return;
      const { submissionId } = selectedAssignment;
      const assignmentId = selectedAssignment.id;
      const currentEntry = voteMap[submissionId] || {};
      const updatedEntry = { ...currentEntry, [field]: value };

      setVoteMap((prev) => ({
        ...prev,
        [submissionId]: updatedEntry,
      }));

      const inputStr = field === 'input' ? value : currentEntry.input;
      const outputStr = field === 'output' ? value : currentEntry.output;
      const publicTests = selectedAssignment.matchSetting?.publicTests || [];
      const check = validateIncorrectInput(inputStr, outputStr, publicTests);

      if (check.valid) {
        setValidationErrors((prev) => ({ ...prev, [submissionId]: null }));
        queueVoteAutosave(assignmentId, 'incorrect', inputStr, outputStr);
      } else {
        setValidationErrors((prev) => ({
          ...prev,
          [submissionId]: check.error
            ? { error: check.error }
            : { warning: check.message },
        }));
      }
    },
    [
      hasExited,
      isExiting,
      queueVoteAutosave,
      selectedAssignment,
      setValidationErrors,
      setVoteMap,
      voteMap,
    ]
  );

  const handleContinue = useCallback(async () => {
    setIsExiting(true);
    setExitDialogOpen(false);
    try {
      const success = await saveCurrentVotes();
      if (success) {
        toast.success('Votes saved successfully.');
      }
    } catch {
      toast.error('Unable to save votes. Please try again.');
    } finally {
      setIsExiting(false);
    }
  }, [saveCurrentVotes, setExitDialogOpen, setIsExiting]);

  const handleExit = useCallback(async () => {
    if (!challengeId || !studentId || hasExited || isExiting) return;

    setIsExiting(true);
    setExitDialogOpen(false);

    try {
      const success = await saveCurrentVotes();
      if (!success) {
        setIsExiting(false);
        return;
      }

      dispatch(
        setPeerReviewExit({
          userId: studentId,
          challengeId: String(challengeId),
          value: true,
        })
      );
      setHasExited(true);
      toast.success('Thanks for your participation.');
      if (redirectRef.current) {
        clearTimeout(redirectRef.current);
      }
      redirectRef.current = setTimeout(() => {
        redirectRef.current = null;
        router.push(`/student/challenges/${challengeId}/result`);
      }, 1500);
    } catch {
      toast.error('Unable to exit peer review. Please try again.');
      setIsExiting(false);
    }
  }, [
    challengeId,
    dispatch,
    hasExited,
    isExiting,
    redirectRef,
    router,
    saveCurrentVotes,
    setExitDialogOpen,
    setHasExited,
    setIsExiting,
    studentId,
  ]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => Math.max(0, prev - 1));
  }, [setSelectedIndex]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => Math.min(assignments.length - 1, prev + 1));
  }, [assignments.length, setSelectedIndex]);

  const showSummaryToast = useCallback(async () => {
    if (!challengeId || !studentId) return;
    toast.dismiss('peer-review-summary-loading');
    toast.dismiss('peer-review-summary');

    const loadingId = toast.loading('Loading summary...', {
      id: 'peer-review-summary-loading',
    });
    try {
      const res = await getPeerReviewSummary(challengeId, studentId);
      if (res?.success === false) {
        toast.error(getApiErrorMessage(res, 'Unable to load summary'));
        return;
      }
      const summary = res?.summary || EMPTY_PEER_REVIEW_SUMMARY;
      toast.custom(
        (toastInstance) => (
          <PeerReviewSummaryToastCard
            summary={summary}
            onClose={() => toast.dismiss(toastInstance.id)}
          />
        ),
        { id: 'peer-review-summary', duration: Infinity }
      );
    } catch {
      toast.error('Unable to load summary');
    } finally {
      if (loadingId) toast.dismiss(loadingId);
    }
  }, [challengeId, getPeerReviewSummary, studentId]);

  return {
    handleCloseSummaryDialog,
    handleVoteChange,
    handleIncorrectDetailsChange,
    handleContinue,
    handleExit,
    handlePrev,
    handleNext,
    showSummaryToast,
  };
}
