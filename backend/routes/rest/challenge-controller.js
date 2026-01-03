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
import startChallengeService from '#root/services/start-challenge.js';
import { Op } from 'sequelize';

const router = Router();

const getRequestRole = (req) =>
  req.session?.user?.role || req.user?.role || null;
const isPrivilegedRole = (role) => role === 'teacher' || role === 'admin';
const shouldHidePrivate = (req) => !isPrivilegedRole(getRequestRole(req));

router.get('/challenges', async (req, res) => {
  try {
    const where = shouldHidePrivate(req)
      ? { status: { [Op.ne]: 'private' } }
      : undefined;
    const challenges = await Challenge.findAll({
      where,
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
    allowedNumberOfReview: req.body.allowedNumberOfReview || 5,
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

    // Validate matchSettingIds before checking overlaps
    // This ensures we return the correct error for invalid matchSettingIds
    const settings = await MatchSetting.findAll({
      where: { id: matchSettingIds },
    });
    if (settings.length !== matchSettingIds.length) {
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

    // Check for overlapping challenges
    const overlappingChallenge = await Challenge.findOne({
      where: {
        startDatetime: { [Op.lt]: payload.endDatetime },
        endDatetime: { [Op.gt]: payload.startDatetime },
      },
    });

    const allowOverlap = Boolean(req.body.allowOverlap);
    if (overlappingChallenge && !allowOverlap) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Challenge time overlaps with an existing challenge.',
          code: 'challenge_overlap',
        },
      });
    }
    if (overlappingChallenge && allowOverlap) {
      payload.status = 'private';
    }

    transaction = await sequelize.transaction();
    const challenge = await Challenge.create(payload, { transaction });
    await challenge.addMatchSettings(settings, { transaction });
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
    if (process.env.NODE_ENV !== 'test')
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

    if (status === 'challenge_private') {
      return res.status(403).json({
        success: false,
        error: 'Challenge is private',
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

    if (shouldHidePrivate(req)) {
      const challenge = await Challenge.findByPk(challengeId);
      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found',
        });
      }
      if (challenge.status === 'private') {
        return res.status(403).json({
          success: false,
          error: 'Challenge is private',
        });
      }
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
    if (result.status === 'too_early') {
      return res.status(400).json({
        success: false,
        error: 'Challenge cannot be assigned before its start time.',
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
    if (shouldHidePrivate(req) && challenge.status === 'private') {
      return res.status(403).json({
        success: false,
        error: 'Challenge is private',
      });
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
        startPhaseOneDateTime: challenge.startPhaseOneDateTime,
        duration: challenge.duration,
        allowedNumberOfReview: challenge.allowedNumberOfReview,
      },
      assignments: Object.values(grouped),
    });
  } catch (error) {
    handleException(res, error);
  }
});
router.post('/challenges/:challengeId/start', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid challengeId' });
    }

    const result = await startChallengeService({ challengeId });

    if (result.status === 'challenge_not_found') {
      return res
        .status(404)
        .json({ success: false, error: 'Challenge not found' });
    }

    if (result.status === 'invalid_status') {
      return res.status(409).json({
        success: false,
        error: 'Challenge must be assigned before it can be started.',
        currentStatus: result.challengeStatus,
      });
    }

    if (result.status === 'too_early') {
      return res.status(400).json({
        success: false,
        error: 'Challenge cannot be started before its start time.',
      });
    }

    if (result.status === 'no_participants') {
      return res.status(400).json({
        success: false,
        error: 'No participants joined. Challenge cannot be started.',
      });
    }

    if (result.status === 'no_matches') {
      return res.status(400).json({
        success: false,
        error: 'No matches assigned. Challenge cannot be started.',
      });
    }

    if (result.status === 'already_started') {
      return res.status(409).json({
        success: false,
        error: 'Challenge already started.',
      });
    }

    if (result.status === 'participants_error') {
      return res.status(500).json({
        success: false,
        error: 'Unable to load participants.',
      });
    }

    if (result.status !== 'ok') {
      //for any unexpected status that we dont know
      return res.status(500).json({
        success: false,
        error: 'Unknown error starting challenge.',
      });
    }

    const { challenge } = result;

    return res.json({
      success: true,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        status: challenge.status,
        startDatetime: challenge.startDatetime,
        duration: challenge.duration,
        startPhaseOneDateTime: challenge.startPhaseOneDateTime,
        endPhaseOneDateTime: challenge.endPhaseOneDateTime,
      },
    });
  } catch (error) {
    handleException(res, error);
  }
});
//read challenge data for joind student
router.get('/challenges/:challengeId/for-student', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid challengeId',
      });
    }

    const studentId = Number(req.query.studentId);
    if (!Number.isInteger(studentId) || studentId < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid studentId',
      });
    }

    // check the student actually joined
    const participation = await ChallengeParticipant.findOne({
      where: { challengeId, studentId },
    });
    if (!participation) {
      return res.status(403).json({
        success: false,
        error: 'Student has not joined this challenge',
      });
    }
    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found',
      });
    }
    if (shouldHidePrivate(req) && challenge.status === 'private') {
      return res.status(403).json({
        success: false,
        error: 'Challenge is private',
      });
    }
    return res.json({
      success: true,
      data: {
        id: challenge.id,
        status: challenge.status,
        startDatetime: challenge.startDatetime,
        duration: challenge.duration,
        startPhaseOneDateTime: challenge.startPhaseOneDateTime,
        title: challenge.title,
      },
    });
  } catch (error) {
    handleException(res, error);
  }
});
//read Match(assigned matchsettng for joind student)
router.get('/challenges/:challengeId/matchSetting', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    const studentId = Number(req.query.studentId);

    if (!challengeId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'challengeId and studentId are required',
      });
    }

    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found',
      });
    }
    if (shouldHidePrivate(req) && challenge.status === 'private') {
      return res.status(403).json({
        success: false,
        message: 'Challenge is private',
      });
    }

    const participant = await ChallengeParticipant.findOne({
      where: { challengeId, studentId },
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found for this challenge and student',
      });
    }

    const match = await Match.findOne({
      where: { challengeParticipantId: participant.id },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found for the given participant',
      });
    }
    const challengeMatchSetting = await ChallengeMatchSetting.findOne({
      where: {
        id: match.challengeMatchSettingId,
      },
    });

    if (!challengeMatchSetting) {
      return res.status(404).json({
        success: false,
        message: 'ChallengeMatchSetting not found for the given match',
      });
    }

    const matchSetting = await MatchSetting.findOne({
      where: { id: challengeMatchSetting.matchSettingId },
    });

    if (!matchSetting) {
      return res.status(404).json({
        success: false,
        message: 'MatchSetting not found for the given match',
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

//read Match(assigned match for joind student)
router.get('/challenges/:challengeId/match', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    const studentId = Number(req.query.studentId);
    if (!challengeId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'challengeId and studentId are required',
      });
    }

    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found',
      });
    }
    if (shouldHidePrivate(req) && challenge.status === 'private') {
      return res.status(403).json({
        success: false,
        message: 'Challenge is private',
      });
    }

    const participant = await ChallengeParticipant.findOne({
      where: { challengeId, studentId },
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found for this challenge and student',
      });
    }

    const match = await Match.findOne({
      where: { challengeParticipantId: participant.id },
    });

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found for the given participant',
      });
    }
    return res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    handleException(res, error);
  }
});
export default router;
