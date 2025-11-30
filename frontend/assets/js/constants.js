export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/rest';

export const NETWORK_RESPONSE_NOT_OK = 'Network response was not ok: ';

export const ChallengeStatus = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  ASSIGNED: 'assigned',
  STARTED: 'started',
  ENDED: 'ended',
};

export const MatchSettingStatus = {
  DRAFT: 'draft',
  READY: 'ready',
};
