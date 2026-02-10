const registerChallengePhaseTransitionRoutes = (router, deps) => {
  const {
    Challenge,
    ChallengeStatus,
    handleException,
    startChallengeService,
    startPeerReviewService,
    broadcastEvent,
    scheduleCodingPhaseEndForChallenge,
    schedulePeerReviewEndForChallenge,
    logger,
    finalizeMissingSubmissionsForChallenge,
    maybeCompleteCodingPhaseFinalization,
    requirePrivilegedUser,
    emitChallengeUpdate,
  } = deps;

  router.post(
    '/challenges/:challengeId/peer-reviews/start',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const result = await startPeerReviewService({ challengeId });

        if (result.status === 'challenge_not_found') {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (result.status === 'invalid_status') {
          return res.status(409).json({
            success: false,
            error: 'Peer review can only start after the coding phase ends.',
            currentStatus: result.challengeStatus,
          });
        }

        if (result.status === 'finalization_pending') {
          return res.status(409).json({
            success: false,
            error:
              'Submissions are still being finalized. Try again in a moment.',
            inFlightSubmissionsCount: result.inFlightSubmissionsCount,
          });
        }

        if (result.status === 'already_started') {
          return res.status(409).json({
            success: false,
            error: 'Peer review already started.',
          });
        }

        if (result.status === 'no_matches') {
          return res.status(400).json({
            success: false,
            error: 'No matches assigned for this challenge.',
          });
        }

        if (result.status === 'insufficient_valid_submissions') {
          return res.status(400).json({
            success: false,
            error:
              'Peer review cannot start because there are not enough valid submissions.',
          });
        }

        if (result.status === 'no_assignments') {
          return res.status(400).json({
            success: false,
            error:
              'Peer review cannot start because review assignments are missing.',
          });
        }

        if (result.status !== 'ok') {
          return res.status(500).json({
            success: false,
            error: 'Unable to start peer review.',
          });
        }

        const { challenge: updatedChallenge } = result;
        await schedulePeerReviewEndForChallenge(updatedChallenge);
        emitChallengeUpdate(updatedChallenge);

        return res.json({
          success: true,
          challenge: {
            id: updatedChallenge.id,
            title: updatedChallenge.title,
            status: updatedChallenge.status,
            startPeerReviewDateTime: updatedChallenge.startPeerReviewDateTime,
            endPeerReviewDateTime: updatedChallenge.endPeerReviewDateTime,
            durationPeerReview: updatedChallenge.durationPeerReview,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
  router.post(
    '/challenges/:challengeId/start',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const { challengeId: challengeIdParam } = req.params;
        const challengeId = Number(challengeIdParam);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const result = await startChallengeService({ challengeId });

        if (result.status === 'challenge_not_found') {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (result.status === 'invalid_status') {
          return res.status(409).json({
            success: false,
            error: 'Challenge must be assigned before it can be started.',
            currentStatus: result.challengeStatus,
          });
        }

        if (result.status === 'too_early') {
          return res.status(400).json({
            success: false,
            error: 'Challenge cannot be started before its start time.',
          });
        }

        if (result.status === 'no_participants') {
          return res.status(400).json({
            success: false,
            error: 'No participants joined. Challenge cannot be started.',
          });
        }

        if (result.status === 'no_matches') {
          return res.status(400).json({
            success: false,
            error: 'No matches assigned. Challenge cannot be started.',
          });
        }

        if (result.status === 'already_started') {
          return res.status(409).json({
            success: false,
            error: 'Challenge already started.',
          });
        }

        if (result.status === 'participants_error') {
          return res.status(500).json({
            success: false,
            error: 'Unable to load participants.',
          });
        }

        if (result.status !== 'ok') {
          //for any unexpected status that we dont know
          return res.status(500).json({
            success: false,
            error: 'Unknown error starting challenge.',
          });
        }

        const { challenge } = result;
        await scheduleCodingPhaseEndForChallenge(challenge);
        emitChallengeUpdate(challenge);

        return res.json({
          success: true,
          challenge: {
            id: challenge.id,
            title: challenge.title,
            status: challenge.status,
            startDatetime: challenge.startDatetime,
            duration: challenge.duration,
            startCodingPhaseDateTime: challenge.startCodingPhaseDateTime,
            endCodingPhaseDateTime: challenge.endCodingPhaseDateTime,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );

  router.post(
    '/challenges/:challengeId/end-coding',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const { challengeId: challengeIdParam } = req.params;
        const challengeId = Number(challengeIdParam);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (challenge.status !== ChallengeStatus.STARTED_CODING_PHASE) {
          return res.status(409).json({
            success: false,
            error: 'Coding phase can only be ended while it is active.',
            currentStatus: challenge.status,
          });
        }

        const endCodingPhaseDateTime = new Date();
        const [updatedCount, updatedRows] = await Challenge.update(
          {
            status: ChallengeStatus.ENDED_CODING_PHASE,
            endCodingPhaseDateTime,
            codingPhaseFinalizationCompletedAt: null,
          },
          {
            where: {
              id: challengeId,
              status: ChallengeStatus.STARTED_CODING_PHASE,
            },
            returning: true,
          }
        );

        if (updatedCount === 0) {
          return res.status(409).json({
            success: false,
            error: 'Coding phase could not be ended.',
          });
        }

        const updatedChallenge = updatedRows?.[0] || challenge;
        try {
          const finalizedMatches = await finalizeMissingSubmissionsForChallenge(
            {
              challengeId: updatedChallenge.id,
            }
          );
          finalizedMatches.forEach((finalized) => {
            broadcastEvent({
              event: 'finalization-updated',
              data: {
                challengeId: updatedChallenge.id,
                matchId: finalized.matchId,
              },
            });
          });
        } catch (error) {
          logger.error('Finalize missing submissions error:', error);
        }
        emitChallengeUpdate(updatedChallenge);

        try {
          await maybeCompleteCodingPhaseFinalization({
            challengeId: updatedChallenge.id,
          });
        } catch (error) {
          logger.error('Coding phase finalization completion error:', {
            challengeId: updatedChallenge.id,
            error: error?.message || String(error),
          });
        }

        return res.json({
          success: true,
          challenge: {
            id: updatedChallenge.id,
            title: updatedChallenge.title,
            status: updatedChallenge.status,
            endCodingPhaseDateTime: updatedChallenge.endCodingPhaseDateTime,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengePhaseTransitionRoutes;
