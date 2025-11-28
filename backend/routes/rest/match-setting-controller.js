import { Router } from 'express';
import MatchSetting from '#root/models/match-setting.js';
import { handleException } from '#root/services/error.js';

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
export default router;
