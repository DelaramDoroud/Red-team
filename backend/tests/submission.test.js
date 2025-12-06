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
      // Create test user
      user = await User.create(
        {
          username: `testuser_${Date.now()}`,
          password: 'testpassword123',
          role: 'student',
        },
        { transaction }
      );

      // Create test match setting
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

      // Create test challenge
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

      // Create challenge match setting
      challengeMatchSetting = await ChallengeMatchSetting.create(
        {
          challengeId: challenge.id,
          matchSettingId: matchSetting.id,
        },
        { transaction }
      );

      // Create challenge participant
      participant = await ChallengeParticipant.create(
        {
          studentId: user.id,
          challengeId: challenge.id,
        },
        { transaction }
      );

      // Create match
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
    // Clean up
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

  describe('POST /api/rest/submissions', () => {
    it('should successfully compile and test valid C++ code', async () => {
      const validCode = `#include <iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b;
  return 0;
}`;

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: validCode,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.submission).toBeDefined();
    });

    it('should return compilation error for invalid C++ code and not save', async () => {
      const invalidCode = 'INVALID_CODE();';

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: invalidCode,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain('did not compile');
      expect(res.body.error.compilationError).toBeDefined();

      const savedCount = await Submission.count({
        where: { matchId: match.id },
      });
      expect(savedCount).toBe(0);
    });

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

    it('should save submission to database on success', async () => {
      const validCode = `#include <iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b;
  return 0;
}`;

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: validCode,
      });

      expect(res.status).toBe(200);

      const savedSubmission = await Submission.findOne({
        where: { matchId: match.id },
      });

      expect(savedSubmission).toBeDefined();
      expect(savedSubmission.code).toBe(validCode);
    });
  });

  describe('GET /api/rest/submissions/:matchId', () => {
    it('should return all submissions', async () => {
      // Create multiple submissions
      const code1 = `#include <iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b;
  return 0;
}`;

      const code2 = `#include <iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a * b;
  return 0;
}`;

      await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: code1,
      });

      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

      await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: code2,
      });

      const res = await request(app).get(`/api/rest/submissions/${match.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should return empty array for match with no submissions', async () => {
      const res = await request(app).get(`/api/rest/submissions/${match.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/rest/submission/:id', () => {
    it('should return a specific submission', async () => {
      const code = `#include <iostream>
using namespace std;
int main() {
  int a, b;
  cin >> a >> b;
  cout << a + b;
  return 0;
}`;

      const postRes = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code,
      });

      const submissionId = postRes.body.data.submission.id;

      const getRes = await request(app).get(
        `/api/rest/submission/${submissionId}`
      );

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.id).toBe(submissionId);
      expect(getRes.body.data.matchId).toBe(match.id);
    });

    it('should return 404 for non-existent submission', async () => {
      const res = await request(app).get('/api/rest/submission/99999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not found');
    });
  });
});
