import { ChallengeStatus } from '#js/constants';

export const COUNTDOWN_DURATION = 5;

export const isPrivateStatus = (status) =>
  status === ChallengeStatus.PRIVATE || status === 'draft';

export const getChallengeStartTimestamp = (challenge) => {
  const value = challenge?.startCodingPhaseDateTime || challenge?.startDatetime;
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return timestamp;
};

export const isActiveStatus = (challenge, nowMs) => {
  const status = challenge?.status;
  if (
    status === ChallengeStatus.STARTED_CODING_PHASE ||
    status === ChallengeStatus.ENDED_CODING_PHASE ||
    status === ChallengeStatus.STARTED_PEER_REVIEW
  ) {
    return true;
  }
  if (
    status === ChallengeStatus.PUBLIC ||
    status === ChallengeStatus.ASSIGNED
  ) {
    const startTimestamp = getChallengeStartTimestamp(challenge);
    if (startTimestamp === null) return false;
    return startTimestamp <= nowMs;
  }
  return false;
};

export const isUpcomingStatus = (challenge, nowMs) => {
  const status = challenge?.status;
  if (
    status === ChallengeStatus.PUBLIC ||
    status === ChallengeStatus.ASSIGNED
  ) {
    const startTimestamp = getChallengeStartTimestamp(challenge);
    if (startTimestamp === null) return true;
    return startTimestamp > nowMs;
  }
  return false;
};

export const isEndedStatus = (status) =>
  status === ChallengeStatus.ENDED_PEER_REVIEW;

const parseNumericValue = (value) => {
  if (value === '' || value === null || value === undefined) return value;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const getMatchSettingIds = (challenge) => {
  if (Array.isArray(challenge?.matchSettingIds)) {
    return challenge.matchSettingIds.filter((id) => Number.isInteger(id));
  }
  if (Array.isArray(challenge?.matchSettings)) {
    return challenge.matchSettings
      .map((setting) => setting?.id)
      .filter((id) => Number.isInteger(id));
  }
  return [];
};

export const buildPublishPayload = (challenge) => ({
  id: challenge?.id,
  title: challenge?.title,
  duration: parseNumericValue(challenge?.duration),
  startDatetime: challenge?.startDatetime,
  endDatetime: challenge?.endDatetime,
  durationPeerReview: parseNumericValue(challenge?.durationPeerReview),
  allowedNumberOfReview: parseNumericValue(challenge?.allowedNumberOfReview),
  matchSettingIds: getMatchSettingIds(challenge),
  status: ChallengeStatus.PUBLIC,
});

export const getNoticeClassName = (styles, tone) => {
  if (tone === 'success') return styles.noticeSuccess;
  if (tone === 'warning') return styles.noticeWarning;
  return styles.noticeError;
};
