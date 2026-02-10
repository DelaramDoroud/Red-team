import { useCallback, useMemo } from 'react';
import { getApiErrorMessage } from '#js/apiError';
import { ChallengeStatus } from '#js/constants';

export default function useChallengeDetailAdminActions({
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
}) {
  const dangerActions = useMemo(
    () => ({
      endCoding: {
        key: 'endCoding',
        label: 'End coding phase',
        title: 'End coding phase?',
        description:
          'This will immediately stop the coding phase for all students.',
        confirmLabel: 'End coding phase',
        pendingLabel: 'Ending coding phase...',
        errorMessage: 'Unable to end the coding phase.',
        run: endCodingPhase,
      },
      endPeerReview: {
        key: 'endPeerReview',
        label: 'End peer review',
        title: 'End peer review?',
        description:
          'This will finalize peer review and lock in the current results.',
        confirmLabel: 'End peer review',
        pendingLabel: 'Ending peer review...',
        errorMessage: 'Unable to end peer review.',
        run: endPeerReview,
      },
      endChallenge: {
        key: 'endChallenge',
        label: 'End challenge',
        title: 'End challenge?',
        description:
          'This will immediately complete the challenge without starting peer review.',
        confirmLabel: 'End challenge',
        pendingLabel: 'Ending challenge...',
        errorMessage: 'Unable to end the challenge.',
        run: endChallenge,
      },
    }),
    [endChallenge, endCodingPhase, endPeerReview]
  );

  const activeDangerAction = dangerAction ? dangerActions[dangerAction] : null;

  const handleConfirmDangerAction = useCallback(async () => {
    if (!challengeId || !dangerAction) return;
    const actionConfig = dangerActions[dangerAction];
    if (!actionConfig) return;

    setDangerPending(true);
    setError(null);
    try {
      const res = await actionConfig.run(challengeId);
      if (res?.success === false) {
        setError(getApiErrorMessage(res, actionConfig.errorMessage));
        return;
      }
      setDangerAction(null);
      await load();
    } catch {
      setError(actionConfig.errorMessage);
    } finally {
      setDangerPending(false);
    }
  }, [
    challengeId,
    dangerAction,
    dangerActions,
    load,
    setDangerAction,
    setDangerPending,
    setError,
  ]);

  const handleCancelDangerAction = useCallback(() => {
    if (dangerPending) return;
    setDangerAction(null);
  }, [dangerPending, setDangerAction]);

  const handleEditClick = useCallback(() => {
    if (!challengeId) return;
    if (challenge?.status === ChallengeStatus.PUBLIC) {
      setEditDialogOpen(true);
      return;
    }
    router.push(`/challenges/${challengeId}/edit`);
  }, [challenge?.status, challengeId, router, setEditDialogOpen]);

  const handleEditCancel = useCallback(() => {
    setEditDialogOpen(false);
  }, [setEditDialogOpen]);

  const handleConfirmUnpublish = useCallback(async () => {
    if (!challengeId) return;
    setEditPending(true);
    setError(null);
    try {
      const result = await unpublishChallenge(challengeId);
      if (!result?.success) {
        setError(
          getApiErrorMessage(result, 'Unable to unpublish this challenge.')
        );
        setEditPending(false);
        return;
      }
      setEditDialogOpen(false);
      router.push(`/challenges/${challengeId}/edit`);
    } catch {
      setError('Unable to unpublish this challenge.');
    } finally {
      setEditPending(false);
    }
  }, [
    challengeId,
    router,
    setEditDialogOpen,
    setEditPending,
    setError,
    unpublishChallenge,
  ]);

  return {
    activeDangerAction,
    handleConfirmDangerAction,
    handleCancelDangerAction,
    handleEditClick,
    handleEditCancel,
    handleConfirmUnpublish,
  };
}
