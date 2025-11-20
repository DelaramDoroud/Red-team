import { Router } from 'express';
import sequelize from '#root/services/sequelize.mjs';
import Challenge, { validateChallengeData } from '#root/models/challenge.mjs';
import MatchSetting from '#root/models/match-setting.mjs';
import { handleException } from '#root/services/error.mjs';

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
        const missingIds = matchSettingIds.filter((id) => !foundIds.includes(id));
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

export default router;
