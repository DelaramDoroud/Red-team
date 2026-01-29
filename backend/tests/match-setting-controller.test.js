import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '#root/app_initial.js';
import MatchSetting from '#root/models/match-setting.js';
import Challenge from '#root/models/challenge.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import User from '#root/models/user.js';
import {
  MatchSettingStatus,
  ChallengeStatus,
  SubmissionStatus,
} from '#root/models/enum/enums.js';

const mockExecuteCodeTests = vi.fn();
vi.mock('#root/services/execute-code-tests.js', () => ({
  executeCodeTests: (...args) => mockExecuteCodeTests(...args),
}));

const buildMatchSetting = async (overrides = {}) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return MatchSetting.create({
    problemTitle: overrides.problemTitle || `Match Setting ${suffix}`,
    problemDescription:
      overrides.problemDescription ?? 'Default problem description',
    referenceSolution:
      overrides.referenceSolution ?? 'int main() { return 0; }',
    publicTests: overrides.publicTests ?? [{ input: [1], output: [1] }],
    privateTests: overrides.privateTests ?? [{ input: [1], output: [1] }],
    status: overrides.status ?? MatchSettingStatus.DRAFT,
  });
};

const createUser = async (suffix, role = 'student') =>
  User.create({
    username: `user_${suffix}`,
    password: 'password123',
    email: `user_${suffix}@example.com`,
    role,
  });

describe('Match Settings API', () => {
  let createdIds = [];

  beforeEach(() => {
    vi.resetAllMocks();
    mockExecuteCodeTests.mockResolvedValue({
      testResults: [],
      summary: { total: 1, passed: 1, failed: 0, allPassed: true },
      isCompiled: true,
      isPassed: true,
      errors: [],
    });
    createdIds = [];
  });

  afterEach(async () => {
    if (createdIds.length === 0) return;
    await MatchSetting.destroy({ where: { id: createdIds } });
  });

  it('returns draft and ready match settings', async () => {
    const draft = await buildMatchSetting({
      status: MatchSettingStatus.DRAFT,
    });
    const ready = await buildMatchSetting({
      status: MatchSettingStatus.READY,
    });
    createdIds.push(draft.id, ready.id);

    const res = await request(app).get('/api/rest/matchSettings');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ids = res.body.data.map((setting) => setting.id);
    expect(ids).toEqual(expect.arrayContaining([draft.id, ready.id]));
  });

  it('creates a draft with minimal fields', async () => {
    const res = await request(app).post('/api/rest/matchSettings').send({
      problemTitle: 'Draft only',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.problemTitle).toBe('Draft only');
    expect(res.body.data.status).toBe(MatchSettingStatus.DRAFT);
    expect(res.body.data.problemDescription).toBe('');
    expect(res.body.data.publicTests).toEqual([]);
    expect(res.body.data.privateTests).toEqual([]);

    createdIds.push(res.body.data.id);
  });

  it('blocks updates when the match setting is ready', async () => {
    const matchSetting = await buildMatchSetting({
      status: MatchSettingStatus.READY,
    });
    createdIds.push(matchSetting.id);

    const res = await request(app)
      .put(`/api/rest/matchSettings/${matchSetting.id}`)
      .send({ problemTitle: 'Updated title' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('unpublishes a ready match setting', async () => {
    const matchSetting = await buildMatchSetting({
      status: MatchSettingStatus.READY,
    });
    createdIds.push(matchSetting.id);

    const res = await request(app).post(
      `/api/rest/matchSettings/${matchSetting.id}/unpublish`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(MatchSettingStatus.DRAFT);
  });

  it('rejects publish when required fields are missing', async () => {
    const matchSetting = await buildMatchSetting({
      problemDescription: '',
      status: MatchSettingStatus.DRAFT,
    });
    createdIds.push(matchSetting.id);

    const res = await request(app).post(
      `/api/rest/matchSettings/${matchSetting.id}/publish`
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockExecuteCodeTests).not.toHaveBeenCalled();
  });

  it('publishes when validation and tests pass', async () => {
    const matchSetting = await buildMatchSetting({
      status: MatchSettingStatus.DRAFT,
    });
    createdIds.push(matchSetting.id);

    const res = await request(app).post(
      `/api/rest/matchSettings/${matchSetting.id}/publish`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(MatchSettingStatus.READY);
    expect(mockExecuteCodeTests).toHaveBeenCalledTimes(2);
  });

  it('duplicates a match setting as a draft', async () => {
    const baseTitle = `Original ${Date.now()}`;
    const matchSetting = await buildMatchSetting({
      problemTitle: baseTitle,
      status: MatchSettingStatus.READY,
    });
    createdIds.push(matchSetting.id);

    const res = await request(app).post(
      `/api/rest/matchSettings/${matchSetting.id}/duplicate`
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(MatchSettingStatus.DRAFT);
    expect(res.body.data.problemTitle).toMatch(/\(Copy/);
    expect(res.body.data.problemTitle).toContain(baseTitle);

    createdIds.push(res.body.data.id);
  });

  it('returns peer review tests for a match setting', async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ids = {
      users: [],
      challenges: [],
      challengeMatchSettings: [],
      participants: [],
      matches: [],
      submissions: [],
      assignments: [],
      matchSettings: [],
    };

    try {
      const matchSetting = await buildMatchSetting({
        status: MatchSettingStatus.READY,
      });
      ids.matchSettings.push(matchSetting.id);

      const challenge = await Challenge.create({
        title: `Challenge ${suffix}`,
        duration: 30,
        startDatetime: new Date(Date.now() - 60 * 60 * 1000),
        endDatetime: new Date(Date.now() + 60 * 60 * 1000),
        durationPeerReview: 20,
        allowedNumberOfReview: 2,
        status: ChallengeStatus.ENDED_PHASE_TWO,
      });
      ids.challenges.push(challenge.id);

      const challengeMatchSetting = await ChallengeMatchSetting.create({
        challengeId: challenge.id,
        matchSettingId: matchSetting.id,
      });
      ids.challengeMatchSettings.push(challengeMatchSetting.id);

      const reviewer = await createUser(`${suffix}-reviewer`);
      const author = await createUser(`${suffix}-author`);
      ids.users.push(reviewer.id, author.id);

      const reviewerParticipant = await ChallengeParticipant.create({
        challengeId: challenge.id,
        studentId: reviewer.id,
      });
      const authorParticipant = await ChallengeParticipant.create({
        challengeId: challenge.id,
        studentId: author.id,
      });
      ids.participants.push(reviewerParticipant.id, authorParticipant.id);

      const reviewerMatch = await Match.create({
        challengeMatchSettingId: challengeMatchSetting.id,
        challengeParticipantId: reviewerParticipant.id,
      });
      const authorMatch = await Match.create({
        challengeMatchSettingId: challengeMatchSetting.id,
        challengeParticipantId: authorParticipant.id,
      });
      ids.matches.push(reviewerMatch.id, authorMatch.id);

      const submission = await Submission.create({
        matchId: authorMatch.id,
        challengeParticipantId: authorParticipant.id,
        code: 'int main() { return 0; }',
        status: SubmissionStatus.PROBABLY_CORRECT,
        isFinal: true,
      });
      ids.submissions.push(submission.id);

      const assignment = await PeerReviewAssignment.create({
        submissionId: submission.id,
        reviewerId: reviewerParticipant.id,
        feedbackTests: [
          { input: '1 2', expectedOutput: '2 1', notes: 'Swap order' },
        ],
      });
      ids.assignments.push(assignment.id);

      const res = await request(app).get(
        `/api/rest/matchSettings/${matchSetting.id}/peer-review-tests`
      );

      if (res.status !== 200) {
        // eslint-disable-next-line no-console
      }
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.matchSetting.id).toBe(matchSetting.id);
      expect(res.body.data.totalTests).toBe(1);
      expect(res.body.data.tests[0].input).toBe('1 2');
      expect(res.body.data.tests[0].reviewer.username).toBe(reviewer.username);
    } finally {
      await PeerReviewAssignment.destroy({ where: { id: ids.assignments } });
      await Submission.destroy({ where: { id: ids.submissions } });
      await Match.destroy({ where: { id: ids.matches } });
      await ChallengeParticipant.destroy({ where: { id: ids.participants } });
      await ChallengeMatchSetting.destroy({
        where: { id: ids.challengeMatchSettings },
      });
      await Challenge.destroy({ where: { id: ids.challenges } });
      await MatchSetting.destroy({ where: { id: ids.matchSettings } });
      await User.destroy({ where: { id: ids.users } });
    }
  });
});
