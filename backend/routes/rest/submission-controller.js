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

/**
 * Compare two submissions based on test results
 * Returns true if submission1 is strictly better than submission2
 * @param {Object} sub1 - First submission test results { publicPassed, publicTotal, privatePassed, privateTotal }
 * @param {Object} sub2 - Second submission test results { publicPassed, publicTotal, privatePassed, privateTotal }
 * @returns {boolean} True if sub1 is strictly better than sub2
 */
function isSubmissionBetter(sub1, sub2) {
  const sub1TotalPassed = (sub1.publicPassed || 0) + (sub1.privatePassed || 0);
  const sub2TotalPassed = (sub2.publicPassed || 0) + (sub2.privatePassed || 0);

  // Strictly better means more total tests passed
  return sub1TotalPassed > sub2TotalPassed;
}

router.post('/submissions', async (req, res) => {
  try {
    const { matchId, code, language = 'cpp', isAutomatic = false } = req.body;

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

    // Calculate test results for comparison
    const currentTestResults = {
      publicPassed: publicExecutionResult.summary.passed || 0,
      publicTotal: publicExecutionResult.summary.total || 0,
      privatePassed: privateExecutionResult.summary.passed || 0,
      privateTotal: privateExecutionResult.summary.total || 0,
    };

    // SAVE SUBMISSION
    const transaction = await sequelize.transaction();
    try {
      let submission = await Submission.findOne({
        where: { matchId },
        transaction,
      });

      let shouldSaveSubmission = true;

      // If this is an automatic submission and there's an existing submission
      if (isAutomatic && submission) {
        // Check if existing submission has stored test results
        // For now, we'll assume existing submission is intentional
        // and compare test results

        // Try to get stored test results from submission metadata
        // If not available, we need to re-run tests on existing code (expensive)
        // For now, we'll re-run tests to compare properly
        try {
          const existingCode = submission.code;

          // Re-run tests on existing submission code for comparison
          const existingPublicResult = await executeCodeTests({
            code: existingCode,
            language,
            testCases: publicTests,
            userId: req.user?.id,
          });

          const existingPrivateResult = await executeCodeTests({
            code: existingCode,
            language,
            testCases: privateTests,
            userId: req.user?.id,
          });

          const existingTestResults = {
            publicPassed: existingPublicResult.summary.passed || 0,
            publicTotal: existingPublicResult.summary.total || 0,
            privatePassed: existingPrivateResult.summary.passed || 0,
            privateTotal: existingPrivateResult.summary.total || 0,
          };

          // Compare: only update if automatic submission is strictly better
          if (isSubmissionBetter(currentTestResults, existingTestResults)) {
            // Automatic submission is better - update it
            submission.code = code;
            submission.submissions_count =
              (submission.submissions_count || 0) + 1;
            submission.updatedAt = new Date();
            await submission.save({ transaction });
            logger.info(
              `Automatic submission is better for match ${matchId}, updating submission`
            );
          } else {
            // Keep existing submission (intentional submission is better or equal)
            shouldSaveSubmission = false;
            logger.info(
              `Existing submission is better or equal for match ${matchId}, keeping it`
            );
            // Use existing submission for response
          }
        } catch (error) {
          logger.error('Error comparing submissions:', error);
          // On error, keep existing submission
          shouldSaveSubmission = false;
        }
      } else if (!isAutomatic) {
        // Intentional submission - always save/update
        if (submission) {
          submission.code = code;
          submission.submissions_count =
            (submission.submissions_count || 0) + 1;
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
      } else if (isAutomatic && !submission) {
        // Automatic submission, no existing submission - create it (Rule 1)
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

      // If we didn't save the submission (automatic was not better), re-run tests on existing code
      let finalPublicResults = publicExecutionResult;
      let finalPrivateResults = privateExecutionResult;

      if (!shouldSaveSubmission && submission) {
        // Re-run tests on existing submission to get its test results for response
        try {
          finalPublicResults = await executeCodeTests({
            code: submission.code,
            language,
            testCases: publicTests,
            userId: req.user?.id,
          });

          finalPrivateResults = await executeCodeTests({
            code: submission.code,
            language,
            testCases: privateTests,
            userId: req.user?.id,
          });
        } catch (error) {
          logger.error('Error re-running tests on existing submission:', error);
          // Use current test results as fallback
        }
      }

      await transaction.commit();

      if (shouldSaveSubmission || !submission) {
        logger.info(`Submission ${submission.id} saved for match ${matchId}`);
      } else {
        logger.info(
          `Keeping existing submission ${submission.id} for match ${matchId}`
        );
      }

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
          publicTestResults: finalPublicResults.testResults,
          privateTestResults: finalPrivateResults.testResults,
          publicSummary: finalPublicResults.summary,
          privateSummary: finalPrivateResults.summary,
          isCompiled: finalPrivateResults.isCompiled,
          isPassed: finalPrivateResults.isPassed,
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
