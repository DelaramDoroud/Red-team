import { useMemo } from 'react';
import { ChallengeStatus, getChallengeStatusLabel } from '#js/constants';
import { formatDateTime } from '#js/date';
import {
  buildStudentName,
  getBufferedStartMs,
  getPhaseEndMs,
  isEndedChallengeStatus,
  resolveEndDisplay,
} from './challengeDetailUtils';

const statusTone = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-200',
  [ChallengeStatus.STARTED_CODING_PHASE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-200',
  [ChallengeStatus.ENDED_CODING_PHASE]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.STARTED_PEER_REVIEW]:
    'bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-200',
  [ChallengeStatus.ENDED_PEER_REVIEW]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

export default function useChallengeDetailDerived({
  assignments,
  challenge,
  editPending,
  error,
  expectedReviews,
  expectedReviewsError,
  expectedReviewsSaved,
  handleSaveExpectedReviews,
  isTeacher,
  loading,
  phaseNow,
  savingExpectedReviews,
  setExpectedReviews,
  setExpectedReviewsError,
  setExpectedReviewsSaved,
  studentCount,
  participants,
  teacherResults,
}) {
  const canShowTeacherResults =
    isTeacher && isEndedChallengeStatus(challenge?.status);

  const hasStudents = studentCount > 0;
  const hasMatches = assignments.some((group) => group.matches?.length);
  const canStartNow = useMemo(() => {
    if (!challenge?.startDatetime) return true;
    return new Date(challenge.startDatetime).getTime() <= phaseNow;
  }, [challenge?.startDatetime, phaseNow]);

  const showStartButton =
    challenge?.status === ChallengeStatus.ASSIGNED &&
    hasStudents &&
    hasMatches &&
    canStartNow;

  const peerReviewReady = Boolean(challenge?.peerReviewReady);

  const totalMatches = useMemo(() => {
    if (Number.isInteger(challenge?.totalMatches)) {
      return challenge.totalMatches;
    }
    if (!assignments.length) return 0;
    return assignments.reduce(
      (sum, group) => sum + (group.matches?.length || 0),
      0
    );
  }, [assignments, challenge?.totalMatches]);

  const finalSubmissionCount = useMemo(() => {
    if (typeof challenge?.finalSubmissionCount === 'number') {
      return challenge.finalSubmissionCount;
    }
    if (typeof challenge?.totalSubmissionsCount === 'number') {
      return challenge.totalSubmissionsCount;
    }
    return null;
  }, [challenge?.finalSubmissionCount, challenge?.totalSubmissionsCount]);

  const pendingFinalCount = useMemo(() => {
    if (typeof challenge?.pendingFinalCount === 'number') {
      return challenge.pendingFinalCount;
    }
    if (
      typeof finalSubmissionCount === 'number' &&
      typeof totalMatches === 'number'
    ) {
      return Math.max(0, totalMatches - finalSubmissionCount);
    }
    return null;
  }, [challenge?.pendingFinalCount, finalSubmissionCount, totalMatches]);

  const hasPendingFinalizations =
    typeof pendingFinalCount === 'number' && pendingFinalCount > 0;

  const showAssignReviewsButton =
    challenge?.status === ChallengeStatus.ENDED_CODING_PHASE &&
    !peerReviewReady &&
    !hasPendingFinalizations;

  const showStartPeerReviewButton =
    challenge?.status === ChallengeStatus.ENDED_CODING_PHASE &&
    peerReviewReady &&
    !hasPendingFinalizations;

  const showPeerReviewInProgress =
    challenge?.status === ChallengeStatus.STARTED_PEER_REVIEW;
  const showEndCodingPhaseButton =
    isTeacher && challenge?.status === ChallengeStatus.STARTED_CODING_PHASE;
  const showEndPeerReviewButton =
    isTeacher && challenge?.status === ChallengeStatus.STARTED_PEER_REVIEW;
  const showEndChallengeButton =
    isTeacher && challenge?.status === ChallengeStatus.ENDED_CODING_PHASE;

  const showDangerZone =
    showEndCodingPhaseButton ||
    showEndPeerReviewButton ||
    showEndChallengeButton;

  const isEditableStatus =
    challenge?.status === ChallengeStatus.PRIVATE ||
    challenge?.status === ChallengeStatus.PUBLIC;
  const requiresUnpublish = challenge?.status === ChallengeStatus.PUBLIC;
  const editDisabled =
    !isTeacher || !isEditableStatus || loading || editPending;

  const editTitle = (() => {
    if (!isTeacher) return 'Only teachers can edit challenges.';
    if (!isEditableStatus) {
      return 'Challenges can only be edited before the coding phase starts.';
    }
    if (requiresUnpublish) return 'Unpublish this challenge to edit it.';
    return 'Edit this challenge.';
  })();

  const phaseStatus = challenge?.status;
  const isCodingPhaseActive =
    phaseStatus === ChallengeStatus.STARTED_CODING_PHASE;
  const isPeerReviewActive =
    phaseStatus === ChallengeStatus.STARTED_PEER_REVIEW;

  const isCodingPhaseComplete = useMemo(
    () =>
      phaseStatus === ChallengeStatus.ENDED_CODING_PHASE ||
      phaseStatus === ChallengeStatus.STARTED_PEER_REVIEW ||
      phaseStatus === ChallengeStatus.ENDED_PEER_REVIEW,
    [phaseStatus]
  );

  const isPeerReviewComplete =
    phaseStatus === ChallengeStatus.ENDED_PEER_REVIEW;

  const codingPhaseStart =
    challenge?.startCodingPhaseDateTime || challenge?.startDatetime;
  const codingPhaseEndMs = getPhaseEndMs(
    codingPhaseStart,
    challenge?.duration,
    challenge?.endCodingPhaseDateTime
  );
  const codingPhaseEndDisplay = resolveEndDisplay(
    challenge?.endCodingPhaseDateTime,
    codingPhaseEndMs
  );

  const peerReviewStart = challenge?.startPeerReviewDateTime;
  const peerReviewEndMs = getPhaseEndMs(
    peerReviewStart,
    challenge?.durationPeerReview,
    challenge?.endPeerReviewDateTime
  );
  const peerReviewEndDisplay = resolveEndDisplay(
    challenge?.endPeerReviewDateTime,
    peerReviewEndMs
  );

  const codingPhaseTimeLeft =
    isCodingPhaseActive && codingPhaseEndMs
      ? Math.max(0, Math.floor((codingPhaseEndMs - phaseNow) / 1000))
      : null;

  const peerReviewTimeLeft =
    isPeerReviewActive && peerReviewEndMs
      ? Math.max(0, Math.floor((peerReviewEndMs - phaseNow) / 1000))
      : null;

  const codingPhaseCountdownSeconds = (() => {
    if (!isCodingPhaseActive) return null;
    const bufferedStart = getBufferedStartMs(codingPhaseStart);
    if (!bufferedStart) return null;
    return Math.max(0, Math.ceil((bufferedStart - phaseNow) / 1000));
  })();

  const peerReviewCountdownSeconds = (() => {
    if (!isPeerReviewActive) return null;
    const bufferedStart = getBufferedStartMs(peerReviewStart);
    if (!bufferedStart) return null;
    return Math.max(0, Math.ceil((bufferedStart - phaseNow) / 1000));
  })();

  const codingPhaseCardClass = useMemo(() => {
    if (isCodingPhaseActive) {
      return 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30';
    }
    if (isCodingPhaseComplete) {
      return 'border-border/60 bg-muted/40';
    }
    return 'border-border/60 bg-card';
  }, [isCodingPhaseActive, isCodingPhaseComplete]);

  const peerReviewCardClass = useMemo(() => {
    if (isPeerReviewActive) {
      return 'border-indigo-500/40 bg-indigo-500/10 ring-1 ring-indigo-500/30';
    }
    if (isPeerReviewComplete) {
      return 'border-border/60 bg-muted/40';
    }
    return 'border-border/60 bg-card';
  }, [isPeerReviewActive, isPeerReviewComplete]);

  const showPeerReviewSubmissionCount = useMemo(
    () =>
      phaseStatus === ChallengeStatus.ENDED_CODING_PHASE ||
      phaseStatus === ChallengeStatus.STARTED_PEER_REVIEW ||
      phaseStatus === ChallengeStatus.ENDED_PEER_REVIEW,
    [phaseStatus]
  );

  const expectedReviewsLocked =
    phaseStatus === ChallengeStatus.STARTED_PEER_REVIEW ||
    phaseStatus === ChallengeStatus.ENDED_PEER_REVIEW;
  const expectedReviewsDirty =
    String(challenge?.allowedNumberOfReview ?? '') !== expectedReviews;

  const statusBadge = useMemo(() => {
    const tone =
      statusTone[challenge?.status] || statusTone[ChallengeStatus.PRIVATE];
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${tone}`}
      >
        {getChallengeStatusLabel(challenge?.status) || '—'}
      </span>
    );
  }, [challenge?.status]);

  const expectedReviewsInput = (
    <div className='space-y-1'>
      <div className='flex flex-wrap items-center gap-2'>
        <input
          type='number'
          min='2'
          disabled={expectedReviewsLocked}
          className='h-9 w-full max-w-35 rounded-md border border-border/60 bg-background px-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:bg-muted/40'
          value={expectedReviews}
          onChange={(event) => {
            setExpectedReviews(event.target.value);
            setExpectedReviewsError('');
            setExpectedReviewsSaved('');
          }}
        />
        {!expectedReviewsLocked ? (
          <button
            type='button'
            className='inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
            onClick={handleSaveExpectedReviews}
            disabled={savingExpectedReviews || !expectedReviewsDirty}
            title='Save expected reviews per submission'
          >
            {savingExpectedReviews ? 'Saving...' : 'Save'}
          </button>
        ) : null}
      </div>
      {expectedReviewsError ? (
        <p className='text-xs font-medium text-destructive'>
          {expectedReviewsError}
        </p>
      ) : null}
      {!expectedReviewsError && expectedReviewsSaved ? (
        <p className='text-xs font-medium text-emerald-700'>
          {expectedReviewsSaved}
        </p>
      ) : null}
    </div>
  );

  const detailItems = [
    {
      label: 'Start',
      value: formatDateTime(challenge?.startDatetime),
    },
    {
      label: 'Expected reviews / submission',
      value: expectedReviewsInput,
    },
    {
      label: 'Number of students',
      value: studentCount,
    },
  ];

  const joinedStudents = participants.map((participant) => ({
    id: participant.id,
    name: buildStudentName(
      participant.student,
      participant.studentId ?? participant.id
    ),
  }));

  const showParticipantList = !assignments.length && !error && isTeacher;

  const teacherMatchSettings = useMemo(() => {
    if (!teacherResults?.matchSettings) return [];
    return Array.isArray(teacherResults.matchSettings)
      ? teacherResults.matchSettings
      : [];
  }, [teacherResults]);

  return {
    canShowTeacherResults,
    detailItems,
    editDisabled,
    editTitle,
    expectedReviewsDirty,
    expectedReviewsLocked,
    finalSubmissionCount,
    hasPendingFinalizations,
    isCodingPhaseActive,
    isPeerReviewActive,
    joinedStudents,
    pendingFinalCount,
    codingPhaseCardClass,
    codingPhaseCountdownSeconds,
    codingPhaseEndDisplay,
    codingPhaseStart,
    codingPhaseTimeLeft,
    phaseStatus,
    peerReviewCardClass,
    peerReviewCountdownSeconds,
    peerReviewEndDisplay,
    peerReviewStart,
    peerReviewTimeLeft,
    showAssignReviewsButton,
    showDangerZone,
    showEndChallengeButton,
    showEndCodingPhaseButton,
    showEndPeerReviewButton,
    showParticipantList,
    showPeerReviewInProgress,
    showPeerReviewSubmissionCount,
    showStartButton,
    showStartPeerReviewButton,
    statusBadge,
    teacherMatchSettings,
    totalMatches,
  };
}
