import { NETWORK_RESPONSE_NOT_OK } from '#js/constants';

const buildReadableError = ({ message, code }) => {
  if (code === 'challenge_overlap') {
    return {
      message:
        'This challenge overlaps another scheduled challenge. Choose a different time or keep it private.',
      code,
    };
  }
  if (!message) {
    return { message: 'An unknown error occurred', code: null };
  }
  return { message, code: code || null };
};

const readErrorPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const errorCode = payload?.error?.code || payload?.code || null;

  if (payload?.error?.errors?.length > 0) {
    return { message: payload.error.errors[0].message, code: errorCode };
  }
  if (payload?.errors?.length > 0) {
    return { message: payload.errors[0].message, code: errorCode };
  }
  if (typeof payload?.message === 'string') {
    return { message: payload.message, code: errorCode };
  }
  if (typeof payload?.error?.message === 'string') {
    return { message: payload.error.message, code: errorCode };
  }
  return { message: null, code: errorCode };
};

export const parseChallengeMutationError = (result) => {
  const fallback = { message: 'An unknown error occurred', code: null };
  if (!result) return fallback;

  if (typeof result.message === 'string') {
    if (!result.message.startsWith(NETWORK_RESPONSE_NOT_OK)) {
      return buildReadableError({ message: result.message, code: null });
    }

    const rawMessage = result.message.slice(NETWORK_RESPONSE_NOT_OK.length);
    try {
      const jsonError = JSON.parse(rawMessage);
      return buildReadableError(readErrorPayload(jsonError) || fallback);
    } catch {
      return fallback;
    }
  }

  const payloads = [];
  if (result.details && typeof result.details === 'object') {
    payloads.push(result.details);
  }
  if (result.error && typeof result.error === 'object') {
    payloads.push({ error: result.error });
  }
  if (result.message && typeof result.message === 'object') {
    payloads.push({ error: result.message });
  }

  const parsed = payloads
    .map((payload) => readErrorPayload(payload))
    .find((entry) => entry?.message || entry?.code);

  if (parsed) {
    return buildReadableError(parsed);
  }

  return fallback;
};

export const toISODateTime = (localDateTime) => {
  if (!localDateTime) return null;
  const dt = new Date(localDateTime);
  return dt.toISOString();
};
