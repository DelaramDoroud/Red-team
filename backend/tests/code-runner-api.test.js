import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import MatchSetting from '#root/models/match-setting.js';
import sequelize from '#root/services/sequelize.js';

let app;
const testMatchSettingId = 1;

beforeAll(async () => {
  const appModule = await import('#root/app_initial.js');
  app = appModule.default;

  const matchSetting = await MatchSetting.findByPk(testMatchSettingId);
  if (!matchSetting) {
    throw new Error(
      `Match setting with id ${testMatchSettingId} not found. Please ensure it exists.`
    );
  }
  if (
    !Array.isArray(matchSetting.publicTests) ||
    matchSetting.publicTests.length === 0
  ) {
    throw new Error(
      `Match setting with id ${testMatchSettingId} has no public tests.`
    );
  }
});

afterAll(async () => {
  if (sequelize) await sequelize.close();
});

describe('Code Runner API - POST /api/rest/run', () => {
  it('should execute correct Python code and pass all tests', async () => {
    const correctCode = `import json
nums, target = input_data
map = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in map:
        print(json.dumps([map[complement], i]))
        break
    map[num] = i`;

    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: correctCode,
      language: 'python',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);

    if (res.body.summary.passed !== res.body.summary.total) {
      console.log('Test results:', JSON.stringify(res.body.results, null, 2));
    }

    expect(res.body.summary.passed).toBe(res.body.summary.total);
    expect(res.body.summary.failed).toBe(0);
    expect(res.body.summary.allPassed).toBe(true);
    expect(res.body.results).toBeDefined();
    expect(res.body.results.length).toBe(res.body.summary.total);

    res.body.results.forEach((result) => {
      expect(result.passed).toBe(true);
      expect(result.actualOutput).toEqual(result.expectedOutput);
      expect(result.exitCode).toBe(0);
    });
  }, 180000);
});
