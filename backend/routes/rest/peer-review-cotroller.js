import { Router } from 'express';

import ChallengeParticipant from '#root/models/challenge-participant.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';

import { handleException } from '#root/services/error.js';
import logger from '#root/services/logger.js';
import * as submitVoteService from '#root/services/peer-review-submit-vote.js';

const router = Router();

router.get('/challenges/:challengeId/peer-reviews/votes', async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user?.id;

    if (!challengeId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Challenge ID is required' },
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
    }

    // (User -> ChallengeParticipant)
    const participant = await ChallengeParticipant.findOne({
      where: {
        studentId: userId,
        challengeId: challengeId,
      },
    });

    if (!participant) {
      return res.status(403).json({
        success: false,
        error: { message: 'User is not a participant in this challenge' },
      });
    }

    const assignments = await PeerReviewAssignment.findAll({
      where: {
        reviewerId: participant.id,
      },
      include: [
        {
          model: PeerReviewVote,
          as: 'vote',
          required: true,
        },
      ],
    });

    const votes = assignments.map((a) => ({
      submissionId: a.submissionId,
      vote: a.vote.vote, // Enum: 'correct', 'incorrect', 'abstain'
      testCaseInput: a.vote.testCaseInput,
      expectedOutput: a.vote.expectedOutput,
    }));

    logger.info(
      `Retrieved ${votes.length} peer review votes for user ${userId} in challenge ${challengeId}`
    );

    return res.json({
      success: true,
      votes,
    });
  } catch (error) {
    logger.error('Get peer review votes error:', error);
    handleException(res, error);
  }
});

router.post('/peer-reviews/:assignmentId/vote', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { vote, testCaseInput, expectedOutput } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: { message: 'User not authenticated' } });
    }

    await submitVoteService.submitVote(userId, assignmentId, {
      vote,
      testCaseInput,
      expectedOutput,
    });

    logger.info(`User ${userId} voted ${vote} on assignment ${assignmentId}`);
    return res.json({ success: true });
  } catch (error) {
    // Mapping degli errori del service agli Status Code HTTP
    if (error.code === 'INVALID_INPUT') {
      return res
        .status(400)
        .json({ success: false, error: { message: error.message } });
    }
    if (error.code === 'NOT_FOUND') {
      return res
        .status(404)
        .json({ success: false, error: { message: error.message } });
    }
    if (error.code === 'FORBIDDEN') {
      return res
        .status(403)
        .json({ success: false, error: { message: error.message } });
    }

    logger.error('Submit peer review vote error:', error);
    handleException(res, error);
  }
});

export default router;
