import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  vi,
} from 'vitest';
import request from 'supertest';
import express from 'express';
import router from '#root/routes/rest/peer-review-controller.js';
import MatchSetting from '#root/models/match-setting.js';
import Challenge from '#root/models/challenge.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import User from '#root/models/user.js';
import modelsInitializer from '#root/models/init-models.js';
import {
  MatchSettingStatus,
  ChallengeStatus,
  SubmissionStatus,
  VoteType,
} from '#root/models/enum/enums.js';

const mockExecuteCodeTests = vi.fn();
vi.mock('#root/services/execute-code-tests.js', () => ({
  executeCodeTests: (...args) => mockExecuteCodeTests(...args),
}));

describe('Peer Review Vote Breakdown API (RT-206 Verification)', () => {
  let user;
  let testApp;
  let createdIds = {
    users: [],
    challenges: [],
    matchSettings: [],
    challengeMatchSettings: [],
    participants: [],
    matches: [],
    submissions: [],
    assignments: [],
    votes: [],
  };

  const cleanup = async () => {
    await PeerReviewVote.destroy({ where: { id: createdIds.votes } });
    await PeerReviewAssignment.destroy({
      where: { id: createdIds.assignments },
    });
    await Submission.destroy({ where: { id: createdIds.submissions } });
    await Match.destroy({ where: { id: createdIds.matches } });
    await ChallengeParticipant.destroy({
      where: { id: createdIds.participants },
    });
    await ChallengeMatchSetting.destroy({
      where: { id: createdIds.challengeMatchSettings },
    });
    await Challenge.destroy({ where: { id: createdIds.challenges } });
    await MatchSetting.destroy({ where: { id: createdIds.matchSettings } });
    await User.destroy({ where: { id: createdIds.users } });
    createdIds = {
      users: [],
      challenges: [],
      matchSettings: [],
      challengeMatchSettings: [],
      participants: [],
      matches: [],
      submissions: [],
      assignments: [],
      votes: [],
    };
  };

  beforeAll(async () => {
    await modelsInitializer.init();
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    mockExecuteCodeTests.mockResolvedValue({
      testResults: [],
      summary: { total: 1, passed: 1, failed: 0, allPassed: true },
      isCompiled: true,
      isPassed: true,
      errors: [],
    });

    const suffix = Date.now() + Math.floor(Math.random() * 1000);
    user = await User.create({
      username: `testuser_${suffix}`,
      password: 'password',
      email: `test_${suffix}@test.com`,
      role: 'student',
    });
    createdIds.users.push(user.id);

    testApp = express();
    testApp.use(express.json());
    testApp.use((req, _res, next) => {
      req.user = { id: user.id };
      next();
    });
    testApp.use('/', router);
  });

  afterEach(async () => {
    await cleanup();
  });

  const createScenario = async ({
    submissionStatus,
    voteType,
    testCaseInput,
    expectedOutput,
    existingVoteCorrectness = null,
  }) => {
    const suffix = Date.now() + Math.floor(Math.random() * 1000);

    const matchSetting = await MatchSetting.create({
      problemTitle: `Test Problem ${suffix}`,
      problemDescription: 'Desc',
      referenceSolution: 'function test() { return 1; }',
      publicTests: [],
      privateTests: [],
      status: MatchSettingStatus.READY,
    });
    createdIds.matchSettings.push(matchSetting.id);

    const challenge = await Challenge.create({
      title: `Test Challenge ${suffix}`,
      duration: 60,
      startDatetime: new Date(),
      endDatetime: new Date(),
      durationPeerReview: 20,
      startPhaseTwoDateTime: new Date(),
      status: ChallengeStatus.STARTED_PHASE_TWO,
    });
    createdIds.challenges.push(challenge.id);

    const cms = await ChallengeMatchSetting.create({
      challengeId: challenge.id,
      matchSettingId: matchSetting.id,
    });
    createdIds.challengeMatchSettings.push(cms.id);

    const participant = await ChallengeParticipant.create({
      challengeId: challenge.id,
      studentId: user.id,
    });
    createdIds.participants.push(participant.id);

    const author = await User.create({
      username: `author_${suffix}`,
      password: 'pw',
      role: 'student',
      email: `author_${suffix}@test.com`,
    });
    createdIds.users.push(author.id);

    const authorParticipant = await ChallengeParticipant.create({
      challengeId: challenge.id,
      studentId: author.id,
    });
    createdIds.participants.push(authorParticipant.id);

    const match = await Match.create({
      challengeMatchSettingId: cms.id,
      challengeParticipantId: authorParticipant.id,
    });
    createdIds.matches.push(match.id);

    const submission = await Submission.create({
      matchId: match.id,
      challengeParticipantId: authorParticipant.id,
      code: 'submission code',
      status: submissionStatus,
      isFinal: true,
    });
    createdIds.submissions.push(submission.id);

    const assignment = await PeerReviewAssignment.create({
      submissionId: submission.id,
      reviewerId: participant.id,
      isExtra: false,
    });
    createdIds.assignments.push(assignment.id);

    const vote = await PeerReviewVote.create({
      peerReviewAssignmentId: assignment.id,
      vote: voteType,
      testCaseInput: testCaseInput,
      expectedOutput: expectedOutput,
      isVoteCorrect: existingVoteCorrectness?.isVoteCorrect ?? null,
      isExpectedOutputCorrect:
        existingVoteCorrectness?.isExpectedOutputCorrect ?? null,
    });
    createdIds.votes.push(vote.id);

    return { challenge, vote };
  };

  it('computes isVoteCorrect = true for CORRECT vote on PROBABLY_CORRECT submission', async () => {
    const { challenge } = await createScenario({
      submissionStatus: SubmissionStatus.PROBABLY_CORRECT,
      voteType: VoteType.CORRECT,
    });

    const res = await request(testApp).get(
      `/challenges/${challenge.id}/peer-reviews/votes`
    );

    expect(res.status).toBe(200);
    expect(res.body.votes).toHaveLength(1);
    expect(res.body.votes[0].isVoteCorrect).toBe(true);
    expect(res.body.votes[0].earnedCredit).toBe(true);
  });

  it('computes isVoteCorrect = false for CORRECT vote on WRONG submission', async () => {
    const { challenge } = await createScenario({
      submissionStatus: SubmissionStatus.WRONG,
      voteType: VoteType.CORRECT,
    });

    const res = await request(testApp).get(
      `/challenges/${challenge.id}/peer-reviews/votes`
    );

    expect(res.status).toBe(200);
    expect(res.body.votes[0].isVoteCorrect).toBe(false);
    expect(res.body.votes[0].earnedCredit).toBe(false);
  });

  it('computes isVoteCorrect = true for INCORRECT vote on WRONG submission and earnedCredit logic', async () => {
    mockExecuteCodeTests.mockResolvedValueOnce({
      testResults: [{ passed: true, actualOutput: [2] }],
      isPassed: true,
      summary: { total: 1, passed: 1, failed: 0, allPassed: true },
    });

    const { challenge } = await createScenario({
      submissionStatus: SubmissionStatus.WRONG,
      voteType: VoteType.INCORRECT,
      testCaseInput: '[1]',
      expectedOutput: '[2]',
    });

    const res = await request(testApp).get(
      `/challenges/${challenge.id}/peer-reviews/votes`
    );

    expect(res.status).toBe(200);
    expect(res.body.votes[0].isVoteCorrect).toBe(true);
    expect(res.body.votes[0].isExpectedOutputCorrect).toBe(true);
    expect(res.body.votes[0].earnedCredit).toBe(true);
  });

  it('computes earnedCredit = false if isExpectedOutputCorrect is false for INCORRECT vote', async () => {
    mockExecuteCodeTests.mockResolvedValueOnce({
      testResults: [{ passed: false }],
      isPassed: false,
      summary: { total: 1, passed: 0, failed: 1, allPassed: false },
    });

    const { challenge } = await createScenario({
      submissionStatus: SubmissionStatus.WRONG,
      voteType: VoteType.INCORRECT,
      testCaseInput: '[1]',
      expectedOutput: '[999]',
    });

    const res = await request(testApp).get(
      `/challenges/${challenge.id}/peer-reviews/votes`
    );

    expect(res.status).toBe(200);
    expect(res.body.votes[0].isVoteCorrect).toBe(true);
    expect(res.body.votes[0].isExpectedOutputCorrect).toBe(false);
    expect(res.body.votes[0].earnedCredit).toBe(false);
  });

  it('persists computed values to the database', async () => {
    const { challenge } = await createScenario({
      submissionStatus: SubmissionStatus.PROBABLY_CORRECT,
      voteType: VoteType.CORRECT,
    });

    // Before API call, database value is null
    let dbVote = await PeerReviewVote.findByPk(createdIds.votes[0]);
    expect(dbVote.isVoteCorrect).toBeNull();

    await request(testApp).get(
      `/challenges/${challenge.id}/peer-reviews/votes`
    );

    // After API call, database value is persisted
    dbVote = await PeerReviewVote.findByPk(createdIds.votes[0]);
    expect(dbVote.isVoteCorrect).toBe(true);
  });
});
