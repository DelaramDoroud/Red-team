import { Router } from 'express';

import Submission from '#root/models/submission.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import MatchSetting from '#root/models/match-setting.js';

import sequelize from '#root/services/sequelize.js';
import { handleException } from '#root/services/error.js';
import logger from '#root/services/logger.js';
import { executeCodeTests } from '#root/services/execute-code-tests.js';

const router = Router();

router.post('/submissions', async (req, res) => {
  try {
    const { matchId, code, language = 'cpp' } = req.body;

    if (!matchId || !code) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: matchId and code' },
      });
    }

    if (typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Code cannot be empty' },
      });
    }

    const match = await Match.findByPk(matchId, {
      include: [
        {
          model: ChallengeMatchSetting,
          as: 'challengeMatchSetting',
          include: [{ model: MatchSetting, as: 'matchSetting' }],
        },
      ],
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        error: { message: `Match with ID ${matchId} not found` },
      });
    }

    const matchSetting = match.challengeMatchSetting?.matchSetting;
    if (!matchSetting) {
      return res.status(400).json({
        success: false,
        error: { message: 'Match setting not found for this match' },
      });
    }

    const publicTests = matchSetting.publicTests || [];
    const privateTests = matchSetting.privateTests || [];

    if (!Array.isArray(publicTests) || publicTests.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No public tests found for this match setting' },
      });
    }

    if (!Array.isArray(privateTests) || privateTests.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No private tests found for this match setting' },
      });
    }

    // Execute public tests (for compilation check)
    let publicExecutionResult;
    try {
      publicExecutionResult = await executeCodeTests({
        code,
        language,
        testCases: publicTests,
        userId: req.user?.id,
      });
    } catch (error) {
      logger.error('Public tests execution error:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error while executing public tests' },
      });
    }

    // Execute private tests (for submission evaluation)
    let privateExecutionResult;
    try {
      privateExecutionResult = await executeCodeTests({
        code,
        language,
        testCases: privateTests,
        userId: req.user?.id,
      });
    } catch (error) {
      logger.error('Private tests execution error:', error);
      return res.status(500).json({
        success: false,
        error: { message: 'Error while executing private tests' },
      });
    }

    // Check compilation status from private tests
    const isCompiled = privateExecutionResult.isCompiled;
    if (!isCompiled) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            'Your code did not compile. Please fix compilation errors before submitting.',
        },
      });
    }

    // SAVE SUBMISSION
    const transaction = await sequelize.transaction();
    try {
      let submission = await Submission.findOne({
        where: { matchId },
        transaction,
      });

      if (submission) {
        submission.code = code;
        submission.submissions_count = (submission.submissions_count || 0) + 1;
        submission.updatedAt = new Date();
        await submission.save({ transaction });
      } else {
        submission = await Submission.create(
          {
            matchId,
            challengeParticipantId: match.challengeParticipantId,
            code,
            submissions_count: 1,
          },
          { transaction }
        );
      }

      await transaction.commit();

      logger.info(`Submission ${submission.id} saved for match ${matchId}`);

      // Build response without code field - explicitly exclude it
      const submissionData = submission.get({ plain: true });
      delete submissionData.code;

      return res.json({
        success: true,
        data: {
          submission: {
            id: submissionData.id,
            matchId: submissionData.matchId,
            challengeParticipantId: submissionData.challengeParticipantId,
            submissionsCount: submissionData.submissions_count,
            createdAt: submissionData.createdAt,
            updatedAt: submissionData.updatedAt,
          },
          publicTestResults: publicExecutionResult.testResults,
          privateTestResults: privateExecutionResult.testResults,
          publicSummary: publicExecutionResult.summary,
          privateSummary: privateExecutionResult.summary,
          isCompiled: privateExecutionResult.isCompiled,
          isPassed: privateExecutionResult.isPassed,
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

router.get('/submission/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(Number(id))) {
      return res.status(400).json({
        success: false,
        error: { message: 'Submission ID must be a number' },
      });
    }

    const submission = await Submission.findByPk(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: { message: `Submission with ID ${id} not found` },
      });
    }

    return res.json({
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
