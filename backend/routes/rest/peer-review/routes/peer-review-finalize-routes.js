const registerPeerReviewFinalizeRoutes = (router, deps) => {
  const { handleException, finalizePeerReviewChallenge } = deps;

  router.post('/peer-review/finalize-challenge', async (req, res) => {
    try {
      const { challengeId, allowEarly = false } = req.body;
      if (!challengeId) {
        return res.status(400).json({
          success: false,
          error: 'challengeId is required',
        });
      }

      const result = await finalizePeerReviewChallenge({
        challengeId,
        allowEarly: Boolean(allowEarly),
      });

      if (result.status === 'missing_challenge') {
        return res.status(400).json({
          success: false,
          error: 'challengeId is required',
        });
      }

      if (result.status === 'challenge_not_found') {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found',
        });
      }
      if (result.status === 'peer_review_not_ended') {
        return res.status(400).json({
          success: false,
          error: 'Peer review phase has not ended yet',
        });
      }

      if (result.status === 'no_participants') {
        return res.status(400).json({
          success: false,
          error: 'Peer review cannot be finalized without participants',
        });
      }

      if (result.status === 'update_failed') {
        return res.status(500).json({
          success: false,
          error: 'Unable to finalize challenge',
        });
      }

      const badgeResults = result.badgeResults || [];
      return res.json({
        success: true,
        data: { finalized: true, badgeResults },
      });
    } catch (error) {
      handleException(res, error);
    }
  });
};

export default registerPeerReviewFinalizeRoutes;
