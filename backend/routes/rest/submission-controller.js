import { Router } from 'express';
import axios from 'axios';

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

    // RUN COMPILATION CHECK
    let runResponse;
    try {
      runResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/rest'}/run`,
        { matchSettingId: matchSetting.id, code, language },
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
      );
    } catch (err) {
      logger.error('Run API error:', err?.response?.data || err.message);
      return res.status(500).json({
        success: false,
        error: { message: 'Error while executing code for compilation check' },
      });
    }

    // Check compilation: exitCode !== 0 or stderr contains "error"
    const compilationFailed = runResponse.data.results?.some(
      (r) =>
        r.exitCode !== 0 ||
        (r.stderr && r.stderr.toLowerCase().includes('error'))
    );

    if (compilationFailed) {
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
