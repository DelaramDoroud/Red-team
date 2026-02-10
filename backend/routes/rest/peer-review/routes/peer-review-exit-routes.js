const registerPeerReviewExitRoutes = (router, deps) => {
  const {
    Op,
    handleException,
    ChallengeParticipant,
    PeerReviewAssignment,
    PeerReviewVote,
    Challenge,
    ChallengeStatus,
    VoteType,
    logger,
    getRequestRole,
    getRequestUserId,
    requireAuthenticatedUser,
  } = deps;

  router.post(
    '/peer-review/exit',
    requireAuthenticatedUser,
    async (req, res) => {
      const t = await PeerReviewVote.sequelize.transaction();

      try {
        const { challengeId, votes } = req.body;
        const userId = getRequestUserId(req);
        const requestRole = getRequestRole(req);
        const bodyStudentId = Number(req.body?.studentId);

        if (!challengeId) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            error: 'challengeId is required',
          });
        }

        if (requestRole !== 'student' || !userId) {
          await t.rollback();
          return res.status(403).json({
            success: false,
            error: 'Not authorized',
          });
        }

        if (Number.isInteger(bodyStudentId) && bodyStudentId !== userId) {
          await t.rollback();
          return res.status(403).json({
            success: false,
            error: 'Not authorized',
          });
        }

        const challenge = await Challenge.findByPk(challengeId, {
          transaction: t,
        });

        if (!challenge) {
          await t.rollback();
          return res.status(404).json({
            success: false,
            error: 'Challenge not found',
          });
        }

        if (challenge.status !== ChallengeStatus.STARTED_PEER_REVIEW) {
          await t.rollback();
          return res.status(400).json({
            success: false,
            error: 'Peer review phase must be active to exit',
          });
        }

        const participant = await ChallengeParticipant.findOne({
          where: {
            challengeId,
            studentId: userId,
          },
          transaction: t,
        });

        if (!participant) {
          await t.rollback();
          return res.status(404).json({
            success: false,
            error: 'Participant not found',
          });
        }

        const assignments = await PeerReviewAssignment.findAll({
          where: { reviewerId: participant.id },
          transaction: t,
        });

        const assignmentIds = assignments.map((assignment) => assignment.id);
        const assignmentMap = new Map(
          assignments.map((assignment) => [assignment.submissionId, assignment])
        );

        const existingVotes =
          assignmentIds.length > 0
            ? await PeerReviewVote.findAll({
                where: {
                  peerReviewAssignmentId: { [Op.in]: assignmentIds },
                },
                transaction: t,
              })
            : [];

        const existingVoteMap = new Map(
          existingVotes.map((voteRow) => [
            voteRow.peerReviewAssignmentId,
            voteRow,
          ])
        );

        let votesSaved = 0;
        let abstainVotesCreated = 0;

        if (Array.isArray(votes) && votes.length > 0) {
          for (const voteData of votes) {
            const { submissionId, vote, testCaseInput, expectedOutput } =
              voteData;
            const assignment = assignmentMap.get(submissionId);

            if (!assignment) continue;

            const existingVote = existingVoteMap.get(assignment.id);

            const voteType =
              vote === VoteType.CORRECT
                ? VoteType.CORRECT
                : vote === VoteType.INCORRECT
                  ? VoteType.INCORRECT
                  : VoteType.ABSTAIN;

            const votePayload = {
              vote: voteType,
              testCaseInput:
                voteType === VoteType.INCORRECT ? testCaseInput : null,
              expectedOutput:
                voteType === VoteType.INCORRECT ? expectedOutput : null,
            };

            if (existingVote) {
              await existingVote.update(votePayload, { transaction: t });
            } else {
              await PeerReviewVote.create(
                {
                  peerReviewAssignmentId: assignment.id,
                  ...votePayload,
                },
                { transaction: t }
              );
            }
            votesSaved += 1;
          }
        }

        const votedAssignmentIds = new Set();

        if (Array.isArray(votes) && votes.length > 0) {
          votes.forEach((voteData) => {
            const assignment = assignmentMap.get(voteData.submissionId);
            if (assignment) {
              votedAssignmentIds.add(assignment.id);
            }
          });
        }

        existingVotes.forEach((voteRow) => {
          votedAssignmentIds.add(voteRow.peerReviewAssignmentId);
        });

        const unvotedAssignments = assignmentIds.filter(
          (assignmentId) => !votedAssignmentIds.has(assignmentId)
        );

        if (unvotedAssignments.length > 0) {
          const abstainVotes = unvotedAssignments.map((assignmentId) => ({
            peerReviewAssignmentId: assignmentId,
            vote: VoteType.ABSTAIN,
            testCaseInput: null,
            expectedOutput: null,
          }));

          await PeerReviewVote.bulkCreate(abstainVotes, { transaction: t });
          abstainVotesCreated = abstainVotes.length;
        }

        logger.info(
          `Student ${userId} exited peer review for challenge ${challengeId}. Votes saved: ${votesSaved}, Abstain votes created: ${abstainVotesCreated}`
        );

        await t.commit();
        return res.json({
          success: true,
          data: {
            votesSaved,
            abstainVotesCreated,
          },
        });
      } catch (error) {
        await t.rollback();
        logger.error('Exit peer review error:', error);
        return handleException(res, error);
      }
    }
  );
};

export default registerPeerReviewExitRoutes;
