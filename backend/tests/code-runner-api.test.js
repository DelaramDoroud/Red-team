import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import MatchSetting from '#root/models/match-setting.js';
import { MatchSettingStatus } from '#root/models/enum/enums.js';
import sequelize from '#root/services/sequelize.js';
import {
  pythonCorrectTwoSum,
  pythonIncorrectTwoSum,
  pythonSyntaxError,
  pythonInfiniteLoop,
} from './student-code/python.js';
import { cppCorrectTwoSum, cppInvalid } from './student-code/cpp.js';

let app;
let testMatchSettingId;
let prevTestTimeoutEnv;
const TEST_PROBLEM_TITLE = 'Two Sum (Code Runner API Tests)';

beforeAll(async () => {
  // Force shorter execution timeout for tests only (affects worker -> runCode)
  prevTestTimeoutEnv = process.env.CODE_RUNNER_TEST_TIMEOUT_MS;
  process.env.CODE_RUNNER_TEST_TIMEOUT_MS = '2000';

  const appModule = await import('#root/app_initial.js');
  app = appModule.default;

  const publicTests = [
    { input: [[2, 7, 11, 15], 9], output: [0, 1] },
    { input: [[3, 2, 4], 6], output: [1, 2] },
  ];

  const privateTests = [
    { input: [[3, 3], 6], output: [0, 1] },
    { input: [[-1, -2, -3, -4, -5], -8], output: [2, 4] },
  ];

  let matchSetting = await MatchSetting.findOne({
    where: { problemTitle: TEST_PROBLEM_TITLE },
  });

  const baseData = {
    problemTitle: TEST_PROBLEM_TITLE,
    problemDescription:
      'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    referenceSolution: `function solve(input) {
  const [nums, target] = input;
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}`,
    publicTests,
    privateTests,
    status: MatchSettingStatus.READY,
  };

  if (!matchSetting) {
    matchSetting = await MatchSetting.create(baseData);
  } else {
    await matchSetting.update(baseData);
  }

  testMatchSettingId = matchSetting.id;
});

afterAll(async () => {
  // Restore timeout env
  if (prevTestTimeoutEnv === undefined)
    delete process.env.CODE_RUNNER_TEST_TIMEOUT_MS;
  else process.env.CODE_RUNNER_TEST_TIMEOUT_MS = prevTestTimeoutEnv;

  if (sequelize) await sequelize.close();
});

describe('Code Runner API - POST /api/rest/run', () => {
  it('should execute correct Python code and pass all tests', async () => {
    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: pythonCorrectTwoSum,
      language: 'python',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);

    if (res.body.summary.passed !== res.body.summary.total) {
      // Useful debug in CI logs if it ever fails
      // eslint-disable-next-line no-console
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
    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: pythonIncorrectTwoSum,
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

  it('should execute correct C++ code and pass all tests', async () => {
    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: cppCorrectTwoSum,
      language: 'cpp',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);
    if (res.body.summary.passed !== res.body.summary.total) {
      // Useful debug in CI logs if it ever fails
      // eslint-disable-next-line no-console
      console.log('C++ results:', JSON.stringify(res.body.results, null, 2));
    }
    expect(res.body.summary.passed).toBe(res.body.summary.total);
    expect(res.body.summary.failed).toBe(0);
    expect(res.body.summary.allPassed).toBe(true);
    expect(res.body.results).toBeDefined();
    expect(res.body.results.length).toBe(res.body.summary.total);
    res.body.results.forEach((r) => {
      expect(r.passed).toBe(true);
      expect(r.exitCode).toBe(0);
      expect(r.stderr).toBe('');
    });
  }, 180000);

  it('should report compilation errors for invalid C++ code', async () => {
    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: cppInvalid,
      language: 'cpp',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total).toBeGreaterThan(0);
    expect(res.body.summary.passed).toBe(0);
    expect(res.body.summary.failed).toBe(res.body.summary.total);
    expect(res.body.results).toBeDefined();
    res.body.results.forEach((r) => {
      expect(r.passed).toBe(false);
      expect(r.exitCode).not.toBe(0);
      expect(String(r.stderr).toLowerCase()).toContain('error');
    });
  }, 180000);

  it('should handle Python code with syntax errors', async () => {
    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: pythonSyntaxError,
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
    const res = await request(app).post('/api/rest/run').send({
      matchSettingId: testMatchSettingId,
      code: pythonInfiniteLoop,
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
