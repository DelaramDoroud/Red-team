const readEnv = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
    return import.meta.env[key];
  }

  if (typeof process !== 'undefined' && process?.env?.[key]) {
    return process.env[key];
  }

  return undefined;
};

const defaultOrigin =
  typeof window !== 'undefined' && window?.location?.origin
    ? window.location.origin
    : 'http://localhost:3001';

export const API_URL = readEnv('VITE_API_URL') || `${defaultOrigin}/api/rest`;

export const API_REST_BASE =
  readEnv('VITE_API_REST_BASE') || `${defaultOrigin}/api/rest`;

export const NETWORK_RESPONSE_NOT_OK = 'Network response was not ok: ';

export const ChallengeStatus = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  ASSIGNED: 'assigned',
  STARTED_CODING_PHASE: 'started_coding_phase',
  ENDED_CODING_PHASE: 'ended_coding_phase',
  STARTED_PEER_REVIEW: 'started_peer_review',
  ENDED_PEER_REVIEW: 'ended_peer_review',
};

export const ChallengeStatusLabels = {
  [ChallengeStatus.PUBLIC]: 'Public',
  [ChallengeStatus.PRIVATE]: 'Private',
  [ChallengeStatus.ASSIGNED]: 'Assigned',
  [ChallengeStatus.STARTED_CODING_PHASE]: 'Coding phase in progress',
  [ChallengeStatus.ENDED_CODING_PHASE]: 'Coding phase complete',
  [ChallengeStatus.STARTED_PEER_REVIEW]: 'Peer review in progress',
  [ChallengeStatus.ENDED_PEER_REVIEW]: 'Completed',
};

export const getChallengeStatusLabel = (status) => {
  if (status === 'draft') return 'Private';
  return ChallengeStatusLabels[status] || status || 'Unknown';
};

export const MatchSettingStatus = {
  DRAFT: 'draft',
  READY: 'ready',
};

export const BadgeCategory = {
  CHALLENGE_MILESTONE: 'challenge_milestone',
  REVIEW_MILESTONE: 'review_milestone',
  REVIEW_QUALITY: 'review_quality',
};

export const BadgeLevel = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
};

export const BadgeMetric = {
  CHALLENGES_COMPLETED: 'challenges_completed',
  REVIEWS_COMPLETED: 'reviews_completed',
  CORRECT_REVIEWS: 'correct_reviews',
  ERRORS_FOUND: 'errors_found',
};
