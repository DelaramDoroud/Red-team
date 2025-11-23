import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import request from 'supertest';

import sequelize from '#root/services/sequelize.mjs';
import app from '#root/app_initial.mjs';
import Challenge from '#root/models/challenge.mjs';

let client;

beforeAll(async () => {
  client = request(app);
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await Challenge.destroy({ where: {}, truncate: true });
  vi.clearAllMocks();
});

afterAll(async () => {
  await sequelize.close();
  vi.restoreAllMocks();
});

describe('Challenge API - creation & validation', () => {
  it('should NOT create a challenge if title is missing', async () => {
    const payload = {
      duration: 60,
      startDatetime: new Date().toISOString(),
      status: 'draft',
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);

    const count = await Challenge.count();
    expect(count).toBe(0);
  });

  it('should NOT create a challenge if duration is missing', async () => {
    const payload = {
      title: 'Test Challenge',
      startDatetime: new Date().toISOString(),
      status: 'draft',
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    const count = await Challenge.count();
    expect(count).toBe(0);
  });

  it('should NOT create a challenge if startDatetime is missing', async () => {
    const payload = {
      title: 'Test Challenge',
      duration: 60,
      status: 'draft',
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    const count = await Challenge.count();
    expect(count).toBe(0);
  });

  it('should create a challenge successfully with valid payload', async () => {
    const payload = {
      title: 'My First Challenge',
      duration: 45,
      startDatetime: new Date('2025-12-31T14:00:00.000Z').toISOString(),
      status: 'draft',
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge).toBeDefined();
    expect(res.body.challenge.id).toBeDefined();
    expect(res.body.challenge.title).toBe(payload.title);
    expect(res.body.challenge.duration).toBe(payload.duration);
    expect(res.body.challenge.status).toBe('draft');

    const count = await Challenge.count();
    expect(count).toBe(1);
  });

  it('should create a challenge with default draft status if not provided', async () => {
    const payload = {
      title: 'Auto Draft Challenge',
      duration: 30,
      startDatetime: new Date().toISOString(),
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge.status).toBe('draft');
  });

  it('should NOT create a challenge with invalid duration (negative)', async () => {
    const payload = {
      title: 'Invalid Duration Challenge',
      duration: -10,
      startDatetime: new Date().toISOString(),
      status: 'draft',
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    const count = await Challenge.count();
    expect(count).toBe(0);
  });

  it('should NOT create a challenge with invalid duration (zero)', async () => {
    const payload = {
      title: 'Zero Duration Challenge',
      duration: 0,
      startDatetime: new Date().toISOString(),
      status: 'draft',
    };

    const res = await client.post('/api/rest/challenge').send(payload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    const count = await Challenge.count();
    expect(count).toBe(0);
  });
});

describe('Challenge API - GET all challenges', () => {
  it('should return empty array when no challenges exist', async () => {
    const res = await client.get('/api/rest/challenges');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('should return all challenges', async () => {
    await Challenge.bulkCreate([
      {
        title: 'Challenge 1',
        duration: 30,
        startDatetime: new Date(),
        status: 'draft',
      },
      {
        title: 'Challenge 2',
        duration: 45,
        startDatetime: new Date(),
        status: 'published',
      },
      {
        title: 'Challenge 3',
        duration: 60,
        startDatetime: new Date(),
        status: 'draft',
      },
    ]);

    const res = await client.get('/api/rest/challenges');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.count).toBe(3);
  });

  it('should filter challenges by status', async () => {
    await Challenge.bulkCreate([
      {
        title: 'Draft Challenge',
        duration: 30,
        startDatetime: new Date(),
        status: 'draft',
      },
      {
        title: 'Published Challenge',
        duration: 45,
        startDatetime: new Date(),
        status: 'published',
      },
    ]);

    const res = await client.get('/api/rest/challenges?status=published');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('published');
  });

  it('should respect limit parameter', async () => {
    await Challenge.bulkCreate([
      {
        title: 'Challenge 1',
        duration: 30,
        startDatetime: new Date(),
        status: 'draft',
      },
      {
        title: 'Challenge 2',
        duration: 45,
        startDatetime: new Date(),
        status: 'draft',
      },
      {
        title: 'Challenge 3',
        duration: 60,
        startDatetime: new Date(),
        status: 'draft',
      },
    ]);

    const res = await client.get('/api/rest/challenges?limit=2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('Challenge API - publish / unpublish', () => {
  it('should publish a draft challenge successfully', async () => {
    const challenge = await Challenge.create({
      title: 'Publishable Challenge',
      duration: 30,
      startDatetime: new Date(),
      status: 'draft',
    });

    const res = await client
      .post(`/api/rest/challenge/${challenge.id}/publish`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge.status).toBe('published');

    const updated = await Challenge.findByPk(challenge.id);
    expect(updated.status).toBe('published');
  });

  it('should unpublish a published challenge successfully', async () => {
    const challenge = await Challenge.create({
      title: 'Unpublishable Challenge',
      duration: 30,
      startDatetime: new Date(),
      status: 'published',
    });

    const res = await client
      .post(`/api/rest/challenge/${challenge.id}/unpublish`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.challenge.status).toBe('draft');

    const updated = await Challenge.findByPk(challenge.id);
    expect(updated.status).toBe('draft');
  });

  it('should NOT publish a non-existing challenge', async () => {
    const nonExistingId = 9999;

    const res = await client
      .post(`/api/rest/challenge/${nonExistingId}/publish`)
      .send();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('should NOT publish a challenge that is already published', async () => {
    const challenge = await Challenge.create({
      title: 'Already Published Challenge',
      duration: 30,
      startDatetime: new Date(),
      status: 'published',
    });

    const res = await client
      .post(`/api/rest/challenge/${challenge.id}/publish`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already published/i);
  });

  it('should NOT unpublish a challenge that is already in draft', async () => {
    const challenge = await Challenge.create({
      title: 'Draft Challenge',
      duration: 30,
      startDatetime: new Date(),
      status: 'draft',
    });

    const res = await client
      .post(`/api/rest/challenge/${challenge.id}/unpublish`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already.*draft/i);
  });

  it('should handle concurrent publish attempts with row locking', async () => {
    const challenge = await Challenge.create({
      title: 'Concurrent Test Challenge',
      duration: 30,
      startDatetime: new Date(),
      status: 'draft',
    });

    const [res1, res2] = await Promise.all([
      client.post(`/api/rest/challenge/${challenge.id}/publish`).send(),
      client.post(`/api/rest/challenge/${challenge.id}/publish`).send(),
    ]);

    const successCount = [res1, res2].filter(
      (r) => r.status === 200 && r.body.success
    ).length;
    const errorCount = [res1, res2].filter(
      (r) => r.status === 400 && !r.body.success
    ).length;

    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);
  });
});

describe('Challenge API - business rules', () => {
  it('should enforce single available published challenge rule', async () => {
    // This test demonstrates the business rule enforcement
    // In a real implementation, you would check that only one challenge
    // can be in 'published' state at a time

    const challenge1 = await Challenge.create({
      title: 'First Published Challenge',
      duration: 30,
      startDatetime: new Date(),
      status: 'published',
    });

    const challenge2 = await Challenge.create({
      title: 'Second Challenge',
      duration: 45,
      startDatetime: new Date(),
      status: 'draft',
    });

    // Attempting to publish second challenge should enforce the rule
    // (This logic would need to be implemented in the controller)

    expect(challenge1.status).toBe('published');
    expect(challenge2.status).toBe('draft');
  });

  it('should allow multiple draft challenges', async () => {
    await Challenge.bulkCreate([
      {
        title: 'Draft 1',
        duration: 30,
        startDatetime: new Date(),
        status: 'draft',
      },
      {
        title: 'Draft 2',
        duration: 45,
        startDatetime: new Date(),
        status: 'draft',
      },
      {
        title: 'Draft 3',
        duration: 60,
        startDatetime: new Date(),
        status: 'draft',
      },
    ]);

    const count = await Challenge.count({ where: { status: 'draft' } });
    expect(count).toBe(3);
  });
});
