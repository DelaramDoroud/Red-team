import { Op } from 'sequelize';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
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

/* ------------------------------------------------------------------ */
/* Count the number of completed challenges for a student */
export async function countCompletedChallenges(studentId) {
  const completedCount = await ChallengeParticipant.count({
    where: { studentId },
    include: [
      {
        model: Match,
        as: 'match',
        required: true,
        include: [
          {
            model: Submission,
            as: 'submissions',
            required: true,
            where: {
              isFinal: true,
              status: {
                [Op.in]: [
                  SubmissionStatus.IMPROVABLE,
                  SubmissionStatus.PROBABLY_CORRECT,
                ],
              },
            },
            include: [
              {
                model: SubmissionScoreBreakdown,
                as: 'scoreBreakdown',
                required: true,
                // where: { codeReviewScore: { [Op.gt]: 25 } },
              },
            ],
          },
        ],
      },
    ],
  });
  logger.info(`completedCount ${completedCount}`);
  return completedCount;
}

/* ------------------------------------------------------------------ */
/* Award milestone badges if thresholds are reached */
export async function awardBadgeIfEligible(studentId) {
  const completedChallenges = await countCompletedChallenges(studentId);

  // Fetch all milestone badges that match the completed count
  const milestoneBadges = await Badge.findAll({
    where: {
      category: BadgeCategory.CHALLENGE_MILESTONE,
      metric: BadgeMetric.CHALLENGES_COMPLETED,
      threshold: { [Op.lte]: completedChallenges },
    },
    order: [['threshold', 'ASC']],
  });

  const unlockedBadges = [];

  for (const badge of milestoneBadges) {
    // Assign the badge only if the student hasn't earned it yet
    const [, created] = await StudentBadge.findOrCreate({
      where: { studentId, badgeId: badge.id },
      defaults: { earnedAt: new Date() },
    });

    if (created) {
      unlockedBadges.push(badge); // Return full badge object
    }
  }

  return {
    unlockedBadges, // Always an array
    completedChallenges,
  };
}
