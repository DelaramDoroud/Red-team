import { Router } from 'express';
import sequelize from '#root/services/sequelize.js';
import Challenge, { validateChallengeData } from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import User from '#root/models/user.js';
import { handleException } from '#root/services/error.js';
import getValidator from '#root/services/validator.js';
import {
  getChallengeParticipants,
  joinChallenge,
} from '#root/services/challenge-participant.js';
import assignMatches from '#root/services/assign-matches.js';
import { Op } from 'sequelize';

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
    res.json({ success: true, data: challenges });
  } catch (error) {
    handleException(res, error);
  }
});

router.post('/challenges', async (req, res) => {
  const payload = {
    title: req.body.title,
    duration: req.body.duration,
    startDatetime: req.body.startDatetime,
    endDatetime: req.body.endDatetime,
    durationPeerReview: req.body.durationPeerReview,
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

    // Check if duration fits within the time window
    const start = new Date(payload.startDatetime);
    const end = new Date(payload.endDatetime);
    const durationInMs = payload.duration * 60 * 1000; // duration is in minutes
    const windowInMs = end.getTime() - start.getTime();

    if (windowInMs < durationInMs) {
      return res.status(400).json({
        success: false,
        error: {
          message:
            'The time window (endDatetime - startDatetime) must be greater than or equal to the duration.',
        },
      });
    }

    // Check for overlapping challenges
    const overlappingChallenge = await Challenge.findOne({
      where: {
        startDatetime: { [Op.lt]: payload.endDatetime },
        endDatetime: { [Op.gt]: payload.startDatetime },
      },
    });

    if (overlappingChallenge) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Challenge time overlaps with an existing challenge.',
        },
      });
    }

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
    console.error('Create Challenge Error:', error);
    if (transaction) await transaction.rollback();
    handleException(res, error);
  }
});

const validateJoinChallenge = getValidator('join-challenge');
router.post('/challenges/:challengeId/join', async (req, res) => {
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

router.get('/challenges/:challengeId/participants', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid challengeId',
      });
    }

    const result = await getChallengeParticipants({ challengeId });

    if (result.status === 'error') {
      console.error('Error getting participants:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
      });
    }

    const data = result.participants || [];

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.post('/challenges/:challengeId/assign', async (req, res) => {
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
    if (result.status === 'too_early') {
      return res.status(400).json({
        success: false,
        error: 'The challenge start time has not been reached yet.',
      });
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

router.get('/challenges/:challengeId/matches', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid challengeId' });
    }

    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      return res
        .status(404)
        .json({ success: false, error: 'Challenge not found' });
    }

    const matches = await Match.findAll({
      include: [
        {
          model: ChallengeMatchSetting,
          as: 'challengeMatchSetting',
          where: { challengeId },
          include: [{ model: MatchSetting, as: 'matchSetting' }],
        },
        {
          model: ChallengeParticipant,
          as: 'challengeParticipant',
          include: [{ model: User, as: 'student' }],
        },
      ],
      order: [
        ['id', 'ASC'],
        [{ model: ChallengeMatchSetting, as: 'challengeMatchSetting' }, 'id'],
      ],
    });

    const grouped = {};
    matches.forEach((matchRow) => {
      const cmsId = matchRow.challengeMatchSettingId;
      if (!grouped[cmsId]) {
        grouped[cmsId] = {
          challengeMatchSettingId: cmsId,
          matchSetting: matchRow.challengeMatchSetting?.matchSetting
            ? {
                id: matchRow.challengeMatchSetting.matchSetting.id,
                problemTitle:
                  matchRow.challengeMatchSetting.matchSetting.problemTitle,
              }
            : null,
          matches: [],
        };
      }

      grouped[cmsId].matches.push({
        id: matchRow.id,
        student: matchRow.challengeParticipant?.student
          ? {
              id: matchRow.challengeParticipant.student.id,
              username: matchRow.challengeParticipant.student.username,
            }
          : null,
      });
    });

    return res.json({
      success: true,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
        startDatetime: challenge.startDatetime,
        duration: challenge.duration,
      },
      assignments: Object.values(grouped),
    });
  } catch (error) {
    handleException(res, error);
  }
});

export default router;
