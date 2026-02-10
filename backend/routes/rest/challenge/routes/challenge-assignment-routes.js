const registerChallengeAssignmentRoutes = (router, deps) => {
  const {
    Challenge,
    handleException,
    getChallengeParticipants,
    assignMatches,
    requirePrivilegedUser,
    shouldHidePrivate,
    emitChallengeUpdate,
  } = deps;

  router.get('/challenges/:challengeId/participants', async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid challengeId',
        });
      }

      if (shouldHidePrivate(req)) {
        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res.status(404).json({
            success: false,
            error: 'Challenge not found',
          });
        }
        if (challenge.status === 'private') {
          return res.status(403).json({
            success: false,
            error: 'Challenge is private',
          });
        }
      }

      const result = await getChallengeParticipants({ challengeId });

      if (result.status === 'error') {
        console.error('Error getting participants:', result.error);
        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
        });
      }

      const data = result.participants || [];

      return res.json({
        success: true,
        data,
      });
    } catch (error) {
      handleException(res, error);
    }
  });

  router.post(
    '/challenges/:challengeId/assign',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const overwrite =
          String(req.query.overwrite || '').toLowerCase() === 'true';
        const result = await assignMatches({ challengeId, overwrite });

        if (result.status === 'challenge_not_found') {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }
        if (result.status === 'no_match_settings') {
          return res.status(400).json({
            success: false,
            error: 'No match settings selected for this challenge',
          });
        }
        if (result.status === 'no_participants') {
          return res
            .status(400)
            .json({ success: false, error: 'No participants joined' });
        }
        if (result.status === 'already_assigned' && !overwrite) {
          return res.status(409).json({
            success: false,
            error:
              'Assignments already exist. Use ?overwrite=true to reassign.',
          });
        }
        if (result.status === 'too_early') {
          return res.status(400).json({
            success: false,
            error: 'Challenge cannot be assigned before its start time.',
          });
        }

        const updatedChallenge = await Challenge.findByPk(challengeId);
        emitChallengeUpdate(updatedChallenge);
        return res.json({ success: true, ...result });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengeAssignmentRoutes;
