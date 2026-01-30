import { Op } from 'sequelize';
import Badge from '#root/models/badge.js';
import StudentBadge from '#root/models/student-badges.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import {
  SubmissionStatus,
  BadgeCategory,
  BadgeMetric,
} from '#root/models/enum/enums.js';

/**
 * Counts the number of challenges completed by a student.
 * A challenge is considered completed if:
 * - There is a final submission with status PROBABLY_CORRECT
 * - At least one peer review vote exists (ABSTAIN is allowed)
 */
export async function countCompletedChallenges(studentId) {
  const participations = await ChallengeParticipant.findAll({
    where: { studentId },
    attributes: ['id'],
  });
  if (!participations.length) return 0;

  const participantIds = participations.map((p) => p.id);

  const matches = await Match.findAll({
    where: { challengeParticipantId: { [Op.in]: participantIds } },
    attributes: ['id', 'challengeParticipantId'],
  });
  if (!matches.length) return 0;

  const matchIds = matches.map((m) => m.id);

  const submissions = await Submission.findAll({
    where: {
      matchId: { [Op.in]: matchIds },
      isFinal: true,
      status: SubmissionStatus.PROBABLY_CORRECT,
    },
    attributes: ['id', 'challengeParticipantId'],
  });
  if (!submissions.length) return 0;

  const submissionIds = submissions.map((s) => s.id);

  const assignments = await PeerReviewAssignment.findAll({
    where: { submissionId: { [Op.in]: submissionIds } },
    attributes: ['id'],
  });
  if (!assignments.length) return 0;

  const assignmentIds = assignments.map((a) => a.id);

  const votes = await PeerReviewVote.findAll({
    where: { peerReviewAssignmentId: { [Op.in]: assignmentIds } },
    attributes: ['peerReviewAssignmentId'],
  });
  if (!votes.length) return 0;

  // Only participants with submissions that passed all checks are considered completed
  const completedParticipantIds = new Set(
    submissions.map((s) => s.challengeParticipantId)
  );
  return completedParticipantIds.size;
}

/**
 * Awards milestone badges to a student if thresholds are reached.
 * Each milestone badge can be awarded only once.
 * Returns a flag and the list of badges awarded in this call.
 */
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

    if (created) awarded.push(badge.name); // store newly unlocked badges
  }

  return {
    badgeUnlocked: awarded.length > 0, // UI trigger flag
    unlockedBadges: awarded, // names of badges just awarded
    completedChallenges, // total completed challenges for reference
  };
}
