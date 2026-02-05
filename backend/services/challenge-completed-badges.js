import sequelize from '#root/services/sequelize.js';
import Badge from '#root/models/badge.js';
import StudentBadge from '#root/models/student-badges.js';
import logger from '#root/services/logger.js';
import { Op, QueryTypes } from 'sequelize';
import { BadgeCategory, BadgeMetric } from '#root/models/enum/enums.js';

/**
 * Count the number of completed challenges for a student.
 *
 * A challenge is considered completed if:
 * - at least one final submission exists
 * - submission status is 'probably_correct' or 'improvable'
 * - score breakdown exists with totalScore > 25
 *
 * Each challenge is counted only once.
 */
export async function countCompletedChallenges(studentId) {
  const sql = `
    SELECT COUNT(DISTINCT C.id) AS "challengeCompleted"
    FROM CHALLENGE_PARTICIPANT C
    JOIN SUBMISSION S ON S.CHALLENGE_PARTICIPANT_ID = C.ID
    JOIN SUBMISSION_SCORE_BREAKDOWN B ON B.SUBMISSION_ID = S.ID
    WHERE S.STATUS IN ('probably_correct', 'improvable')
    AND S.IS_FINAL = TRUE
    AND B.TOTAL_SCORE > 25
    AND C.STUDENT_ID = :studentId
    GROUP BY C.STUDENT_ID
    LIMIT 100;
  `;

  try {
    const [results] = await sequelize.query(sql, {
      replacements: { studentId },
      type: QueryTypes.SELECT,
    });

    const completedCount = Number(results?.challengeCompleted ?? 0);

    logger.info(
      `Student ${studentId} completed challenges count: ${completedCount}`
    );

    return completedCount;
  } catch (error) {
    logger.error('Error counting completed challenges:', error);
    return 0;
  }
}

/**
 * Award milestone badges if challenge completion thresholds are reached.
 * Only newly unlocked badges are returned.
 */
export async function awardChallengeMilestoneBadges(studentId) {
  const completedChallenges = await countCompletedChallenges(studentId);

  const eligibleBadges = await Badge.findAll({
    where: {
      category: BadgeCategory.CHALLENGE_MILESTONE,
      metric: BadgeMetric.CHALLENGES_COMPLETED,
      threshold: { [Op.lte]: completedChallenges },
    },
    order: [['threshold', 'ASC']],
  });

  const newlyUnlocked = [];

  for (const badge of eligibleBadges) {
    const [, created] = await StudentBadge.findOrCreate({
      where: { studentId, badgeId: badge.id },
      defaults: { earnedAt: new Date() },
    });

    if (created) {
      newlyUnlocked.push({
        id: badge.id,
        key: badge.key,
        name: badge.name,
        description: badge.description,
        iconKey: badge.iconKey,
        level: badge.level,
        threshold: badge.threshold,
        metric: badge.metric,
        accuracyRequired: badge.accuracyRequired,
        category: badge.category,
        createdAt: badge.createdAt,
        updatedAt: badge.updatedAt,
      });

      logger.info(`Badge ${badge.id} just unlocked for student ${studentId}`);
    }
  }

  return {
    newlyUnlocked,
    completedChallenges,
  };
}
