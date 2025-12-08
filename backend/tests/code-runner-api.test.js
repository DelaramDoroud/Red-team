import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import MatchSetting from '#root/models/match-setting.js';
import { MatchSettingStatus } from '#root/models/enum/enums.js';
import sequelize from '#root/services/sequelize.js';

let app;
let testMatchSettingId;

beforeAll(async () => {
  const appModule = await import('#root/app_initial.js');
  app = appModule.default;

  // Try to find existing match setting with public tests
  let matchSetting = await MatchSetting.findOne({
    where: {
      status: MatchSettingStatus.READY,
    },
    order: [['id', 'ASC']],
  });

  // If no match setting exists or it has no public tests, create one
  if (
    !matchSetting ||
    !Array.isArray(matchSetting.publicTests) ||
    matchSetting.publicTests.length === 0
  ) {
    matchSetting = await MatchSetting.create({
      problemTitle: 'Two Sum',
      problemDescription:
        'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      referenceSolution: `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
      publicTests: [
        { input: [[2, 7, 11, 15], 9], output: [0, 1] },
        { input: [[3, 2, 4], 6], output: [1, 2] },
      ],
      privateTests: [{ input: [[3, 3], 6], output: [0, 1] }],
      status: MatchSettingStatus.READY,
    });
  }

  testMatchSettingId = matchSetting.id;
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

  it('should execute incorrect Python code and fail tests', async () => {
    const incorrectCode = `import json
nums, target = input_data
# Wrong implementation - always returns [0, 1]
print(json.dumps([0, 1]))`;

    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: incorrectCode,
      language: 'python',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(res.body.summary.passed).toBeLessThan(res.body.summary.total);
    expect(res.body.summary.failed).toBeGreaterThan(0);
    expect(res.body.summary.allPassed).toBe(false);
    expect(res.body.data.isCompiled).toBe(true);
    expect(res.body.data.isPassed).toBe(false);
    expect(res.body.data.error).toBeDefined();
    expect(res.body.results).toBeDefined();

    // At least one result should have failed
    const failedResults = res.body.results.filter((r) => !r.passed);
    expect(failedResults.length).toBeGreaterThan(0);

    failedResults.forEach((result) => {
      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(0); // Code compiled and ran, just wrong output
    });
  }, 180000);

  it('should handle Python code with syntax errors', async () => {
    const syntaxErrorCode = `import json
nums, target = input_data
# Syntax error - missing colon
for i, num in enumerate(nums)
    print(json.dumps([i, i]))`;

    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: syntaxErrorCode,
      language: 'python',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(res.body.data.isPassed).toBe(false);
    expect(res.body.data.error).toBeDefined();
    expect(res.body.results).toBeDefined();

    // All results should have failed with syntax errors
    res.body.results.forEach((result) => {
      expect(result.passed).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeDefined();
      expect(result.stderr.length).toBeGreaterThan(0);
      // Check for syntax error indicators in stderr
      const stderrLower = result.stderr.toLowerCase();
      expect(
        stderrLower.includes('syntax') ||
          stderrLower.includes('syntaxerror') ||
          stderrLower.includes('invalid syntax')
      ).toBe(true);
    });
  }, 180000);

  it('should timeout infinite loop code', async () => {
    const infiniteLoopCode = `import json
# Infinite loop - should timeout
while True:
    pass`;

    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: infiniteLoopCode,
      language: 'python',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(res.body.data.isCompiled).toBe(true);
    expect(res.body.data.isPassed).toBe(false);
    expect(res.body.results).toBeDefined();

    // All results should have failed due to timeout
    res.body.results.forEach((result) => {
      expect(result.passed).toBe(false);
      // Timeout should result in exit code 124 or -1
      expect([124, -1]).toContain(result.exitCode);
      // Should have timeout error message
      const errorMsg = result.stderr || result.stdout || '';
      expect(
        errorMsg.toLowerCase().includes('timeout') ||
          errorMsg.toLowerCase().includes('execution timeout')
      ).toBe(true);
    });
  }, 180000);
});
