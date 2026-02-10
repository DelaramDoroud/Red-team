const registerChallengePeerReviewStudentRoutes = (router, deps) => {
  const {
    Challenge,
    Match,
    ChallengeMatchSetting,
    ChallengeParticipant,
    User,
    Submission,
    PeerReviewAssignment,
    ChallengeStatus,
    handleException,
    getPeerReviewSummary,
    requireAuthenticatedUser,
    shouldHidePrivate,
    normalizeFeedbackTests,
    resolveStudentIdFromRequest,
  } = deps;

  router.get(
    '/challenges/:challengeId/peer-reviews/for-student',
    requireAuthenticatedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
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
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }
        if (shouldHidePrivate(req) && challenge.status === 'private') {
          return res.status(403).json({
            success: false,
            error: 'Challenge is private',
          });
        }

        const participant = await ChallengeParticipant.findOne({
          where: { challengeId, studentId },
        });
        if (!participant) {
          return res.status(404).json({
            success: false,
            error: 'Participant not found for this challenge and student',
          });
        }

        const assignments = await PeerReviewAssignment.findAll({
          where: { reviewerId: participant.id },
          include: [
            {
              model: Submission,
              as: 'submission',
              attributes: ['id', 'code', 'matchId', 'challengeParticipantId'],
              include: [
                {
                  model: Match,
                  as: 'match',
                  attributes: ['id', 'challengeMatchSettingId'],
                  include: [
                    {
                      model: ChallengeMatchSetting,
                      as: 'challengeMatchSetting',
                      attributes: ['id'],
                      where: { challengeId },
                    },
                  ],
                },
                {
                  model: ChallengeParticipant,
                  as: 'challengeParticipant',
                  attributes: ['id'],
                  include: [
                    {
                      model: User,
                      as: 'student',
                      attributes: ['id', 'username'],
                    },
                  ],
                },
              ],
            },
          ],
        });

        const assignmentItems = assignments
          .filter((assignment) => assignment.submission)
          .map((assignment) => ({
            id: assignment.id,
            submissionId: assignment.submission.id,
            code: assignment.submission.code,
            matchId: assignment.submission.matchId,
            isExtra: assignment.isExtra,
            author: assignment.submission.challengeParticipant?.student
              ? {
                  id: assignment.submission.challengeParticipant.student.id,
                  username:
                    assignment.submission.challengeParticipant.student.username,
                }
              : null,
          }));

        return res.json({
          success: true,
          challenge: {
            id: challenge.id,
            status: challenge.status,
            startPeerReviewDateTime: challenge.startPeerReviewDateTime,
            endPeerReviewDateTime: challenge.endPeerReviewDateTime,
            durationPeerReview: challenge.durationPeerReview,
          },
          assignments: assignmentItems,
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
  router.get(
    '/challenges/:challengeId/peer-reviews/summary',
    requireAuthenticatedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
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

        const result = await getPeerReviewSummary({ challengeId, studentId });

        if (result.status === 'challenge_not_found') {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }
        if (result.status === 'participant_not_found') {
          return res
            .status(404)
            .json({ success: false, error: 'Participant not found' });
        }

        return res.json({ success: true, summary: result.summary });
      } catch (error) {
        handleException(res, error);
      }
    }
  );

  router.post(
    '/challenges/:challengeId/peer-reviews/:assignmentId/tests',
    requireAuthenticatedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        const assignmentId = Number(req.params.assignmentId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }
        if (!Number.isInteger(assignmentId) || assignmentId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid assignmentId' });
        }

        const requestedStudentId = Number(req.body?.studentId);
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
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }
        if (
          challenge.status !== ChallengeStatus.STARTED_PEER_REVIEW &&
          challenge.status !== ChallengeStatus.ENDED_PEER_REVIEW
        ) {
          return res.status(409).json({
            success: false,
            error: 'Peer review tests can only be saved during peer review.',
          });
        }

        const participant = await ChallengeParticipant.findOne({
          where: { challengeId, studentId },
        });
        if (!participant) {
          return res.status(404).json({
            success: false,
            error: 'Participant not found for this challenge and student',
          });
        }

        const assignment = await PeerReviewAssignment.findOne({
          where: { id: assignmentId },
          include: [
            {
              model: Submission,
              as: 'submission',
              include: [
                {
                  model: Match,
                  as: 'match',
                  include: [
                    {
                      model: ChallengeMatchSetting,
                      as: 'challengeMatchSetting',
                      where: { challengeId },
                    },
                  ],
                },
              ],
            },
          ],
        });

        if (!assignment || !assignment.submission) {
          return res.status(404).json({
            success: false,
            error: 'Peer review assignment not found',
          });
        }

        if (assignment.reviewerId !== participant.id) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized to update this assignment',
          });
        }

        const normalizedTests = normalizeFeedbackTests(req.body?.tests);

        const updated = await assignment.update({
          feedbackTests: normalizedTests,
        });

        return res.json({
          success: true,
          data: {
            id: updated.id,
            feedbackTests: updated.feedbackTests || [],
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengePeerReviewStudentRoutes;
