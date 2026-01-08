export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/rest';

export const API_REST_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/rest';

export const NETWORK_RESPONSE_NOT_OK = 'Network response was not ok: ';

export const ChallengeStatus = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  ASSIGNED: 'assigned',
  STARTED_PHASE_ONE: 'started_phase_one',
  ENDED_PHASE_ONE: 'ended_phase_one',
  STARTED_PHASE_TWO: 'started_phase_two',
  ENDED_PHASE_TWO: 'ended_phase_two',
};

export const MatchSettingStatus = {
  DRAFT: 'draft',
  READY: 'ready',
};
