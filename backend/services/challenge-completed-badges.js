import { Op } from 'sequelize';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Submission from '#root/models/submission.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import Badge from '#root/models/badge.js';
import StudentBadge from '#root/models/student-badges.js';
import {
  SubmissionStatus,
  BadgeCategory,
  BadgeMetric,
} from '#root/models/enum/enums.js';
import logger from '#root/services/logger.js';

/**
 * Count the number of completed challenges for a student.
 *
 * A submission is considered valid if:
 * - status is PROBABLY_CORRECT or IMPROVABLE
 * - score breakdown exists (optionally filtered by totalScore)
 */

export async function countCompletedChallenges(studentId) {
  const completedCount = await Submission.count({
    distinct: true,
    include: [
      {
        model: ChallengeParticipant,
        as: 'challengeParticipant',
        required: true,
        where: { studentId },
      },
      {
        model: SubmissionScoreBreakdown,
        as: 'scoreBreakdown',
        required: false,
      },
    ],
    where: {
      status: {
        [Op.in]: [
          SubmissionStatus.PROBABLY_CORRECT,
          SubmissionStatus.IMPROVABLE,
        ],
      },
    },
  });

  logger.info(
    `Student ${studentId} completed submissions count: ${completedCount}`
  );

  return completedCount;
}

/**
 * Award milestone badges if challenge completion thresholds are reached.
 * Returns only newly unlocked badges.
 */
export async function awardBadgeIfEligible(studentId) {
  const completedChallenges = await countCompletedChallenges(studentId);

  logger.info(`completedChallenges: ${completedChallenges}`);
  const milestoneBadges = await Badge.findAll({
    where: {
      category: BadgeCategory.CHALLENGE_MILESTONE,
      metric: BadgeMetric.CHALLENGES_COMPLETED,
      threshold: { [Op.lte]: completedChallenges },
    },
    order: [['threshold', 'ASC']],
  });

  logger.info(`milestoneBadges: ${milestoneBadges}`);
  const unlockedBadges = [];

  for (const badge of milestoneBadges) {
    const [, created] = await StudentBadge.findOrCreate({
      where: { studentId, badgeId: badge.id },
      defaults: { earnedAt: new Date() },
    });

    logger.info(`created: ${created}`);
    if (created) {
      unlockedBadges.push(badge);
    }
  }

  return {
    unlockedBadges,
    completedChallenges,
  };
}
