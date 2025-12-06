import { Router } from 'express';
import Submission from '#root/models/submission.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import MatchSetting from '#root/models/match-setting.js';
import sequelize from '#root/services/sequelize.js';
import { handleException } from '#root/services/error.js';
import logger from '#root/services/logger.js';
import { runSubmission } from '#root/services/code-runner.js';

const router = Router();

/**
 * POST /api/rest/submissions
 * Submit code for a match
 *
 * Request body:
 * {
 *   "matchId": number,
 *   "code": string (C++ source code)
 * }
 *
 * Response on success (compilation passed):
 * {
 *   "success": true,
 *   "data": {
 *     "submission": { id, matchId, code, status, createdAt },
 *     "testResults": {
 *       "publicTests": [...],
 *       "privateTests": [...],
 *       "summary": { ... }
 *     }
 *   }
 * }
 *
 * Response on compilation failure:
 * {
 *   "success": false,
 *   "error": {
 *     "message": "Your code did not compile. Please fix compilation errors before submitting.",
 *     "compilationError": "..." (actual compiler error)
 *   }
 * }
 */
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

    // Compile & run tests (stubbed; real implementation will replace this)
    const compilationResult = await runSubmission({ code, matchSetting });

    // If compilation failed, do not persist
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

    // Persist submission
    const transaction = await sequelize.transaction();
    try {
      const submission = await Submission.create(
        {
          matchId,
          code,
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
            code: submission.code,
            createdAt: submission.createdAt,
          },
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    logger.error('Submission error:', error);
    handleException(res, error);
  }
});

/**
 * GET /api/rest/submissions/:matchId
 * Get all submissions for a match
 */
router.get('/submissions/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;

    const submissions = await Submission.findAll({
      where: { matchId },
      order: [['created_at', 'DESC']],
      attributes: {
        exclude: ['code'], // Don't return full code
      },
    });

    res.json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    logger.error('Get submissions error:', error);
    handleException(res, error);
  }
});

/**
 * GET /api/rest/submissions/:id
 * Get a specific submission
 */
router.get('/submission/:id', async (req, res) => {
  try {
    const { id } = req.params;

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
      data: submission,
    });
  } catch (error) {
    logger.error('Get submission error:', error);
    handleException(res, error);
  }
});

export default router;
