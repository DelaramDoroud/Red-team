import { Router } from 'express';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import { MatchSettingStatus } from '#root/models/enum/enums.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';
import { handleException } from '#root/services/error.js';
import { executeCodeTests } from '#root/services/execute-code-tests.js';
import { requirePrivilegedUser } from '#root/services/request-auth.js';
import {
  buildDuplicateTitle,
  buildPublishFailureMessage,
  hasOwn,
  isBlank,
  normalizeTests,
  normalizeText,
  validatePublishRequirements,
} from './match-setting/shared.js';

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

router.get('/matchSettings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const matchSettingId = Number(id);
    if (!matchSettingId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Match setting ID is required' },
      });
    }

    const matchSetting = await MatchSetting.findByPk(matchSettingId);
    if (!matchSetting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Match setting not found' },
      });
    }

    return res.json({
      success: true,
      data: matchSetting,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.post('/matchSettings', requirePrivilegedUser, async (req, res) => {
  try {
    const {
      problemTitle,
      problemDescription,
      referenceSolution,
      publicTests,
      privateTests,
    } = req.body;

    if (isBlank(problemTitle)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Match setting name is required.' },
      });
    }

    const matchSetting = await MatchSetting.create({
      problemTitle: problemTitle.trim(),
      problemDescription: normalizeText(problemDescription),
      referenceSolution: normalizeText(referenceSolution),
      publicTests: normalizeTests(publicTests),
      privateTests: normalizeTests(privateTests),
      status: MatchSettingStatus.DRAFT,
    });

    return res.status(201).json({
      success: true,
      data: matchSetting,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.put('/matchSettings/:id', requirePrivilegedUser, async (req, res) => {
  try {
    const { id } = req.params;
    const matchSettingId = Number(id);
    if (!matchSettingId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Match setting ID is required' },
      });
    }

    const matchSetting = await MatchSetting.findByPk(matchSettingId);
    if (!matchSetting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Match setting not found' },
      });
    }

    if (matchSetting.status === MatchSettingStatus.READY) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Unpublish this match setting before editing.',
        },
      });
    }

    const updates = {};

    const {
      problemTitle,
      problemDescription,
      referenceSolution,
      publicTests,
      privateTests,
    } = req.body;

    if (hasOwn(req.body, 'problemTitle')) {
      if (isBlank(problemTitle)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Match setting name is required.' },
        });
      }
      updates.problemTitle = problemTitle.trim();
    }

    if (hasOwn(req.body, 'problemDescription')) {
      updates.problemDescription = normalizeText(problemDescription);
    }

    if (hasOwn(req.body, 'referenceSolution')) {
      updates.referenceSolution = normalizeText(referenceSolution);
    }

    if (hasOwn(req.body, 'publicTests')) {
      updates.publicTests = normalizeTests(publicTests);
    }

    if (hasOwn(req.body, 'privateTests')) {
      updates.privateTests = normalizeTests(privateTests);
    }

    const updated = await matchSetting.update(updates);

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.post(
  '/matchSettings/:id/publish',
  requirePrivilegedUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const matchSettingId = Number(id);
      if (!matchSettingId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Match setting ID is required' },
        });
      }

      const matchSetting = await MatchSetting.findByPk(matchSettingId);
      if (!matchSetting) {
        return res.status(404).json({
          success: false,
          error: { message: 'Match setting not found' },
        });
      }

      const validationError = validatePublishRequirements(matchSetting);
      if (validationError) {
        return res.status(400).json({
          success: false,
          error: { message: validationError },
        });
      }

      const language = 'cpp';
      const publicTests = normalizeTests(matchSetting.publicTests);
      const privateTests = normalizeTests(matchSetting.privateTests);
      const code = matchSetting.referenceSolution;

      const publicResult = await executeCodeTests({
        code,
        language,
        testCases: publicTests,
        userId: req.user?.id,
      });

      if (!publicResult.isPassed) {
        return res.status(400).json({
          success: false,
          error: {
            message: buildPublishFailureMessage({
              visibilityLabel: 'public',
              executionResult: publicResult,
              language,
            }),
          },
        });
      }

      const privateResult = await executeCodeTests({
        code,
        language,
        testCases: privateTests,
        userId: req.user?.id,
      });

      if (!privateResult.isPassed) {
        return res.status(400).json({
          success: false,
          error: {
            message: buildPublishFailureMessage({
              visibilityLabel: 'private',
              executionResult: privateResult,
              language,
            }),
          },
        });
      }

      const updated = await matchSetting.update({
        status: MatchSettingStatus.READY,
      });

      return res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      handleException(res, error);
    }
  }
);

router.post(
  '/matchSettings/:id/unpublish',
  requirePrivilegedUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const matchSettingId = Number(id);
      if (!matchSettingId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Match setting ID is required' },
        });
      }

      const matchSetting = await MatchSetting.findByPk(matchSettingId);
      if (!matchSetting) {
        return res.status(404).json({
          success: false,
          error: { message: 'Match setting not found' },
        });
      }

      const updated = await matchSetting.update({
        status: MatchSettingStatus.DRAFT,
      });

      return res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      handleException(res, error);
    }
  }
);

router.post(
  '/matchSettings/:id/duplicate',
  requirePrivilegedUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const matchSettingId = Number(id);
      if (!matchSettingId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Match setting ID is required' },
        });
      }

      const matchSetting = await MatchSetting.findByPk(matchSettingId);
      if (!matchSetting) {
        return res.status(404).json({
          success: false,
          error: { message: 'Match setting not found' },
        });
      }

      const duplicateTitle = await buildDuplicateTitle(
        matchSetting.problemTitle
      );

      const duplicated = await MatchSetting.create({
        problemTitle: duplicateTitle,
        problemDescription: normalizeText(matchSetting.problemDescription),
        referenceSolution: normalizeText(matchSetting.referenceSolution),
        publicTests: normalizeTests(matchSetting.publicTests),
        privateTests: normalizeTests(matchSetting.privateTests),
        status: MatchSettingStatus.DRAFT,
      });

      return res.status(201).json({
        success: true,
        data: duplicated,
      });
    } catch (error) {
      handleException(res, error);
    }
  }
);
export default router;
