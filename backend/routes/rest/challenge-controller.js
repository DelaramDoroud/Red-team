import { Router } from 'express';
import sequelize from '#root/services/sequelize.js';
import Challenge, { validateChallengeData } from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import { handleException } from '#root/services/error.js';
import getValidator from '#root/services/validator.js';
import joinChallenge from '#root/services/challenge-participant.js';
import assignMatches from '#root/services/assign-matches.js';

const router = Router();

router.get('/challenges', async (_req, res) => {
  try {
    const challenges = await Challenge.findAll({
      include: [
        {
          model: MatchSetting,
          as: 'matchSettings',
          through: { attributes: [] },
        },
      ],
      order: Challenge.getDefaultOrder(),
    });

    res.json({ success: true, challenges });
  } catch (error) {
    handleException(res, error);
  }
});

router.post('/challenge', async (req, res) => {
  const payload = {
    title: req.body.title,
    duration: req.body.duration,
    startDatetime: req.body.startDatetime,
    endDatetime: req.body.endDatetime,
    peerReviewStartDate: req.body.peerReviewStartDate,
    peerReviewEndDate: req.body.peerReviewEndDate,
    allowedNumberOfReview: req.body.allowedNumberOfReview || 0,
    status: req.body.status || 'private',
  };

  const matchSettingIds = req.body.matchSettingIds || [];

  if (matchSettingIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: { message: 'At least one match setting is required.' },
    });
  }

  let transaction;

  try {
    await validateChallengeData(payload, {
      validatorKey: 'challenge',
    });

    transaction = await sequelize.transaction();

    const challenge = await Challenge.create(payload, { transaction });

    if (matchSettingIds.length > 0) {
      const settings = await MatchSetting.findAll({
        where: { id: matchSettingIds },
        transaction,
      });

      if (settings.length !== matchSettingIds.length) {
        await transaction.rollback();
        const foundIds = settings.map((s) => s.id);
        const missingIds = matchSettingIds.filter(
          (id) => !foundIds.includes(id)
        );
        return res.status(400).json({
          success: false,
          error: {
            message: 'One or more match settings not found.',
            missingIds,
          },
        });
      }

      await challenge.addMatchSettings(settings, { transaction });
    }

    // 5) Commit
    await transaction.commit();

    const createdChallenge = await Challenge.findByPk(challenge.id, {
      include: [
        {
          model: MatchSetting,
          as: 'matchSettings',
          through: { attributes: [] },
        },
      ],
    });

    res.status(201).json({
      success: true,
      challenge: createdChallenge,
    });
  } catch (error) {
    console.error('Create Challenge Error:', error); // <--- Added log
    if (transaction) await transaction.rollback();
    handleException(res, error);
  }
});

const validateJoinChallenge = getValidator('join-challenge');
router.post('/challenge/:challengeId/join', async (req, res) => {
  try {
    if (!validateJoinChallenge) {
      return res.status(500).json({
        success: false,
        error: 'Join-challenge validator not found',
      });
    }
    const valid = validateJoinChallenge(req.body);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid join payload',
        details: validateJoinChallenge.errors,
      });
    }

    const { studentId } = req.body;

    const { challengeId: rawChallengeId } = req.params;

    const challengeId = Number(rawChallengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid challengeId',
      });
    }
    const { status, participation } = await joinChallenge({
      studentId: Number(studentId),
      challengeId,
    });

    if (status === 'challenge_not_found') {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found',
      });
    }

    if (status === 'student_not_found') {
      return res.status(404).json({
        success: false,
        error: 'Student not found',
      });
    }

    if (status === 'already_joined') {
      return res.status(409).json({
        success: false,
        error: 'Student already joined this challenge',
      });
    }

    return res.json({
      success: true,
      result: participation,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.post('/challenge/:challengeId/assign', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid challengeId' });
    }

    const overwrite =
      String(req.query.overwrite || '').toLowerCase() === 'true';
    const result = await assignMatches({ challengeId, overwrite });

    if (result.status === 'challenge_not_found') {
      return res
        .status(404)
        .json({ success: false, error: 'Challenge not found' });
    }
    if (result.status === 'no_match_settings') {
      return res.status(400).json({
        success: false,
        error: 'No match settings selected for this challenge',
      });
    }
    if (result.status === 'no_participants') {
      return res
        .status(400)
        .json({ success: false, error: 'No participants joined' });
    }
    if (result.status === 'already_assigned' && !overwrite) {
      return res.status(409).json({
        success: false,
        error: 'Assignments already exist. Use ?overwrite=true to reassign.',
      });
    }

    return res.json({ success: true, ...result });
  } catch (error) {
    handleException(res, error);
  }
});

export default router;
