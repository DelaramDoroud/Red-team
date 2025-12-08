import { Router } from 'express';
import Submission from '#root/models/submission.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import MatchSetting from '#root/models/match-setting.js';
import sequelize from '#root/services/sequelize.js';
import { handleException } from '#root/services/error.js';
import logger from '#root/services/logger.js';

const router = Router();

router.post('/submissions', async (req, res) => {
  try {
    const { matchId, code } = req.body;

    // Validation
    if (!matchId || !code) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: matchId and code',
        },
      });
    }

    if (typeof code !== 'string' || code.trim().length === 0) {
      // TODO to check how frontend sends empty or strange code (eg only random numbers, 255, 42, etc.)
      return res.status(400).json({
        success: false,
        error: {
          message: 'Code cannot be empty',
        },
      });
    }

    // Verify match exists
    const match = await Match.findByPk(matchId, {
      include: [
        {
          model: ChallengeMatchSetting,
          as: 'challengeMatchSetting',
          include: [
            {
              model: MatchSetting,
              as: 'matchSetting',
            },
          ],
        },
      ],
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Match with ID ${matchId} not found`,
        },
      });
    }

    const matchSetting = match.challengeMatchSetting?.matchSetting;
    if (!matchSetting) {
      return res.status(400).json({
        // if match exists but no setting, it's a bad request error
        success: false,
        error: {
          message: 'Match setting not found for this match',
        },
      });
    }

    /*
    const compilationResult = await runSubmission({ code, matchSetting });
    if (compilationResult.status === 'compilation_failed') {
      return res.status(400).json({
        success: false,
        error: {
          message:
            'Your code did not compile. Please fix compilation errors before submitting.',
          compilationError: compilationResult.compilationError,
        },
      });
    }
    */

    const transaction = await sequelize.transaction();
    try {
      // Check if a submission already exists for this match
      let submission = await Submission.findOne({
        where: { matchId },
        transaction,
      });

      if (submission) {
        // UPDATE
        submission.code = code;
        submission.updatedAt = new Date();
        submission.submissions_count = (submission.submissions_count || 0) + 1;

        await submission.save({ transaction });

        await transaction.commit();

        logger.info(`Submission ${submission.id} updated for match ${matchId}`);

        return res.json({
          success: true,
          data: {
            submission: {
              id: submission.id,
              matchId: submission.matchId,
              challengeParticipantId: submission.challengeParticipantId,
              code: submission.code,
              submissionsCount: submission.submissions_count,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt,
            },
          },
        });
      } else {
        // INSERT
        submission = await Submission.create(
          {
            matchId,
            challengeParticipantId: match.challengeParticipantId,
            code,
            submissions_count: 1,
          },
          { transaction }
        );

        await transaction.commit();

        logger.info(`Submission ${submission.id} created for match ${matchId}`);

        return res.json({
          success: true,
          data: {
            submission: {
              id: submission.id,
              matchId: submission.matchId,
              challengeParticipantId: submission.challengeParticipantId,
              code: submission.code,
              submissionsCount: submission.submissions_count,
              createdAt: submission.createdAt,
              updatedAt: submission.updatedAt,
            },
          },
        });
      }
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    logger.error('Submission error:', error);
    handleException(res, error);
  }
});

router.get('/submission/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that id is a valid number
    if (isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Submission ID must be a number',
        },
      });
    }

    const submission = await Submission.findByPk(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Submission with ID ${id} not found`,
        },
      });
    }

    res.json({
      success: true,
      data: {
        submission: {
          id: submission.id,
          matchId: submission.matchId,
          code: submission.code,
          submissionsCount: submission.submissions_count,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error('Get submission error:', error);
    handleException(res, error);
  }
});

export default router;
