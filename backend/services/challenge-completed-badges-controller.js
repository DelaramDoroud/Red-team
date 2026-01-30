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

/* ------------------------------------------------------------------ */
/* Count the number of completed challenges for a student */
export async function countCompletedChallenges(studentId) {
  // 1️⃣ Get all participations of the student
  const participations = await ChallengeParticipant.findAll({
    where: { studentId },
    attributes: ['id'],
  });
  if (!participations.length) return 0;

  const participantIds = participations.map((p) => p.id);

  // 2️⃣ Get all matches for those participations
  const matches = await Match.findAll({
    where: { challengeParticipantId: { [Op.in]: participantIds } },
    attributes: ['id', 'challengeParticipantId'],
  });
  if (!matches.length) return 0;

  const matchIds = matches.map((m) => m.id);

  // 3️⃣ Get final submissions that are reviewable
  const submissions = await Submission.findAll({
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
    attributes: ['id', 'challengeParticipantId'],
  });
  if (!submissions.length) return 0;

  const submissionIds = submissions.map((s) => s.id);

  // 4️⃣ Get submission scores and filter by codeReviewScore > 25
  const scores = await SubmissionScoreBreakdown.findAll({
    where: {
      submissionId: { [Op.in]: submissionIds },
      codeReviewScore: { [Op.gt]: 25 },
    },
    attributes: ['submissionId'],
  });
  if (!scores.length) return 0;

  const validSubmissionIds = scores.map((s) => s.submissionId);

  // 5️⃣ Filter submissions by the valid ones
  const completedParticipantIds = new Set(
    submissions
      .filter((s) => validSubmissionIds.includes(s.id))
      .map((s) => s.challengeParticipantId)
  );

  return completedParticipantIds.size;
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

  const awarded = [];

  for (const badge of milestoneBadges) {
    // Assign the badge only if the student hasn't earned it yet
    const [, created] = await StudentBadge.findOrCreate({
      where: { studentId, badgeId: badge.id },
      defaults: { earnedAt: new Date() },
    });

    if (created) awarded.push(badge.name);
  }

  return {
    badgeUnlocked: awarded.length > 0,
    unlockedBadges: awarded,
    completedChallenges,
  };
}
