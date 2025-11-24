import { Router } from 'express';
import MatchSetting from '#root/models/match-setting.mjs';
import { handleException } from '#root/services/error.mjs';
import { MatchSettingStatus } from '../../models/enum/enums.js';

const router = Router();

router.get('/matchSettings', async (_req, res) => {
  try {
    const matchSettings = await MatchSetting.findAll();
    res.json({
      success: true,
      data: matchSettings,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.get('/matchSettingsReady', async (_req, res) => {
  try {
    const matchSettings = await MatchSetting.findAll({
      where: { status: MatchSettingStatus.READY }
    });
    res.json({
      success: true,
      data: matchSettings,
    });
  } catch (error) {
    handleException(res, error);
  }
});

export default router;


