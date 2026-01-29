import { Op } from 'sequelize';

import Badge from '#root/models/badges.js';
import StudentBadge from '#root/models/student-badges.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';

/**
 * A challenge is completed if:
 * - the student made a FINAL submission
 * - the student cast at least one peer review vote (ABSTAIN allowed)
 */
export async function countCompletedChallenges(studentId) {
  // 1️⃣ all participations of the student
  const participations = await ChallengeParticipant.findAll({
    where: { studentId },
    attributes: ['id'],
  });

  if (participations.length === 0) return 0;

  const participantIds = participations.map((p) => p.id);

  // 2️⃣ matches for those participations
  const matches = await Match.findAll({
    where: {
      challengeParticipantId: { [Op.in]: participantIds },
    },
    attributes: ['id', 'challengeParticipantId'],
  });

  if (matches.length === 0) return 0;

  const matchIds = matches.map((m) => m.id);

  // 3️⃣ final submissions
  const submissions = await Submission.findAll({
    where: {
      matchId: { [Op.in]: matchIds },
      isFinal: true,
    },
    attributes: ['id', 'challengeParticipantId'],
  });

  if (submissions.length === 0) return 0;

  const submissionIds = submissions.map((s) => s.id);

  // 4️⃣ peer review assignments
  const assignments = await PeerReviewAssignment.findAll({
    where: {
      submissionId: { [Op.in]: submissionIds },
    },
    attributes: ['id'],
  });

  if (assignments.length === 0) return 0;

  const assignmentIds = assignments.map((a) => a.id);

  // 5️⃣ peer review votes (ABSTAIN allowed)
  const votes = await PeerReviewVote.findAll({
    where: {
      peerReviewAssignmentId: { [Op.in]: assignmentIds },
    },
    attributes: ['peerReviewAssignmentId'],
  });

  if (votes.length === 0) return 0;

  // 6️⃣ count DISTINCT completed challenges
  const completedParticipantIds = new Set(
    submissions.map((s) => s.challengeParticipantId)
  );

  return completedParticipantIds.size;
}

/**
 * Awards milestone badges based on completed challenges
 */
export async function awardBadgeIfEligible(studentId) {
  const completedChallenges = await countCompletedChallenges(studentId);

  const milestoneBadges = await Badge.findAll({
    where: {
      type: 'milestone',
      metric: 'completed_challenges',
      threshold: { [Op.lte]: completedChallenges },
    },
    order: [['threshold', 'ASC']],
  });

  const awarded = [];

  for (const badge of milestoneBadges) {
    const [, created] = await StudentBadge.findOrCreate({
      where: {
        studentId,
        badgeId: badge.id,
      },
    });

    if (created) {
      awarded.push(badge.name);
    }
  }

  return awarded;
}
