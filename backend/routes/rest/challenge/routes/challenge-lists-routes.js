const registerChallengeListsRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    ChallengeParticipant,
    ChallengeStatus,
    handleException,
    Op,
    shouldHidePrivate,
    getChallengeStatsMap,
    resolveStudentIdFromRequest,
  } = deps;

  router.get('/challenges', async (req, res) => {
    try {
      const where = shouldHidePrivate(req)
        ? { status: { [Op.ne]: 'private' } }
        : undefined;
      const challenges = await Challenge.findAll({
        where,
        include: [
          {
            model: MatchSetting,
            as: 'matchSettings',
            through: { attributes: [] },
          },
        ],
        order: Challenge.getDefaultOrder(),
      });

      const challengeIds = challenges.map((challenge) => challenge.id);
      const statsMap = await getChallengeStatsMap(challengeIds);

      const data = challenges.map((challenge) => {
        const challengeStats = statsMap.get(challenge.id) || {
          totalMatches: 0,
          finalSubmissionCount: 0,
        };
        const totalMatches = challengeStats.totalMatches;
        const finalSubmissionCount = challengeStats.finalSubmissionCount;
        const pendingFinalCount = Math.max(
          0,
          totalMatches - finalSubmissionCount
        );
        return {
          ...challenge.toJSON(),
          totalMatches,
          finalSubmissionCount,
          pendingFinalCount,
          resultsReady: totalMatches > 0 && pendingFinalCount === 0,
        };
      });
      res.json({ success: true, data });
    } catch (error) {
      handleException(res, error);
    }
  });

  router.get('/challenges/for-student', async (req, res) => {
    try {
      const requestedStudentId = Number(req.query.studentId);
      const studentIdentity = resolveStudentIdFromRequest(
        req,
        Number.isInteger(requestedStudentId) && requestedStudentId > 0
          ? requestedStudentId
          : null
      );
      if (!studentIdentity.ok) {
        return res.status(studentIdentity.status).json({
          success: false,
          error: studentIdentity.error,
        });
      }
      const { studentId } = studentIdentity;

      const where = shouldHidePrivate(req)
        ? { status: { [Op.ne]: 'private' } }
        : undefined;

      const challenges = await Challenge.findAll({
        where,
        order: Challenge.getDefaultOrder(),
      });

      const endedChallengeIds = challenges
        .filter((c) => c.status === ChallengeStatus.ENDED_PEER_REVIEW)
        .map((c) => c.id);

      const resultsReadyMap = new Map();

      if (endedChallengeIds.length > 0) {
        const statsMap = await getChallengeStatsMap(endedChallengeIds);
        endedChallengeIds.forEach((challengeId) => {
          const challengeStats = statsMap.get(challengeId) || {
            totalMatches: 0,
            finalSubmissionCount: 0,
          };
          resultsReadyMap.set(
            challengeId,
            challengeStats.totalMatches > 0 &&
              challengeStats.finalSubmissionCount ===
                challengeStats.totalMatches
          );
        });
      }

      const participations = await ChallengeParticipant.findAll({
        where: { studentId },
        attributes: ['challengeId'],
        raw: true,
      });
      const joinedSet = new Set(participations.map((row) => row.challengeId));

      const data = challenges.map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
        scoringStatus: challenge.scoringStatus,
        startDatetime: challenge.startDatetime,
        startCodingPhaseDateTime: challenge.startCodingPhaseDateTime,
        endCodingPhaseDateTime: challenge.endCodingPhaseDateTime,
        startPeerReviewDateTime: challenge.startPeerReviewDateTime,
        endPeerReviewDateTime: challenge.endPeerReviewDateTime,
        duration: challenge.duration,
        durationPeerReview: challenge.durationPeerReview,
        joined: joinedSet.has(challenge.id),
        resultsReady: resultsReadyMap.has(challenge.id)
          ? resultsReadyMap.get(challenge.id)
          : false,
      }));

      return res.json({ success: true, data });
    } catch (error) {
      handleException(res, error);
    }
  });
};

export default registerChallengeListsRoutes;
