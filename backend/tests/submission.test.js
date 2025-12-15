import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import axios from 'axios';

import sequelize from '#root/services/sequelize.js';
import app from '#root/app_initial.js';

import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import Challenge from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import User from '#root/models/user.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';

vi.mock('axios');

describe('Submission API', () => {
  let challenge;
  let matchSetting;
  let challengeMatchSetting;
  let user;
  let participant;
  let match;
  let transaction;

  beforeEach(async () => {
    vi.resetAllMocks();

    axios.post.mockResolvedValue({
      data: { success: true },
    });

    transaction = await sequelize.transaction();

    try {
      user = await User.create(
        {
          username: `testuser_${Date.now()}`,
          password: 'testpassword123',
          role: 'student',
        },
        { transaction }
      );

      matchSetting = await MatchSetting.create(
        {
          problemTitle: 'Test Sum Problem',
          problemDescription: 'Write a program that adds two numbers',
          referenceSolution:
            '#include <iostream>\nusing namespace std;\nint main() { int a, b; cin >> a >> b; cout << a + b; return 0; }',
          publicTests: [
            { input: ['2', '3'], output: '5' },
            { input: ['10', '20'], output: '30' },
          ],
          privateTests: [{ input: ['1', '1'], output: '2' }],
          status: 'ready',
        },
        { transaction }
      );

      challenge = await Challenge.create(
        {
          title: 'Test Challenge',
          duration: 60,
          startDatetime: new Date('2025-12-20T10:00:00Z'),
          endDatetime: new Date('2025-12-20T12:00:00Z'),
          durationPeerReview: 30,
          allowedNumberOfReview: 2,
          status: ChallengeStatus.STARTED_PHASE_ONE,
        },
        { transaction }
      );

      challengeMatchSetting = await ChallengeMatchSetting.create(
        {
          challengeId: challenge.id,
          matchSettingId: matchSetting.id,
        },
        { transaction }
      );

      participant = await ChallengeParticipant.create(
        {
          studentId: user.id,
          challengeId: challenge.id,
        },
        { transaction }
      );

      match = await Match.create(
        {
          challengeMatchSettingId: challengeMatchSetting.id,
          challengeParticipantId: participant.id,
        },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  });

  afterEach(async () => {
    await Submission.destroy({ where: {} });
    await Match.destroy({ where: {} });
    await ChallengeParticipant.destroy({ where: {} });
    await ChallengeMatchSetting.destroy({ where: {} });
    await Challenge.destroy({ where: {} });
    await MatchSetting.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('POST /api/rest/submissions', () => {
    it('rejects submission without matchId', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        code: 'int main() { return 0; }',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects submission without code', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects empty code', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: '   ',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for non-existent match', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: 999999,
        code: 'int main() { return 0; }',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('creates a new submission when code compiles', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: 'int main() { return 0; }',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const submission = await Submission.findOne({
        where: { matchId: match.id },
      });

      expect(submission).toBeDefined();
      expect(submission.submissions_count).toBe(1);
    });

    it('updates existing submission and increments submissions_count', async () => {
      const existing = await Submission.create({
        matchId: match.id,
        challengeParticipantId: participant.id,
        code: 'int main() { return 1; }',
        submissions_count: 1,
      });

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: 'int main() { return 2; }',
      });

      expect(res.status).toBe(200);

      await existing.reload();
      expect(existing.submissions_count).toBe(2);
    });

    it('rejects submission when code does not compile', async () => {
      axios.post.mockResolvedValueOnce({
        data: { success: false },
      });

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: 'int main() { return }',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const submission = await Submission.findOne({
        where: { matchId: match.id },
      });

      expect(submission).toBeNull();
    });
  });

  describe('GET /api/rest/submission/:id', () => {
    it('returns 400 for invalid id', async () => {
      const res = await request(app).get('/api/rest/submission/abc');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 when submission does not exist', async () => {
      const res = await request(app).get('/api/rest/submission/999999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns submission by id', async () => {
      const submission = await Submission.create({
        matchId: match.id,
        challengeParticipantId: participant.id,
        code: 'int main() { return 0; }',
        submissions_count: 1,
      });

      const res = await request(app).get(
        `/api/rest/submission/${submission.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.submission.id).toBe(submission.id);
    });
  });
});
