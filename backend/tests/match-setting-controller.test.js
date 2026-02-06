import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '#root/app_initial.js';
import MatchSetting from '#root/models/match-setting.js';
import { MatchSettingStatus } from '#root/models/enum/enums.js';

const { mockExecuteCodeTests } = vi.hoisted(() => ({
  mockExecuteCodeTests: vi.fn().mockImplementation(async ({ testCases }) => ({
    testResults: Array.isArray(testCases)
      ? testCases.map((testCase, index) => ({
          testIndex: index,
          passed: true,
          expectedOutput: testCase?.expectedOutput ?? '',
          actualOutput: testCase?.expectedOutput ?? '',
        }))
      : [],
    summary: {
      total: Array.isArray(testCases) ? testCases.length : 0,
      passed: Array.isArray(testCases) ? testCases.length : 0,
      failed: 0,
      allPassed: true,
    },
    isCompiled: true,
    isPassed: true,
    errors: [],
  })),
}));
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
});
