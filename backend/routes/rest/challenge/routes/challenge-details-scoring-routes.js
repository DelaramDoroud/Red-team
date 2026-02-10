const registerChallengeDetailsScoringRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    ChallengeStatus,
    Scoring_Availability,
    handleException,
    getRequestUser,
    shouldHidePrivate,
  } = deps;

  router.get('/challenges/:challengeId', async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }

      const challenge = await Challenge.findByPk(challengeId, {
        include: [
          {
            model: MatchSetting,
            as: 'matchSettings',
            through: { attributes: [] },
          },
        ],
      });

      if (!challenge) {
        return res
          .status(404)
          .json({ success: false, error: 'Challenge not found' });
      }
      const requestUser = getRequestUser(req);
      if (!requestUser && challenge.status === ChallengeStatus.PRIVATE) {
        return res.status(401).json({
          success: false,
          error: 'Not logged in',
        });
      }
      if (
        shouldHidePrivate(req) &&
        challenge.status === ChallengeStatus.PRIVATE
      ) {
        return res.status(403).json({
          success: false,
          error: 'Challenge is private',
        });
      }

      const challengeData = challenge.toJSON();
      const matchSettingIds = Array.isArray(challengeData.matchSettings)
        ? challengeData.matchSettings.map((matchSetting) => matchSetting.id)
        : [];

      return res.json({
        success: true,
        challenge: {
          ...challengeData,
          matchSettingIds,
        },
      });
    } catch (error) {
      handleException(res, error);
    }
  });

  router.get('/challenges/:challengeId/scoring-status', async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }

      const challenge = await Challenge.findByPk(challengeId, {
        attributes: ['id', 'status', 'endPeerReviewDateTime', 'scoringStatus'],
      });

      if (!challenge) {
        return res
          .status(404)
          .json({ success: false, error: 'Challenge not found' });
      }

      if (
        shouldHidePrivate(req) &&
        challenge.status === ChallengeStatus.PRIVATE
      ) {
        return res
          .status(403)
          .json({ success: false, error: 'Challenge is private' });
      }

      const now = new Date();
      const peerReviewEnd = challenge.endPeerReviewDateTime
        ? new Date(challenge.endPeerReviewDateTime)
        : null;

      if (!peerReviewEnd || now < peerReviewEnd) {
        return res.json({
          state: Scoring_Availability.PEER_REVIEW_NOT_ENDED,
          message:
            'Scoring is not available yet. Please wait until the peer review phase has ended.',
          canAccessData: false,
        });
      }

      if (challenge.scoringStatus !== 'completed') {
        return res.json({
          state: Scoring_Availability.SCORING_IN_PROGRESS,
          message:
            'Scoring is not available yet. Please wait until scoring is computed.',
          canAccessData: false,
        });
      }

      return res.json({
        state: Scoring_Availability.READY,
        message: null,
        canAccessData: true,
      });
    } catch (error) {
      handleException(res, error);
    }
  });
};

export default registerChallengeDetailsScoringRoutes;
