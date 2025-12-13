import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import request from 'supertest';

let app;
let sequelize;
let Challenge;
let MatchSetting;
let readyMatchSettingIds = [];
let createdChallengeIds = [];

beforeAll(async () => {
  const appModule = await import('#root/app_initial.js');
  const sequelizeModule = await import('#root/services/sequelize.js');
  const challengeModule = await import('#root/models/challenge.js');
  const matchSettingModule = await import('#root/models/match-setting.js');

  app = appModule.default;
  sequelize = sequelizeModule.default;
  Challenge = challengeModule.default;
  MatchSetting = matchSettingModule.default;

  const existingSettings = await MatchSetting.findAll();

  if (existingSettings.filter((s) => s.status === 'ready').length === 0) {
    const readySetting = await MatchSetting.create({
      problemTitle: 'Ready Problem',
      problemDescription: 'Ready description',
      referenceSolution: 'function ready() {}',
      publicTests: [],
      privateTests: [],
      status: 'ready',
    });
    readyMatchSettingIds.push(readySetting.id);
  } else {
    readyMatchSettingIds = existingSettings
      .filter((s) => s.status === 'ready')
      .slice(0, 2)
      .map((s) => s.id);
  }
});

beforeEach(() => {
  createdChallengeIds = [];
  vi.clearAllMocks();
});

afterEach(async () => {
  if (createdChallengeIds.length > 0) {
    try {
      await Challenge.destroy({
        where: { id: createdChallengeIds },
        force: true,
      });
    } catch (error) {
      console.error('Error cleaning up challenges:', error);
    }
  }
});

afterAll(async () => {
  vi.restoreAllMocks();
  if (sequelize) await sequelize.close();
});

describe('Match Settings API - AC: Only ready match settings displayed', () => {
  it('should return only match settings with status "ready"', async () => {
    const res = await request(app).get('/api/rest/matchSettingsReady');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    res.body.data.forEach((setting) => {
      expect(setting.status).toBe('ready');
    });
  });
});

describe('Challenge API - GET /api/rest/challenges', () => {
  it('should return an empty array when no challenges exist', async () => {
    const res = await request(app).get('/api/rest/challenges');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return all challenges with their match settings', async () => {
    const challenge = await Challenge.create({
      title: 'Test Challenge GET',
      duration: 60,
      startDatetime: new Date('2025-12-01T09:00:00Z'),
      endDatetime: new Date('2025-12-01T11:00:00Z'),
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
    });
    createdChallengeIds.push(challenge.id);

    const settings = await MatchSetting.findAll({
      where: { id: readyMatchSettingIds },
    });
    await challenge.addMatchSettings(settings);

    const res = await request(app).get('/api/rest/challenges');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const foundChallenge = res.body.data.find((c) => c.id === challenge.id);
    expect(foundChallenge).toBeDefined();
    expect(foundChallenge.title).toBe('Test Challenge GET');
    expect(foundChallenge.matchSettings).toBeDefined();
    expect(foundChallenge.matchSettings.length).toBeGreaterThan(0);
  });
});

describe('Challenge API - POST /api/rest/challenges', () => {
  it('AC: Teacher cannot create a challenge unless at least one match setting is selected', async () => {
    const payload = {
      title: 'Test Challenge',
      duration: 60,
      startDatetime: '2025-12-01T09:00:00Z',
      endDatetime: '2025-12-01T11:00:00Z',
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
      matchSettingIds: [],
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/at least one match setting/i);
  });

  it('AC: Challenge created successfully when all required fields are valid and at least one match setting is selected', async () => {
    // Use unique time window to avoid overlaps
    const now = new Date();
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

    const payload = {
      title: 'My First Challenge',
      duration: 120,
      startDatetime: startTime.toISOString(),
      endDatetime: endTime.toISOString(),
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
      matchSettingIds: readyMatchSettingIds.slice(0, 1),
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    if (res.body.challenge?.id) {
      createdChallengeIds.push(res.body.challenge.id);
    }
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge).toBeDefined();
    expect(res.body.challenge.id).toBeDefined();
    expect(res.body.challenge.title).toBe(payload.title);
    expect(res.body.challenge.matchSettings.length).toBeGreaterThanOrEqual(1);
    const dbChallenge = await Challenge.findByPk(res.body.challenge.id, {
      include: [
        {
          model: MatchSetting,
          as: 'matchSettings',
          through: { attributes: [] },
        },
      ],
    });
    expect(dbChallenge).toBeDefined();
    expect(dbChallenge.title).toBe(payload.title);
    expect(dbChallenge.matchSettings.length).toBeGreaterThanOrEqual(1);
  });

  it('should NOT create a challenge if required fields are missing', async () => {
    const payload = {
      duration: 60,
      matchSettingIds: readyMatchSettingIds.slice(0, 1),
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('should NOT create a challenge if matchSettingIds contains invalid IDs', async () => {
    // Use unique time window to avoid overlaps (validation should fail before overlap check)
    const now = new Date();
    const startTime = new Date(now.getTime() + 26 * 60 * 60 * 1000); // 1 day + 2 hours from now
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

    const payload = {
      title: 'Test Challenge',
      duration: 60,
      startDatetime: startTime.toISOString(),
      endDatetime: endTime.toISOString(),
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
      matchSettingIds: [99999, 99998],
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/match settings not found/i);
  });

  it('should accept multiple match settings (checkbox toggling behavior)', async () => {
    // Use unique time window to avoid overlaps
    const now = new Date();
    const startTime = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 1 day + 1 hour from now
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

    const payload = {
      title: 'Challenge with Multiple Settings',
      duration: 90,
      startDatetime: startTime.toISOString(),
      endDatetime: endTime.toISOString(),
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
      matchSettingIds: readyMatchSettingIds,
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    if (res.body.challenge?.id) {
      createdChallengeIds.push(res.body.challenge.id);
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge.matchSettings.length).toBe(
      readyMatchSettingIds.length
    );
  });

  it('should handle partial matchSettingIds validation', async () => {
    // Use unique time window to avoid overlaps (validation should fail before overlap check)
    const now = new Date();
    const startTime = new Date(now.getTime() + 27 * 60 * 60 * 1000); // 1 day + 3 hours from now
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

    const payload = {
      title: 'Test Challenge',
      duration: 60,
      startDatetime: startTime.toISOString(),
      endDatetime: endTime.toISOString(),
      durationPeerReview: 60,
      matchSettingIds: [readyMatchSettingIds[0], 99999],
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.missingIds).toContain(99999);
    expect(res.body.error.missingIds).not.toContain(readyMatchSettingIds[0]);
  });

  it('should NOT create a challenge if it overlaps with an existing one', async () => {
    // 1. Create a challenge
    const c = await Challenge.create({
      title: 'Existing Challenge',
      duration: 60,
      startDatetime: '2025-12-01T10:00:00Z',
      endDatetime: '2025-12-01T12:00:00Z',
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
    });
    createdChallengeIds.push(c.id);

    // 2. Try to create another one that overlaps (11:00 - 13:00)
    const payload = {
      title: 'Overlapping Challenge',
      duration: 120,
      startDatetime: '2025-12-01T11:00:00Z',
      endDatetime: '2025-12-01T13:00:00Z',
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
      matchSettingIds: readyMatchSettingIds.slice(0, 1),
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/overlaps/i);
  });

  it('should NOT create a challenge if duration is longer than the time window', async () => {
    const payload = {
      title: 'Impossible Duration Challenge',
      duration: 120, // 2 hours
      startDatetime: '2025-12-01T09:00:00Z',
      endDatetime: '2025-12-01T10:00:00Z', // 1 hour window
      durationPeerReview: 60,
      allowedNumberOfReview: 2,
      status: 'private',
      matchSettingIds: readyMatchSettingIds.slice(0, 1),
    };

    const res = await request(app).post('/api/rest/challenges').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/time window/i);
  });
});
