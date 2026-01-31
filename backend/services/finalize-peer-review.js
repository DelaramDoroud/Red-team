import { Op } from 'sequelize';
import Challenge from '#root/models/challenge.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';

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
    await transaction.commit();

    return {
      status: updatedCount > 0 ? 'ok' : 'update_failed',
      challenge: updatedChallenge,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
