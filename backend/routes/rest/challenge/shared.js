import { QueryTypes } from 'sequelize';
import { ChallengeStatus } from '#root/models/enum/enums.js';
import { broadcastEvent } from '#root/services/event-stream.js';
import {
  getRequestRole,
  getRequestUserId,
  isPrivilegedRole,
} from '#root/services/request-auth.js';
import sequelize from '#root/services/sequelize.js';

export const shouldHidePrivate = (req) =>
  !isPrivilegedRole(getRequestRole(req));

export const isEndedStatus = (status) =>
  status === ChallengeStatus.ENDED_CODING_PHASE ||
  status === ChallengeStatus.ENDED_PEER_REVIEW;

export const emitChallengeUpdate = (challenge) => {
  if (!challenge) return;
  broadcastEvent({
    event: 'challenge-updated',
    data: {
      challengeId: challenge.id,
      status: challenge.status,
    },
  });
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const normalizeCustomTests = (tests) =>
  (Array.isArray(tests) ? tests : [])
    .filter((testCase) => testCase && hasOwn(testCase, 'input'))
    .map((testCase) => ({
      input: testCase.input,
      output: hasOwn(testCase, 'output') ? testCase.output : null,
    }));

export const normalizeFeedbackTests = (tests) =>
  (Array.isArray(tests) ? tests : [])
    .filter((testCase) => testCase && hasOwn(testCase, 'input'))
    .map((testCase) => ({
      input: testCase.input,
      expectedOutput: hasOwn(testCase, 'expectedOutput')
        ? testCase.expectedOutput
        : null,
      notes:
        typeof testCase.notes === 'string' && testCase.notes.trim()
          ? testCase.notes.trim()
          : null,
    }));

export const parseTestResults = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const parseJsonValue = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const parseJsonValueStrict = (value, label) => {
  if (value === null || value === undefined) {
    return { ok: false, error: `${label} is required.` };
  }
  if (typeof value !== 'string') return { ok: true, value };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, error: `${label} must be valid JSON.` };
  }
};

export const executeInBatches = async (tasks, batchSize = 4) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return;
  const safeBatchSize = Math.max(1, Number(batchSize) || 1);
  for (let index = 0; index < tasks.length; index += safeBatchSize) {
    const batch = tasks.slice(index, index + safeBatchSize);
    await Promise.all(batch.map((task) => task()));
  }
};

export const getChallengeStatsMap = async (challengeIds) => {
  const statsMap = new Map();
  if (!Array.isArray(challengeIds) || challengeIds.length === 0) {
    return statsMap;
  }

  const rows = await sequelize.query(
    `
      SELECT
        cms."challenge_id" AS "challengeId",
        COUNT(m."id")::int AS "totalMatches",
        COUNT(DISTINCT s."match_id")::int AS "finalSubmissionCount"
      FROM "challenge_match_setting" AS cms
      LEFT JOIN "match" AS m
        ON m."challenge_match_setting_id" = cms."id"
      LEFT JOIN "submission" AS s
        ON s."match_id" = m."id"
        AND s."is_final" = true
      WHERE cms."challenge_id" IN (:challengeIds)
      GROUP BY cms."challenge_id"
    `,
    {
      replacements: { challengeIds },
      type: QueryTypes.SELECT,
    }
  );

  rows.forEach((row) => {
    const challengeId = Number(row.challengeId);
    if (!Number.isInteger(challengeId)) return;
    statsMap.set(challengeId, {
      totalMatches: Number(row.totalMatches) || 0,
      finalSubmissionCount: Number(row.finalSubmissionCount) || 0,
    });
  });

  return statsMap;
};

export const resolveStudentIdFromRequest = (req, explicitStudentId = null) => {
  const requestUserId = getRequestUserId(req);
  const requestRole = getRequestRole(req);
  if (!requestUserId || !requestRole) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required.',
    };
  }

  if (requestRole === 'student') {
    if (
      explicitStudentId &&
      Number.isInteger(explicitStudentId) &&
      explicitStudentId !== requestUserId
    ) {
      return {
        ok: false,
        status: 403,
        error: 'Not authorized.',
      };
    }
    return { ok: true, studentId: requestUserId };
  }

  if (!isPrivilegedRole(requestRole)) {
    return {
      ok: false,
      status: 403,
      error: 'Not authorized.',
    };
  }

  if (Number.isInteger(explicitStudentId) && explicitStudentId > 0) {
    return { ok: true, studentId: explicitStudentId };
  }

  return {
    ok: false,
    status: 400,
    error: 'Invalid studentId',
  };
};
