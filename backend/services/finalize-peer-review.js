import { Op } from 'sequelize';
import Challenge from '#root/models/challenge.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';
import { awardBadgeIfEligible } from '#root/services/challenge-completed-badges-controller.js';

/**
 * Computes the end time of the peer review phase for a challenge.
 * Returns null if the challenge or its phase dates are invalid.
 */
const computePeerReviewEndTime = (challenge) => {
  if (!challenge) return null;
  if (challenge.endPhaseTwoDateTime) {
    const explicit = new Date(challenge.endPhaseTwoDateTime).getTime();
    if (!Number.isNaN(explicit)) {
      return new Date(explicit);
    }
  }
  if (!challenge.startPhaseTwoDateTime) return null;
  const startMs = new Date(challenge.startPhaseTwoDateTime).getTime();
  if (Number.isNaN(startMs)) return null;
  return new Date(
    startMs + (challenge.durationPeerReview || 0) * 60 * 1000 + 5000
  );
};

/**
 * Builds default abstain votes for assignments that have no votes yet.
 */
const buildAbstainVotes = (assignmentIds, existingVotes) => {
  const votedAssignmentIds = new Set(
    existingVotes.map((vote) => vote.peerReviewAssignmentId)
  );
  return assignmentIds
    .filter((id) => !votedAssignmentIds.has(id))
    .map((id) => ({
      peerReviewAssignmentId: id,
      vote: 'abstain',
      testCaseInput: null,
      expectedOutput: null,
    }));
};

const loadAssignments = async (reviewerId, transaction) =>
  PeerReviewAssignment.findAll({
    where: { reviewerId },
    transaction,
  });

/**
 * Loads all votes for given assignments.
 */
const loadVotes = async (assignmentIds, transaction) =>
  PeerReviewVote.findAll({
    where: { peerReviewAssignmentId: { [Op.in]: assignmentIds } },
    transaction,
  });

export default async function finalizePeerReviewChallenge({
  challengeId,
  allowEarly = false,
} = {}) {
  const transaction = await PeerReviewVote.sequelize.transaction();

  try {
    if (!challengeId) {
      await transaction.rollback();
      return { status: 'missing_challenge' };
    }

    const challenge = await Challenge.findByPk(challengeId, {
      transaction,
    });

    if (!challenge) {
      await transaction.rollback();
      return { status: 'challenge_not_found' };
    }

    if (challenge.status === ChallengeStatus.ENDED_PHASE_TWO) {
      await transaction.commit();
      return { status: 'already_finalized', challenge };
    }

    const peerReviewEndTime = computePeerReviewEndTime(challenge);
    if (!allowEarly && peerReviewEndTime && new Date() < peerReviewEndTime) {
      await transaction.rollback();
      return { status: 'peer_review_not_ended' };
    }

    const participants = await ChallengeParticipant.findAll({
      where: { challengeId },
      transaction,
    });

    if (participants.length === 0) {
      await transaction.rollback();
      return { status: 'no_participants' };
    }

    // Fill in missing abstain votes for all participants
    for (const participant of participants) {
      const assignments = await loadAssignments(participant.id, transaction);
      const assignmentIds = assignments.map((assignment) => assignment.id);
      if (assignmentIds.length === 0) continue;

      const existingVotes = await loadVotes(assignmentIds, transaction);
      const abstainVotes = buildAbstainVotes(assignmentIds, existingVotes);

      if (abstainVotes.length > 0) {
        await PeerReviewVote.bulkCreate(abstainVotes, { transaction });
      }
    }

    // Mark the challenge as ENDED_PHASE_TWO
    const endPhaseTwoDateTime = new Date();
    const [updatedCount, updatedRows] = await Challenge.update(
      {
        status: ChallengeStatus.ENDED_PHASE_TWO,
        endPhaseTwoDateTime,
      },
      {
        where: { id: challengeId },
        transaction,
        returning: true,
      }
    );

    const updatedChallenge = updatedRows?.[0] || challenge;

    // Award milestone badges for all participants
    const badgeResults = [];
    for (const participant of participants) {
      const result = await awardBadgeIfEligible(participant.studentId);
      if (result.badgeUnlocked) {
        badgeResults.push({
          studentId: participant.studentId,
          unlockedBadges: result.unlockedBadges,
        });
      }
    }

    await transaction.commit();

    return {
      status: updatedCount > 0 ? 'ok' : 'update_failed',
      challenge: updatedChallenge,
      badgesAwarded: badgeResults,
      badgeUnlocked: badgeResults.length > 0, // Flag for UI trigger
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
