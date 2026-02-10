import ChallengeParticipant from '#root/models/challenge-participant.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import {
  getRequestUserId,
  isPrivilegedRole,
} from '#root/services/request-auth.js';

export const serializeSubmissionPayload = (submission, { includeCode }) => {
  const payload = {
    id: submission.id,
    matchId: submission.matchId,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    status: submission.status,
    isAutomaticSubmission: submission.isAutomaticSubmission,
    isFinal: submission.isFinal,
    publicTestResults: submission.publicTestResults,
    privateTestResults: submission.privateTestResults,
  };

  if (includeCode) {
    payload.code = submission.code;
  }

  return payload;
};

const getReviewerParticipant = async ({ challengeId, userId }) =>
  ChallengeParticipant.findOne({
    attributes: ['id'],
    where: {
      challengeId,
      studentId: userId,
    },
  });

export const canAccessSubmission = async ({ req, submission }) => {
  const userId = getRequestUserId(req);
  const userRole = req.session?.user?.role || req.user?.role || null;
  if (!userId || !userRole) return false;
  if (isPrivilegedRole(userRole)) return true;

  const ownerStudentId = Number(submission?.challengeParticipant?.studentId);
  if (ownerStudentId === userId) return true;

  const challengeId = Number(submission?.challengeParticipant?.challengeId);
  if (!Number.isInteger(challengeId) || challengeId < 1) return false;

  const reviewerParticipant = await getReviewerParticipant({
    challengeId,
    userId,
  });
  if (!reviewerParticipant) return false;

  const assignment = await PeerReviewAssignment.findOne({
    attributes: ['id'],
    where: {
      submissionId: submission.id,
      reviewerId: reviewerParticipant.id,
    },
  });

  return Boolean(assignment);
};
