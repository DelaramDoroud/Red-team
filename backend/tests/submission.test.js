import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import sequelize from '#root/services/sequelize.js';
import app from '#root/app_initial.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import Challenge from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import User from '#root/models/user.js';

describe('Submission API', () => {
  let challenge;
  let matchSetting;
  let challengeMatchSetting;
  let user;
  let participant;
  let match;
  let transaction;

  beforeEach(async () => {
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
          status: 'started',
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
    try {
      await Submission.destroy({ where: {} });
      await Match.destroy({ where: {} });
      await ChallengeParticipant.destroy({ where: {} });
      await ChallengeMatchSetting.destroy({ where: {} });
      await Challenge.destroy({ where: {} });
      await MatchSetting.destroy({ where: {} });
      await User.destroy({ where: {} });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  //
  // -------------------------------------------------------------------------
  // TEST POST /api/rest/submissions
  // -------------------------------------------------------------------------
  //

  describe('POST /api/rest/submissions', () => {
    it('should reject submission without matchId', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        code: 'int main() { return 0; }',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Missing required fields');
    });

    it('should reject submission without code', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Missing required fields');
    });

    it('should reject submission with empty code', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: '   \n\n  ',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('empty');
    });

    it('should return 404 for non-existent match', async () => {
      const res = await request(app).post('/api/rest/submissions').send({
        matchId: 99999,
        code: 'int main() { return 0; }',
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not found');
    });

    it('should create a new submission with submissions_count=1', async () => {
      const code = 'int main() { return 0; }';

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code,
      });

      expect(res.status).toBe(200);

      const submission = await Submission.findOne({
        where: { matchId: match.id },
      });

      expect(submission).toBeDefined();
      expect(submission.code).toBe(code);
      expect(submission.submissions_count).toBe(1);
    });

    it('should update existing submission and increment submissions_count', async () => {
      const initialSubmission = await Submission.create({
        matchId: match.id,
        code: 'int main() { return 1; }',
        submissions_count: 1,
      });

      const updatedCode = 'int main() { return 2; }';

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: updatedCode,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Submission.findOne({
        where: { matchId: match.id },
      });

      expect(updated).toBeDefined();
      expect(updated.id).toBe(initialSubmission.id);
      expect(updated.code).toBe(updatedCode);
      expect(updated.submissions_count).toBe(2);
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(initialSubmission.updatedAt).getTime()
      );
    });
  });

  //
  // -------------------------------------------------------------------------
  // TEST GET /api/rest/submission/:id
  // -------------------------------------------------------------------------
  //

  describe('GET /api/rest/submission/:id', () => {
    it('should return 400 for invalid ID', async () => {
      const res = await request(app).get('/api/rest/submission/abc');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('must be a number');
    });

    it('should return 404 if submission not found', async () => {
      const res = await request(app).get('/api/rest/submission/999999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not found');
    });

    it('should return submission by ID', async () => {
      const submission = await Submission.create({
        matchId: match.id,
        code: 'int main() { return 0; }',
        submissions_count: 1,
      });

      const res = await request(app).get(
        `/api/rest/submission/${submission.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.submission.id).toBe(submission.id);
      expect(res.body.data.submission.code).toBe(submission.code);
    });
  });
});
