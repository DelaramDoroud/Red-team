import { Router } from 'express';
import sequelize from '#root/services/sequelize.js';
import Challenge, { validateChallengeData } from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import User from '#root/models/user.js';
import Submission from '#root/models/submission.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import { ChallengeStatus, SubmissionStatus } from '#root/models/enum/enums.js';
import { handleException } from '#root/services/error.js';
import getValidator from '#root/services/validator.js';
import {
  getChallengeParticipants,
  joinChallenge,
} from '#root/services/challenge-participant.js';
import assignMatches from '#root/services/assign-matches.js';
import startChallengeService from '#root/services/start-challenge.js';
import startPeerReviewService from '#root/services/start-peer-review.js';
import assignPeerReviews from '#root/services/assign-peer-reviews.js';
import { broadcastEvent } from '#root/services/event-stream.js';
import { schedulePhaseOneEndForChallenge } from '#root/services/challenge-scheduler.js';
import { Op } from 'sequelize';
import getPeerReviewSummary from '#root/services/peer-review-summary.js';

const router = Router();

const getRequestRole = (req) =>
  req.session?.user?.role || req.user?.role || null;
const isPrivilegedRole = (role) => role === 'teacher' || role === 'admin';
const shouldHidePrivate = (req) => !isPrivilegedRole(getRequestRole(req));
const emitChallengeUpdate = (challenge) => {
  if (!challenge) return;
  broadcastEvent({
    event: 'challenge-updated',
    data: {
      challengeId: challenge.id,
      status: challenge.status,
    },
  });
};

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
  const trimmedTitle =
    typeof req.body.title === 'string' ? req.body.title.trim() : req.body.title;
  const payload = {
    title: trimmedTitle,
    duration: req.body.duration,
    startDatetime: req.body.startDatetime,
    endDatetime: req.body.endDatetime,
    durationPeerReview: req.body.durationPeerReview,
    allowedNumberOfReview: req.body.allowedNumberOfReview ?? 5,
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
    emitChallengeUpdate(createdChallenge);
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

    if (status === 'ok') {
      const participantsCount = await ChallengeParticipant.count({
        where: { challengeId },
      });
      broadcastEvent({
        event: 'challenge-participant-joined',
        data: {
          challengeId,
          count: participantsCount,
        },
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

    const updatedChallenge = await Challenge.findByPk(challengeId);
    emitChallengeUpdate(updatedChallenge);
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

    const matchIds = matches.map((matchRow) => matchRow.id);
    const matchSettingByMatchId = new Map(
      matches.map((matchRow) => [matchRow.id, matchRow.challengeMatchSettingId])
    );
    const participantById = new Map();
    matches.forEach((matchRow) => {
      const student = matchRow.challengeParticipant?.student;
      if (!student) return;
      participantById.set(matchRow.challengeParticipantId, {
        participantId: matchRow.challengeParticipantId,
        studentId: student.id,
        username: student.username,
      });
    });

    const validSubmissionCounts = {};
    const validSubmissionIds = [];
    let totalSubmissionsCount = 0;

    if (matchIds.length > 0) {
      totalSubmissionsCount = await Submission.count({
        where: {
          matchId: { [Op.in]: matchIds },
          isFinal: true,
        },
      });

      const validSubmissions = await Submission.findAll({
        attributes: ['id', 'matchId', 'challengeParticipantId'],
        where: {
          matchId: { [Op.in]: matchIds },
          isFinal: true,
          status: {
            [Op.in]: [
              SubmissionStatus.IMPROVABLE,
              SubmissionStatus.PROBABLY_CORRECT,
            ],
          },
        },
        raw: true,
      });

      validSubmissions.forEach(({ id, matchId }) => {
        const cmsId = matchSettingByMatchId.get(matchId);
        if (!cmsId) return;
        validSubmissionIds.push(id);
        validSubmissionCounts[cmsId] = (validSubmissionCounts[cmsId] || 0) + 1;
      });
    }

    const peerReviewAssignmentsByCms = {};
    const peerReviewAssignmentsCountByCms = {};

    if (validSubmissionIds.length > 0) {
      const peerAssignments = await PeerReviewAssignment.findAll({
        where: { submissionId: { [Op.in]: validSubmissionIds } },
        include: [
          {
            model: Submission,
            as: 'submission',
            attributes: ['id', 'matchId', 'challengeParticipantId'],
          },
          {
            model: ChallengeParticipant,
            as: 'reviewer',
            attributes: ['id'],
            include: [
              { model: User, as: 'student', attributes: ['id', 'username'] },
            ],
          },
        ],
      });

      const reviewerMaps = new Map();

      peerAssignments.forEach((assignment) => {
        const submission = assignment.submission;
        if (!submission) return;
        const cmsId = matchSettingByMatchId.get(submission.matchId);
        if (!cmsId) return;

        if (!reviewerMaps.has(cmsId)) {
          reviewerMaps.set(cmsId, new Map());
        }

        const reviewerMap = reviewerMaps.get(cmsId);
        const reviewerParticipantId = assignment.reviewerId;
        const reviewerInfo = participantById.get(reviewerParticipantId) || {
          participantId: reviewerParticipantId,
          studentId: assignment.reviewer?.student?.id ?? null,
          username:
            assignment.reviewer?.student?.username ||
            `Student ${reviewerParticipantId}`,
        };

        if (!reviewerMap.has(reviewerParticipantId)) {
          reviewerMap.set(reviewerParticipantId, {
            reviewer: reviewerInfo,
            reviewees: [],
          });
        }

        const revieweeInfo = participantById.get(
          submission.challengeParticipantId
        ) || {
          participantId: submission.challengeParticipantId,
          studentId: null,
          username: `Student ${submission.challengeParticipantId}`,
        };

        reviewerMap.get(reviewerParticipantId).reviewees.push({
          ...revieweeInfo,
          submissionId: submission.id,
          isExtra: assignment.isExtra,
        });

        peerReviewAssignmentsCountByCms[cmsId] =
          (peerReviewAssignmentsCountByCms[cmsId] || 0) + 1;
      });

      reviewerMaps.forEach((reviewerMap, cmsId) => {
        peerReviewAssignmentsByCms[cmsId] = Array.from(reviewerMap.values());
      });
    }

    const eligibleGroupIds = Object.entries(validSubmissionCounts)
      .filter(([, count]) => count > 1)
      .map(([cmsId]) => Number(cmsId));
    const peerReviewReady =
      eligibleGroupIds.length > 0 &&
      eligibleGroupIds.every(
        (cmsId) => (peerReviewAssignmentsCountByCms[cmsId] || 0) > 0
      );
    const totalValidSubmissions = validSubmissionIds.length;

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
          validSubmissionsCount: validSubmissionCounts[cmsId] || 0,
          peerReviewAssignments: peerReviewAssignmentsByCms[cmsId] || [],
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
        endPhaseOneDateTime: challenge.endPhaseOneDateTime,
        startPhaseTwoDateTime: challenge.startPhaseTwoDateTime,
        endPhaseTwoDateTime: challenge.endPhaseTwoDateTime,
        duration: challenge.duration,
        durationPeerReview: challenge.durationPeerReview,
        allowedNumberOfReview: challenge.allowedNumberOfReview,
        validSubmissionsCount: totalValidSubmissions,
        totalSubmissionsCount,
        peerReviewReady,
      },
      assignments: Object.values(grouped),
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.patch('/challenges/:challengeId/expected-reviews', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid challengeId' });
    }

    const expectedReviews = Number(
      req.body?.expectedReviewsPerSubmission ?? req.body?.allowedNumberOfReview
    );
    if (!Number.isInteger(expectedReviews) || expectedReviews < 2) {
      return res.status(400).json({
        success: false,
        error:
          'Expected reviews per submission must be an integer greater than or equal to 2.',
      });
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

    if (
      challenge.status === ChallengeStatus.STARTED_PHASE_TWO ||
      challenge.status === ChallengeStatus.ENDED_PHASE_TWO
    ) {
      return res.status(409).json({
        success: false,
        error: 'Expected reviews cannot be updated after peer review starts.',
        currentStatus: challenge.status,
      });
    }

    if (challenge.allowedNumberOfReview !== expectedReviews) {
      await challenge.update({ allowedNumberOfReview: expectedReviews });
    }

    return res.json({
      success: true,
      challenge: {
        id: challenge.id,
        allowedNumberOfReview: challenge.allowedNumberOfReview,
        status: challenge.status,
      },
    });
  } catch (error) {
    handleException(res, error);
  }
});

router.post(
  '/challenges/:challengeId/peer-reviews/assign',
  async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }

      const expectedReviews =
        req.body?.expectedReviewsPerSubmission ??
        req.body?.allowedNumberOfReview;

      const result = await assignPeerReviews({
        challengeId,
        expectedReviewsPerSubmission: expectedReviews,
      });

      if (result.status === 'invalid_expected_reviews') {
        return res.status(400).json({
          success: false,
          error:
            'Expected reviews per submission must be an integer greater than or equal to 2.',
        });
      }

      if (result.status === 'challenge_not_found') {
        return res
          .status(404)
          .json({ success: false, error: 'Challenge not found' });
      }

      if (result.status === 'invalid_status') {
        return res.status(409).json({
          success: false,
          error: 'Peer review can only be assigned after coding ends.',
          currentStatus: result.challengeStatus,
        });
      }

      if (result.status === 'no_matches') {
        return res.status(400).json({
          success: false,
          error: 'No matches assigned for this challenge.',
        });
      }

      if (result.status !== 'ok') {
        return res.status(500).json({
          success: false,
          error: 'Unable to assign peer reviews.',
        });
      }

      return res.json({ success: true, ...result });
    } catch (error) {
      handleException(res, error);
    }
  }
);

router.get(
  '/challenges/:challengeId/peer-reviews/for-student',
  async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      const studentId = Number(req.query.studentId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }
      if (!Number.isInteger(studentId) || studentId < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid studentId',
        });
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

      const participant = await ChallengeParticipant.findOne({
        where: { challengeId, studentId },
      });
      if (!participant) {
        return res.status(404).json({
          success: false,
          error: 'Participant not found for this challenge and student',
        });
      }

      const assignments = await PeerReviewAssignment.findAll({
        where: { reviewerId: participant.id },
        include: [
          {
            model: Submission,
            as: 'submission',
            attributes: ['id', 'code', 'matchId', 'challengeParticipantId'],
            include: [
              {
                model: Match,
                as: 'match',
                attributes: ['id', 'challengeMatchSettingId'],
                include: [
                  {
                    model: ChallengeMatchSetting,
                    as: 'challengeMatchSetting',
                    attributes: ['id'],
                    where: { challengeId },
                  },
                ],
              },
              {
                model: ChallengeParticipant,
                as: 'challengeParticipant',
                attributes: ['id'],
                include: [
                  {
                    model: User,
                    as: 'student',
                    attributes: ['id', 'username'],
                  },
                ],
              },
            ],
          },
        ],
      });

      const assignmentItems = assignments
        .filter((assignment) => assignment.submission)
        .map((assignment) => ({
          id: assignment.id,
          submissionId: assignment.submission.id,
          code: assignment.submission.code,
          matchId: assignment.submission.matchId,
          isExtra: assignment.isExtra,
          author: assignment.submission.challengeParticipant?.student
            ? {
                id: assignment.submission.challengeParticipant.student.id,
                username:
                  assignment.submission.challengeParticipant.student.username,
              }
            : null,
        }));

      return res.json({
        success: true,
        challenge: {
          id: challenge.id,
          status: challenge.status,
          startPhaseTwoDateTime: challenge.startPhaseTwoDateTime,
          endPhaseTwoDateTime: challenge.endPhaseTwoDateTime,
          durationPeerReview: challenge.durationPeerReview,
        },
        assignments: assignmentItems,
      });
    } catch (error) {
      handleException(res, error);
    }
  }
);
router.get(
  '/challenges/:challengeId/peer-reviews/summary',
  async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      const studentId = Number(req.query.studentId);

      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }
      if (!Number.isInteger(studentId) || studentId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid studentId' });
      }

      const result = await getPeerReviewSummary({ challengeId, studentId });

      if (result.status === 'challenge_not_found') {
        return res
          .status(404)
          .json({ success: false, error: 'Challenge not found' });
      }
      if (result.status === 'participant_not_found') {
        return res
          .status(404)
          .json({ success: false, error: 'Participant not found' });
      }

      return res.json({ success: true, summary: result.summary });
    } catch (error) {
      handleException(res, error);
    }
  }
);

router.post('/challenges/:challengeId/peer-reviews/start', async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!Number.isInteger(challengeId) || challengeId < 1) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid challengeId' });
    }

    const result = await startPeerReviewService({ challengeId });

    if (result.status === 'challenge_not_found') {
      return res
        .status(404)
        .json({ success: false, error: 'Challenge not found' });
    }

    if (result.status === 'invalid_status') {
      return res.status(409).json({
        success: false,
        error: 'Peer review can only start after phase one ends.',
        currentStatus: result.challengeStatus,
      });
    }

    if (result.status === 'already_started') {
      return res.status(409).json({
        success: false,
        error: 'Peer review already started.',
      });
    }

    if (result.status === 'no_matches') {
      return res.status(400).json({
        success: false,
        error: 'No matches assigned for this challenge.',
      });
    }

    if (result.status === 'insufficient_valid_submissions') {
      return res.status(400).json({
        success: false,
        error:
          'Peer review cannot start because there are not enough valid submissions.',
      });
    }

    if (result.status === 'no_assignments') {
      return res.status(400).json({
        success: false,
        error:
          'Peer review cannot start because review assignments are missing.',
      });
    }

    if (result.status !== 'ok') {
      return res.status(500).json({
        success: false,
        error: 'Unable to start peer review.',
      });
    }

    const { challenge: updatedChallenge } = result;
    emitChallengeUpdate(updatedChallenge);

    return res.json({
      success: true,
      challenge: {
        id: updatedChallenge.id,
        title: updatedChallenge.title,
        status: updatedChallenge.status,
        startPhaseTwoDateTime: updatedChallenge.startPhaseTwoDateTime,
        endPhaseTwoDateTime: updatedChallenge.endPhaseTwoDateTime,
        durationPeerReview: updatedChallenge.durationPeerReview,
      },
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
    await schedulePhaseOneEndForChallenge(challenge);
    emitChallengeUpdate(challenge);

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
        startPhaseTwoDateTime: challenge.startPhaseTwoDateTime,
        endPhaseTwoDateTime: challenge.endPhaseTwoDateTime,
        durationPeerReview: challenge.durationPeerReview,
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

    const matchRows = await Match.findAll({
      attributes: ['id'],
      where: { challengeMatchSettingId: challengeMatchSetting.id },
      raw: true,
    });
    const matchIds = matchRows.map((row) => row.id);
    let validSubmissionsCount = 0;
    if (matchIds.length > 0) {
      validSubmissionsCount = await Submission.count({
        where: {
          matchId: { [Op.in]: matchIds },
          isFinal: true,
          status: {
            [Op.in]: [
              SubmissionStatus.IMPROVABLE,
              SubmissionStatus.PROBABLY_CORRECT,
            ],
          },
        },
      });
    }

    const peerReviewBlocked =
      challenge.status === ChallengeStatus.ENDED_PHASE_ONE &&
      validSubmissionsCount <= 1;
    const peerReviewBlockedMessage = peerReviewBlocked
      ? 'Thanks for your effort. Peer review will not start because there are not enough submissions to review.'
      : null;

    return res.json({
      success: true,
      data: {
        ...matchSetting.toJSON(),
        validSubmissionsCount,
        peerReviewBlockedMessage,
      },
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
