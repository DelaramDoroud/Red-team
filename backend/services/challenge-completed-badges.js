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
 * Count the number of challenges completed by a student.
 * A challenge is considered completed if:
 * - The submission status is either 'probably_correct' or 'improvable'
 * - The submission score is greater than 25
 */
export async function countCompletedChallenges(studentId) {
  const completedCount = await ChallengeParticipant.count({
    where: { studentId },
    include: [
      {
        model: Submission,
        as: 'submissions',
        required: true,
        where: {
          status: {
            [Op.in]: [
              SubmissionStatus.PROBABLY_CORRECT,
              SubmissionStatus.IMPROVABLE,
            ],
          },
        },
        include: [
          {
            model: SubmissionScoreBreakdown,
            as: 'scoreBreakdown',
            required: true,
            where: { totalScore: { [Op.gt]: 25 } }, // Only count submissions with totalScore > 25
          },
        ],
      },
    ],
  });

  logger.info(
    `Student ${studentId} has completed ${completedCount} challenges.`
  );
  return completedCount;
}

/**
 * Award milestone badges to a student if thresholds are reached.
 * Returns only badges that were just unlocked.
 */
export async function awardBadgeIfEligible(studentId) {
  // Count completed challenges
  const completedChallenges = await countCompletedChallenges(studentId);

  // Fetch all milestone badges that match the completed challenges count
  const milestoneBadges = await Badge.findAll({
    where: {
      category: BadgeCategory.CHALLENGE_MILESTONE,
      metric: BadgeMetric.CHALLENGES_COMPLETED,
      threshold: { [Op.lte]: completedChallenges }, // Threshold less than or equal to completed challenges
    },
    order: [['threshold', 'ASC']], // Process in ascending order of threshold
  });

  const unlockedBadges = [];

  for (const badge of milestoneBadges) {
    // Assign badge only if student hasn't earned it yet
    const [, created] = await StudentBadge.findOrCreate({
      where: { studentId, badgeId: badge.id },
      defaults: { earnedAt: new Date() },
    });

    if (created) {
      unlockedBadges.push(badge); // Keep the full badge object
    }
  }

  return {
    unlockedBadges, // Array of newly unlocked badges
    completedChallenges, // Total challenges completed by student
  };
}
