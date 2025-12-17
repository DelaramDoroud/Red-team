import { Router } from 'express';
import MatchSetting from '#root/models/match-setting.js';
import { MatchSettingStatus } from '#root/models/enum/enums.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
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

router.get('/matchSettingsReady', async (_req, res) => {
  try {
    const matchSettings = await MatchSetting.findAll({
      where: { status: MatchSettingStatus.READY },
    });
    res.json({
      success: true,
      data: matchSettings,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.post('/matchSettingsByParticipant', async (req, res) => {
  try {
    const { participantId } = req.body;
    const match = await Match.findOne({
      where: { challengeParticipantId: participantId },
    });
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found for the given participant ID',
      });
    }
    const challenge_matchSetting = await ChallengeMatchSetting.findOne({
      where: { id: match.challengeMatchSettingId },
    });
    if (!challenge_matchSetting) {
      return res.status(404).json({
        success: false,
        message: 'ChallengeMatchSetting not found for the given match',
      });
    }
    const matchSetting = await MatchSetting.findOne({
      where: { id: challenge_matchSetting.matchSettingId },
    });
    if (!matchSetting) {
      return res.status(404).json({
        success: false,
        message: 'MatchSetting not found for the given match',
      });
    }
    res.json({
      success: true,
      data: matchSetting,
    });
  } catch (error) {
    handleException(res, error);
  }
});
export default router;
