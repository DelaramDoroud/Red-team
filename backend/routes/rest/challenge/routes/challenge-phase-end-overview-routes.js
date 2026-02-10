const registerChallengePhaseEndOverviewRoutes = (router, deps) => {
  const {
    Challenge,
    ChallengeParticipant,
    ChallengeStatus,
    handleException,
    finalizePeerReviewChallenge,
    requireAuthenticatedUser,
    requirePrivilegedUser,
    shouldHidePrivate,
    emitChallengeUpdate,
    resolveStudentIdFromRequest,
  } = deps;

  router.post(
    '/challenges/:challengeId/end-peer-review',
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

        if (challenge.status !== ChallengeStatus.STARTED_PEER_REVIEW) {
          return res.status(409).json({
            success: false,
            error: 'Peer review can only be ended while it is active.',
            currentStatus: challenge.status,
          });
        }

        const result = await finalizePeerReviewChallenge({
          challengeId,
          allowEarly: true,
        });

        if (result.status === 'challenge_not_found') {
          return res.status(404).json({
            success: false,
            error: 'Challenge not found',
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
            error: 'Unable to finalize peer review',
          });
        }

        if (result.status === 'ok' && result.challenge) {
          emitChallengeUpdate(result.challenge);
        }

        return res.json({
          success: true,
          data: { finalized: true },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );

  router.post(
    '/challenges/:challengeId/end-challenge',
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

        if (challenge.status !== ChallengeStatus.ENDED_CODING_PHASE) {
          return res.status(409).json({
            success: false,
            error: 'Challenge can only be ended after the coding phase.',
            currentStatus: challenge.status,
          });
        }

        const result = await finalizePeerReviewChallenge({
          challengeId,
          allowEarly: true,
        });

        if (result.status === 'challenge_not_found') {
          return res.status(404).json({
            success: false,
            error: 'Challenge not found',
          });
        }

        if (result.status === 'no_participants') {
          return res.status(400).json({
            success: false,
            error: 'Challenge cannot be finalized without participants',
          });
        }

        if (result.status === 'update_failed') {
          return res.status(500).json({
            success: false,
            error: 'Unable to finalize challenge',
          });
        }

        if (result.status === 'ok' && result.challenge) {
          emitChallengeUpdate(result.challenge);
        }

        return res.json({
          success: true,
          data: { finalized: true },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
  //read challenge data for joind student
  router.get(
    '/challenges/:challengeId/for-student',
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

        // check the student actually joined
        const participation = await ChallengeParticipant.findOne({
          where: { challengeId, studentId },
        });
        if (!participation) {
          return res.status(403).json({
            success: false,
            error: 'Student has not joined this challenge',
          });
        }
        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res.status(404).json({
            success: false,
            error: 'Challenge not found',
          });
        }
        if (shouldHidePrivate(req) && challenge.status === 'private') {
          return res.status(403).json({
            success: false,
            error: 'Challenge is private',
          });
        }
        return res.json({
          success: true,
          data: {
            id: challenge.id,
            status: challenge.status,
            startDatetime: challenge.startDatetime,
            duration: challenge.duration,
            startCodingPhaseDateTime: challenge.startCodingPhaseDateTime,
            startPeerReviewDateTime: challenge.startPeerReviewDateTime,
            endPeerReviewDateTime: challenge.endPeerReviewDateTime,
            durationPeerReview: challenge.durationPeerReview,
            title: challenge.title,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengePhaseEndOverviewRoutes;
