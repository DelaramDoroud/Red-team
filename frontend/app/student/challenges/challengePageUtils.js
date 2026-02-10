import { ChallengeStatus } from '#js/constants';

export const ALLOWED_ROLES = ['student'];

export const unjoinableStatuses = new Set([
  ChallengeStatus.STARTED_CODING_PHASE,
  ChallengeStatus.ENDED_CODING_PHASE,
  ChallengeStatus.STARTED_PEER_REVIEW,
  ChallengeStatus.ENDED_PEER_REVIEW,
]);

export const statusStyles = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/15',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-200',
  [ChallengeStatus.STARTED_CODING_PHASE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-200',
  [ChallengeStatus.STARTED_PEER_REVIEW]:
    'bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-200',
  [ChallengeStatus.ENDED_CODING_PHASE]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-200',
  [ChallengeStatus.ENDED_PEER_REVIEW]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

export const activeStatuses = new Set([
  ChallengeStatus.ASSIGNED,
  ChallengeStatus.STARTED_CODING_PHASE,
  ChallengeStatus.ENDED_CODING_PHASE,
  ChallengeStatus.STARTED_PEER_REVIEW,
]);

const getStartTimestamp = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return timestamp;
};

export const getChallengeStartTimestamp = (challenge) =>
  getStartTimestamp(
    challenge?.startCodingPhaseDateTime || challenge?.startDatetime
  );

export const sortByStartAsc = (a, b) => {
  const aStart = getChallengeStartTimestamp(a);
  const bStart = getChallengeStartTimestamp(b);
  if (aStart == null && bStart == null) return 0;
  if (aStart == null) return 1;
  if (bStart == null) return -1;
  return aStart - bStart;
};

export const sortByStartDesc = (a, b) => {
  const aStart = getChallengeStartTimestamp(a);
  const bStart = getChallengeStartTimestamp(b);
  if (aStart == null && bStart == null) return 0;
  if (aStart == null) return 1;
  if (bStart == null) return -1;
  return bStart - aStart;
};

export const getActivePriority = (status) => {
  if (status === ChallengeStatus.STARTED_PEER_REVIEW) return 0;
  if (status === ChallengeStatus.STARTED_CODING_PHASE) return 1;
  if (status === ChallengeStatus.ENDED_CODING_PHASE) return 2;
  if (status === ChallengeStatus.ASSIGNED) return 3;
  return 4;
};

export const getStudentStatusLabel = (challenge, nowMs) => {
  const startTimestamp = getChallengeStartTimestamp(challenge);
  const isUpcoming = startTimestamp !== null ? startTimestamp > nowMs : false;
  if (isUpcoming) return 'Upcoming';
  if (challenge.status === ChallengeStatus.STARTED_CODING_PHASE)
    return 'Coding';
  if (challenge.status === ChallengeStatus.ENDED_CODING_PHASE)
    return 'Awaiting peer review';
  if (challenge.status === ChallengeStatus.STARTED_PEER_REVIEW)
    return 'Peer review';
  if (challenge.status === ChallengeStatus.ENDED_PEER_REVIEW)
    return 'Completed';
  if (challenge.status === ChallengeStatus.PUBLIC)
    return challenge.joined ? 'Joined' : 'Joinable';
  if (challenge.status === ChallengeStatus.ASSIGNED)
    return challenge.joined ? 'Assigned' : 'Assigned';
  return challenge.status || 'Unknown';
};

export const getChallengeRoute = (challenge) => {
  if (challenge.status === ChallengeStatus.STARTED_PEER_REVIEW) {
    return `/student/challenges/${challenge.id}/peer-review`;
  }
  if (
    challenge.status === ChallengeStatus.ENDED_PEER_REVIEW ||
    challenge.status === ChallengeStatus.ENDED_CODING_PHASE
  ) {
    return `/student/challenges/${challenge.id}/result`;
  }
  return `/student/challenges/${challenge.id}/match`;
};
