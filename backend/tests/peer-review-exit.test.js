import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '#root/app_initial.js';
import Challenge from '#root/models/challenge.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import {
  ChallengeStatus,
  SubmissionStatus,
  VoteType,
} from '#root/models/enum/enums.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import Submission from '#root/models/submission.js';
import User from '#root/models/user.js';

const createExitTestScenario = async ({
  participantCount = 3,
  assignmentsPerReviewer = 2,
  existingVotes = [],
}) => {
  const suffix = Date.now() + Math.floor(Math.random() * 1000);

  const matchSetting = await MatchSetting.create({
    problemTitle: `Exit Test Problem ${suffix}`,
    problemDescription: 'Test problem for exit endpoint',
    referenceSolution: 'int main() { return 0; }',
    publicTests: [{ input: ['1'], output: '1' }],
    privateTests: [{ input: ['2'], output: '2' }],
    status: 'ready',
  });

  const challenge = await Challenge.create({
    title: `Exit Test Challenge ${suffix}`,
    duration: 30,
    startDatetime: new Date(Date.now() - 60 * 60 * 1000),
    endDatetime: new Date(Date.now() + 60 * 60 * 1000),
    durationPeerReview: 20,
    allowedNumberOfReview: 2,
    status: ChallengeStatus.STARTED_PEER_REVIEW,
    startPeerReviewDateTime: new Date(Date.now() - 5 * 60 * 1000),
  });

  const challengeMatchSetting = await ChallengeMatchSetting.create({
    challengeId: challenge.id,
    matchSettingId: matchSetting.id,
  });

  const users = [];
  const participants = [];
  const matches = [];
  const submissions = [];
  const assignments = [];

  for (let i = 0; i < participantCount; i += 1) {
    const user = await User.create({
      username: `student_${suffix}_${i}`,
      password: 'password123',
      email: `student_${suffix}_${i}@mail.com`,
      role: 'student',
    });
    users.push(user);

    const participant = await ChallengeParticipant.create({
      challengeId: challenge.id,
      studentId: user.id,
    });
    participants.push(participant);

    const match = await Match.create({
      challengeMatchSettingId: challengeMatchSetting.id,
      challengeParticipantId: participant.id,
    });
    matches.push(match);

    const submission = await Submission.create({
      matchId: match.id,
      challengeParticipantId: participant.id,
      code: `int main() { return ${i}; }`,
      status: SubmissionStatus.PROBABLY_CORRECT,
      isFinal: true,
    });
    submissions.push(submission);
  }

  const reviewer = participants[0];
  const reviewerUser = users[0];
  const otherParticipants = participants.slice(1);

  for (let i = 0; i < assignmentsPerReviewer; i += 1) {
    if (i < otherParticipants.length) {
      const submission = submissions[i + 1];
      const assignment = await PeerReviewAssignment.create({
        submissionId: submission.id,
        reviewerId: reviewer.id,
        isExtra: false,
      });
      assignments.push(assignment);
    }
  }

  for (const voteData of existingVotes) {
    const assignment = assignments.find(
      (a) => a.submissionId === voteData.submissionId
    );
    if (assignment) {
      await PeerReviewVote.create({
        peerReviewAssignmentId: assignment.id,
        vote: voteData.vote,
        testCaseInput: voteData.testCaseInput || null,
        expectedOutput: voteData.expectedOutput || null,
      });
    }
  }

  return {
    challenge,
    matchSetting,
    challengeMatchSetting,
    users,
    participants,
    matches,
    submissions,
    assignments,
    reviewer,
    reviewerUser,
  };
};

const loginAs = async (agent, user) => {
  const response = await agent.post('/api/login').send({
    email: user.email,
    password: 'password123',
  });
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
};

const createAuthenticatedAgent = async (user) => {
  const agent = request.agent(app);
  await loginAs(agent, user);
  return agent;
};

describe('Peer Review Exit API', () => {
  beforeEach(async () => {
    await PeerReviewVote.destroy({ where: {} });
    await PeerReviewAssignment.destroy({ where: {} });
    await Submission.destroy({ where: {} });
    await Match.destroy({ where: {} });
    await ChallengeParticipant.destroy({ where: {} });
    await ChallengeMatchSetting.destroy({ where: {} });
    await Challenge.destroy({ where: {} });
    await MatchSetting.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterEach(async () => {
    await PeerReviewVote.destroy({ where: {} });
    await PeerReviewAssignment.destroy({ where: {} });
    await Submission.destroy({ where: {} });
    await Match.destroy({ where: {} });
    await ChallengeParticipant.destroy({ where: {} });
    await ChallengeMatchSetting.destroy({ where: {} });
    await Challenge.destroy({ where: {} });
    await MatchSetting.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('POST /api/rest/peer-review/exit', () => {
    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/rest/peer-review/exit').send({
        challengeId: 1,
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Authentication required.');
    });

    it('should reject request without challengeId', async () => {
      const user = await User.create({
        username: `student_exit_${Date.now()}`,
        password: 'password123',
        email: `student_exit_${Date.now()}@mail.com`,
        role: 'student',
      });
      const agent = await createAuthenticatedAgent(user);
      const res = await agent.post('/api/rest/peer-review/exit').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('challengeId is required');
    });

    it('should reject request for non-existent challenge', async () => {
      const user = await User.create({
        username: `student_exit_${Date.now()}`,
        password: 'password123',
        email: `student_exit_${Date.now()}@mail.com`,
        role: 'student',
      });
      const agent = await createAuthenticatedAgent(user);
      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: 99999,
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Challenge not found');
    });

    it('should reject request when body studentId does not match session', async () => {
      const {
        challenge,
        reviewerUser,
        users: [, secondUser],
      } = await createExitTestScenario({
        participantCount: 3,
        assignmentsPerReviewer: 2,
      });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        studentId: secondUser.id,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Not authorized');
    });

    it('should reject request when challenge is not in STARTED_PEER_REVIEW', async () => {
      const { challenge, reviewerUser } = await createExitTestScenario({
        participantCount: 3,
        assignmentsPerReviewer: 2,
      });
      const agent = await createAuthenticatedAgent(reviewerUser);

      await challenge.update({ status: ChallengeStatus.ENDED_PEER_REVIEW });

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Peer review phase must be active to exit');
    });

    it('should reject request for non-existent participant', async () => {
      const { challenge, reviewerUser } = await createExitTestScenario({
        participantCount: 3,
        assignmentsPerReviewer: 2,
      });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        studentId: 99999,
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Not authorized');
    });

    it('should create abstain votes for all unvoted assignments', async () => {
      const { challenge, assignments, reviewerUser } =
        await createExitTestScenario({
          participantCount: 3,
          assignmentsPerReviewer: 2,
        });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.votesSaved).toBe(0);
      expect(res.body.data.abstainVotesCreated).toBe(assignments.length);

      const votes = await PeerReviewVote.findAll({
        where: {
          peerReviewAssignmentId: assignments.map((a) => a.id),
        },
      });

      expect(votes.length).toBe(assignments.length);
      votes.forEach((vote) => {
        expect(vote.vote).toBe(VoteType.ABSTAIN);
        expect(vote.testCaseInput).toBeNull();
        expect(vote.expectedOutput).toBeNull();
      });
    });

    it('should save votes from request and create abstain for unvoted', async () => {
      const { challenge, assignments, submissions, reviewerUser } =
        await createExitTestScenario({
          participantCount: 3,
          assignmentsPerReviewer: 2,
        });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const votesToSubmit = [
        {
          submissionId: submissions[1].id,
          vote: VoteType.CORRECT,
        },
      ];

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        votes: votesToSubmit,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.votesSaved).toBe(1);
      expect(res.body.data.abstainVotesCreated).toBe(assignments.length - 1);

      const allVotes = await PeerReviewVote.findAll({
        where: {
          peerReviewAssignmentId: assignments.map((a) => a.id),
        },
      });

      expect(allVotes.length).toBe(assignments.length);

      const correctVote = allVotes.find((v) =>
        assignments.find(
          (a) =>
            a.id === v.peerReviewAssignmentId &&
            a.submissionId === submissions[1].id
        )
      );
      expect(correctVote).toBeDefined();
      expect(correctVote.vote).toBe(VoteType.CORRECT);

      const abstainVotes = allVotes.filter((v) => v.vote === VoteType.ABSTAIN);
      expect(abstainVotes.length).toBe(assignments.length - 1);
    });

    it('should update existing votes when provided in request', async () => {
      const scenario = await createExitTestScenario({
        participantCount: 3,
        assignmentsPerReviewer: 2,
      });

      const { challenge, assignments, submissions, reviewerUser } = scenario;
      const agent = await createAuthenticatedAgent(reviewerUser);

      const existingAssignment = assignments.find(
        (a) => a.submissionId === submissions[1].id
      );

      await PeerReviewVote.create({
        peerReviewAssignmentId: existingAssignment.id,
        vote: VoteType.CORRECT,
      });

      const votesToSubmit = [
        {
          submissionId: submissions[1].id,
          vote: VoteType.INCORRECT,
          testCaseInput: '[1, 2]',
          expectedOutput: '[3]',
        },
      ];

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        votes: votesToSubmit,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.votesSaved).toBe(1);

      const updatedVote = await PeerReviewVote.findOne({
        where: {
          peerReviewAssignmentId: assignments.find(
            (a) => a.submissionId === submissions[1].id
          ).id,
        },
      });

      expect(updatedVote).toBeDefined();
      expect(updatedVote.vote).toBe(VoteType.INCORRECT);
      expect(updatedVote.testCaseInput).toBe('[1, 2]');
      expect(updatedVote.expectedOutput).toBe('[3]');
    });

    it('should handle multiple votes correctly', async () => {
      const { challenge, assignments, submissions, reviewerUser } =
        await createExitTestScenario({
          participantCount: 4,
          assignmentsPerReviewer: 3,
        });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const votesToSubmit = [
        {
          submissionId: submissions[1].id,
          vote: VoteType.CORRECT,
        },
        {
          submissionId: submissions[2].id,
          vote: VoteType.INCORRECT,
          testCaseInput: '[5, 6]',
          expectedOutput: '[11]',
        },
        {
          submissionId: submissions[3].id,
          vote: VoteType.ABSTAIN,
        },
      ];

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        votes: votesToSubmit,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.votesSaved).toBe(3);
      expect(res.body.data.abstainVotesCreated).toBe(assignments.length - 3);

      const allVotes = await PeerReviewVote.findAll({
        where: {
          peerReviewAssignmentId: assignments.map((a) => a.id),
        },
      });

      expect(allVotes.length).toBe(assignments.length);

      const correctVote = allVotes.find((v) =>
        assignments.find(
          (a) =>
            a.id === v.peerReviewAssignmentId &&
            a.submissionId === submissions[1].id
        )
      );
      expect(correctVote.vote).toBe(VoteType.CORRECT);

      const incorrectVote = allVotes.find((v) =>
        assignments.find(
          (a) =>
            a.id === v.peerReviewAssignmentId &&
            a.submissionId === submissions[2].id
        )
      );
      expect(incorrectVote.vote).toBe(VoteType.INCORRECT);
      expect(incorrectVote.testCaseInput).toBe('[5, 6]');
      expect(incorrectVote.expectedOutput).toBe('[11]');

      const abstainVote = allVotes.find((v) =>
        assignments.find(
          (a) =>
            a.id === v.peerReviewAssignmentId &&
            a.submissionId === submissions[3].id
        )
      );
      expect(abstainVote.vote).toBe(VoteType.ABSTAIN);
    });

    it('should ignore votes for assignments not assigned to reviewer', async () => {
      const { challenge, assignments, submissions, reviewerUser } =
        await createExitTestScenario({
          participantCount: 3,
          assignmentsPerReviewer: 2,
        });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const votesToSubmit = [
        {
          submissionId: submissions[0].id,
          vote: VoteType.CORRECT,
        },
        {
          submissionId: submissions[1].id,
          vote: VoteType.CORRECT,
        },
      ];

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        votes: votesToSubmit,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const allVotes = await PeerReviewVote.findAll({
        where: {
          peerReviewAssignmentId: assignments.map((a) => a.id),
        },
      });

      const validVoteCount = allVotes.filter((v) =>
        assignments.some(
          (a) =>
            a.id === v.peerReviewAssignmentId &&
            a.submissionId === submissions[1].id
        )
      ).length;

      expect(validVoteCount).toBe(1);
    });

    it('should handle empty votes array', async () => {
      const { challenge, assignments, reviewerUser } =
        await createExitTestScenario({
          participantCount: 3,
          assignmentsPerReviewer: 2,
        });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
        votes: [],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.votesSaved).toBe(0);
      expect(res.body.data.abstainVotesCreated).toBe(assignments.length);
    });

    it('should handle missing votes field', async () => {
      const { challenge, assignments, reviewerUser } =
        await createExitTestScenario({
          participantCount: 3,
          assignmentsPerReviewer: 2,
        });
      const agent = await createAuthenticatedAgent(reviewerUser);

      const res = await agent.post('/api/rest/peer-review/exit').send({
        challengeId: challenge.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.votesSaved).toBe(0);
      expect(res.body.data.abstainVotesCreated).toBe(assignments.length);
    });
  });
});
