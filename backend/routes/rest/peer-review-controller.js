import { Router } from 'express';
import { handleException } from '#root/services/error.js';
import ChallengeParticipant from '#root/models/challenge_participant.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer_review_vote.js';
import { Challenge, ChallengeStatus } from '../models';

const router = Router();

router.post('/peer-review/finalize', async (req, res) => {
  const t = await PeerReviewVote.sequelize.transaction();

  try {
    const { challengeId, studentId } = req.body;

    if (!challengeId || !studentId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'challengeId and studentId are required',
      });
    }

    const participant = await ChallengeParticipant.findOne({
      where: { challengeId, studentId },
      transaction: t,
    });

    if (!participant) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Participant not found',
      });
    }

    const challenge = await Challenge.findByPk(challengeId, { transaction: t });

    if (!challenge) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        error: 'Challenge not found',
      });
    }

    if (challenge.status !== ChallengeStatus.STARTED_PHASE_TWO) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        error: 'Peer review phase is not active',
      });
    }

    challenge.status = ChallengeStatus.ENDED_PHASE_TWO;
    await challenge.save({ transaction: t });

    const reviewerId = participant.id;

    const assignments = await PeerReviewAssignment.findAll({
      where: { reviewerId },
      transaction: t,
    });

    const assignmentIds = assignments.map((a) => a.id);

    if (assignmentIds.length === 0) {
      await t.commit();
      return res.json({
        success: true,
        data: {
          finalized: true,
          voteSummary: { correct: 0, incorrect: 0, abstain: 0 },
        },
      });
    }

    const existingVotes = await PeerReviewVote.findAll({
      where: {
        peerReviewAssignmentId: assignmentIds,
      },
      transaction: t,
    });

    const votedAssignmentIds = new Set(
      existingVotes.map((v) => v.peerReviewAssignmentId)
    );

    const abstainVotes = assignmentIds
      .filter((id) => !votedAssignmentIds.has(id))
      .map((id) => ({
        peerReviewAssignmentId: id,
        vote: 'abstain',
        testCaseInput: null,
        expectedOutput: null,
      }));

    if (abstainVotes.length > 0) {
      await PeerReviewVote.bulkCreate(abstainVotes, { transaction: t });
    }

    let correct = 0;
    let incorrect = 0;
    let abstain = abstainVotes.length;

    for (const v of existingVotes) {
      if (v.vote === 'correct') correct++;
      else if (v.vote === 'incorrect') incorrect++;
      else if (v.vote === 'abstain') abstain++;
    }

    await t.commit();

    return res.json({
      success: true,
      data: {
        finalized: true,
        voteSummary: { correct, incorrect, abstain },
      },
    });
  } catch (error) {
    await t.rollback();
    return handleException(res, error);
  }
});

export default router;
