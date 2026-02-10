const registerChallengeStudentMatchRoutes = (router, deps) => {
  const {
    Challenge,
    Match,
    ChallengeParticipant,
    ChallengeStatus,
    handleException,
    requireAuthenticatedUser,
    shouldHidePrivate,
    resolveStudentIdFromRequest,
  } = deps;

  router.get(
    '/challenges/:challengeId/match',
    requireAuthenticatedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid challengeId',
          });
        }
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

        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res.status(404).json({
            success: false,
            message: 'Challenge not found',
          });
        }
        if (shouldHidePrivate(req) && challenge.status === 'private') {
          return res.status(403).json({
            success: false,
            message: 'Challenge is private',
          });
        }
        const canAccessMatchData = [
          ChallengeStatus.STARTED_CODING_PHASE,
          ChallengeStatus.ENDED_CODING_PHASE,
          ChallengeStatus.STARTED_PEER_REVIEW,
          ChallengeStatus.ENDED_PEER_REVIEW,
        ].includes(challenge.status);
        if (!canAccessMatchData) {
          return res.status(409).json({
            success: false,
            message: 'Challenge has not started yet.',
            status: challenge.status,
          });
        }

        const participant = await ChallengeParticipant.findOne({
          where: { challengeId, studentId },
        });

        if (!participant) {
          return res.status(404).json({
            success: false,
            message: 'Participant not found for this challenge and student',
          });
        }

        const match = await Match.findOne({
          where: { challengeParticipantId: participant.id },
        });

        if (!match) {
          return res.status(404).json({
            success: false,
            message: 'Match not found for the given participant',
          });
        }
        return res.json({
          success: true,
          data: match,
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengeStudentMatchRoutes;
