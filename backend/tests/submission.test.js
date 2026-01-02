import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import { ChallengeStatus } from '#root/models/enum/enums.js';
import { IMPORTS_END_MARKER } from '#root/services/import-validation.js';

// Mock executeCodeTests service
const mockExecuteCodeTests = vi.fn();
vi.mock('#root/services/execute-code-tests.js', () => ({
  executeCodeTests: (...args) => mockExecuteCodeTests(...args),
}));

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

    // Default mock: always successful compilation and passing tests
    mockExecuteCodeTests.mockResolvedValue({
      testResults: [
        {
          testIndex: 0,
          passed: true,
          exitCode: 0,
          stdout: '5',
          stderr: '',
          expectedOutput: '5',
          actualOutput: '5',
          executionTime: 100,
        },
        {
          testIndex: 1,
          passed: true,
          exitCode: 0,
          stdout: '30',
          stderr: '',
          expectedOutput: '30',
          actualOutput: '30',
          executionTime: 100,
        },
      ],
      summary: {
        total: 2,
        passed: 2,
        failed: 0,
        allPassed: true,
      },
      isCompiled: true,
      isPassed: true,
      errors: [],
    });

    transaction = await sequelize.transaction();

    try {
      const suffix = Date.now();
      user = await User.create(
        {
          username: `testuser_${suffix}`,
          password: 'testpassword123',
          email: `testuser_${suffix}@mail.com`,
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

    it('rejects non-include lines before the imports marker', async () => {
      const badCode = [
        '#include <iostream>',
        'int notAllowed = 0;',
        IMPORTS_END_MARKER,
        'int main() { return 0; }',
      ].join('\n');

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: badCode,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/#include/i);
      expect(mockExecuteCodeTests).not.toHaveBeenCalled();
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
      expect(submission.code).toBe('int main() { return 0; }');
    });

    it('updates existing submission code', async () => {
      const existing = await Submission.create({
        matchId: match.id,
        challengeParticipantId: participant.id,
        code: 'int main() { return 1; }',
      });

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: 'int main() { return 2; }',
      });

      expect(res.status).toBe(200);

      await existing.reload();
      expect(existing.code).toBe('int main() { return 2; }');
    });

    it('rejects submission when code does not compile', async () => {
      // Mock executeCodeTests to simulate compilation error
      mockExecuteCodeTests.mockResolvedValueOnce({
        testResults: [
          {
            testIndex: 0,
            passed: false,
            exitCode: 1,
            stdout: '',
            stderr: 'error: expected ; before }',
            expectedOutput: '5',
            actualOutput: null,
            executionTime: 0,
          },
        ],
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          allPassed: false,
        },
        isCompiled: false,
        isPassed: false,
        errors: [
          {
            testIndex: 0,
            error: 'error: expected ; before }',
            exitCode: 1,
          },
        ],
      });

      const res = await request(app).post('/api/rest/submissions').send({
        matchId: match.id,
        code: 'int main() { return }', // intentionally invalid C++ code
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const submission = await Submission.findOne({
        where: { matchId: match.id },
      });

      expect(submission).toBeNull(); // Should not be saved
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
      });

      const res = await request(app).get(
        `/api/rest/submission/${submission.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.submission.id).toBe(submission.id);
    });
  });
});
