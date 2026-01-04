'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { ChallengeStatus } from '#js/constants';
import useChallenge from '#js/useChallenge';

const statusTone = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-200',
  [ChallengeStatus.STARTED_PHASE_ONE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-200',
  [ChallengeStatus.ENDED_PHASE_ONE]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.STARTED_PHASE_TWO]:
    'bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-200',
  [ChallengeStatus.ENDED_PHASE_TWO]:
    'bg-slate-500/10 text-slate-700 ring-1 ring-slate-500/25 dark:text-slate-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

const peerReviewTones = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const formatTimer = (seconds) => {
  if (seconds == null) return '—';
  const safeSeconds = Math.max(0, seconds);
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
};

const getPhaseEndMs = (startValue, durationMinutes, explicitEndValue) => {
  if (explicitEndValue) {
    const explicitEnd = new Date(explicitEndValue).getTime();
    return Number.isNaN(explicitEnd) ? null : explicitEnd;
  }
  if (!startValue || !durationMinutes) return null;
  const startMs = new Date(startValue).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + durationMinutes * 60 * 1000;
};

const resolveEndDisplay = (explicitEndValue, computedEndMs) => {
  if (explicitEndValue) return explicitEndValue;
  if (computedEndMs) return new Date(computedEndMs);
  return null;
};

export default function ChallengeDetailPage() {
  const params = useParams();
  const {
    getChallengeMatches,
    assignChallenge,
    getChallengeParticipants,
    startChallenge,
    assignPeerReviews,
    updateExpectedReviews,
    startPeerReview,
  } = useChallenge();
  const challengeId = params?.id;

  const [challenge, setChallenge] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assigningReviews, setAssigningReviews] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingPeerReview, setStartingPeerReview] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [expectedReviews, setExpectedReviews] = useState('');
  const [expectedReviewsError, setExpectedReviewsError] = useState('');
  const [expectedReviewsSaved, setExpectedReviewsSaved] = useState('');
  const [savingExpectedReviews, setSavingExpectedReviews] = useState(false);
  const [peerReviewMessages, setPeerReviewMessages] = useState([]);
  const [phaseNow, setPhaseNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!challengeId) return;
    setError(null);
    setLoading(true);
    try {
      const [matchesRes, participantsRes] = await Promise.all([
        getChallengeMatches(challengeId),
        getChallengeParticipants(challengeId),
      ]);

      if (matchesRes?.success) {
        setChallenge(matchesRes.challenge);
        setAssignments(matchesRes.assignments || []);
        setExpectedReviews(
          matchesRes.challenge?.allowedNumberOfReview != null
            ? String(matchesRes.challenge.allowedNumberOfReview)
            : ''
        );
        setExpectedReviewsSaved('');
      } else {
        setError(
          matchesRes?.error || matchesRes?.message || 'Unable to load matches'
        );
        setAssignments([]);
      }

      if (participantsRes?.success && Array.isArray(participantsRes.data)) {
        setStudentCount(participantsRes.data.length);
      } else {
        setStudentCount(0);
      }
    } catch (_err) {
      setError('Unable to load matches');
      setAssignments([]);
      setStudentCount(0);
    } finally {
      setLoading(false);
    }
  }, [challengeId, getChallengeMatches, getChallengeParticipants]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleAssign = useCallback(async () => {
    if (!challengeId) return;
    const now = new Date();
    const canStartNow =
      challenge?.startDatetime && new Date(challenge.startDatetime) <= now;
    if (!canStartNow) {
      setError('The challenge start time has not been reached yet.');
      return;
    }
    if (!studentCount) {
      setError('No students have joined this challenge yet.');
      return;
    }
    setAssigning(true);
    setError(null);
    try {
      const res = await assignChallenge(challengeId);
      if (res?.success === false) {
        setError(res?.error || res?.message || 'Unable to assign students');
      }
      await load();
    } catch (_err) {
      setError('Unable to assign students');
    } finally {
      setAssigning(false);
    }
  }, [
    assignChallenge,
    challengeId,
    load,
    studentCount,
    challenge?.startDatetime,
  ]);

  const handleStart = useCallback(async () => {
    if (!challengeId) return;
    setStarting(true);
    setError(null);
    try {
      const res = await startChallenge(challengeId);
      if (res?.success === false) {
        setError(res?.error || res?.message || 'Unable to start challenge');
      }
      await load();
    } catch (_err) {
      setError('Unable to start challenge');
    } finally {
      setStarting(false);
    }
  }, [challengeId, load, startChallenge]);

  const parseExpectedReviews = useCallback((value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 2) {
      return null;
    }
    return parsed;
  }, []);

  const handleAssignReviews = useCallback(async () => {
    if (!challengeId) return;
    const parsed = parseExpectedReviews(expectedReviews);
    if (!parsed) {
      setExpectedReviewsError(
        'Enter a whole number greater than or equal to 2.'
      );
      return;
    }
    setExpectedReviewsError('');
    setAssigningReviews(true);
    setError(null);
    setPeerReviewMessages([]);
    try {
      const res = await assignPeerReviews(challengeId, parsed);
      if (res?.success === false) {
        setError(res?.error || res?.message || 'Unable to assign peer reviews');
        return;
      }
      if (Array.isArray(res?.results)) {
        const assignmentMap = new Map(
          assignments.map((group) => [
            group.challengeMatchSettingId,
            group.matchSetting?.problemTitle || null,
          ])
        );
        const messages = [];
        let assignedCount = 0;
        res.results.forEach((result) => {
          const label = assignmentMap.get(result.challengeMatchSettingId);
          const prefix = label
            ? `${label}: `
            : `Match setting ${result.challengeMatchSettingId}: `;
          if (result.status === 'assigned') {
            assignedCount += 1;
            if (result.teacherMessage) {
              messages.push({
                tone: 'warning',
                text: `${prefix}${result.teacherMessage}`,
              });
            }
          } else if (result.status === 'insufficient_valid_submissions') {
            messages.push({
              tone: 'warning',
              text: `${prefix}Not enough valid submissions to assign peer reviews.`,
            });
          } else if (result.teacherMessage) {
            messages.push({
              tone: 'error',
              text: `${prefix}${result.teacherMessage}`,
            });
          } else {
            messages.push({
              tone: 'error',
              text: `${prefix}Unable to assign peer reviews.`,
            });
          }
        });
        if (assignedCount > 0) {
          messages.unshift({
            tone: 'success',
            text: `Peer reviews assigned for ${assignedCount} match setting${
              assignedCount === 1 ? '' : 's'
            }.`,
          });
        }
        setPeerReviewMessages(messages);
      }
      await load();
    } catch (_err) {
      setError('Unable to assign peer reviews');
    } finally {
      setAssigningReviews(false);
    }
  }, [
    assignPeerReviews,
    challengeId,
    expectedReviews,
    load,
    parseExpectedReviews,
    assignments,
  ]);

  const handleStartPeerReview = useCallback(async () => {
    if (!challengeId) return;
    setStartingPeerReview(true);
    setError(null);
    try {
      const res = await startPeerReview(challengeId);
      if (res?.success === false) {
        setError(res?.error || res?.message || 'Unable to start peer review');
        return;
      }
      setPeerReviewMessages([
        {
          tone: 'success',
          text: 'Peer review started successfully.',
        },
      ]);
      await load();
    } catch (_err) {
      setError('Unable to start peer review');
    } finally {
      setStartingPeerReview(false);
    }
  }, [challengeId, load, startPeerReview]);

  const hasStudents = studentCount > 0;
  const hasMatches = assignments.some((group) => group.matches?.length);
  const canStartNow = useMemo(() => {
    if (!challenge?.startDatetime) return true;
    return new Date(challenge.startDatetime) <= new Date();
  }, [challenge?.startDatetime]);
  const showStartButton =
    challenge?.status === ChallengeStatus.ASSIGNED &&
    hasStudents &&
    hasMatches &&
    canStartNow;
  const peerReviewReady = Boolean(challenge?.peerReviewReady);
  const showAssignReviewsButton =
    challenge?.status === ChallengeStatus.ENDED_PHASE_ONE && !peerReviewReady;
  const showStartPeerReviewButton =
    challenge?.status === ChallengeStatus.ENDED_PHASE_ONE && peerReviewReady;

  const phaseStatus = challenge?.status;
  const isPhaseOneActive = phaseStatus === ChallengeStatus.STARTED_PHASE_ONE;
  const isPhaseTwoActive = phaseStatus === ChallengeStatus.STARTED_PHASE_TWO;
  const isPhaseOneComplete = useMemo(
    () =>
      phaseStatus === ChallengeStatus.ENDED_PHASE_ONE ||
      phaseStatus === ChallengeStatus.STARTED_PHASE_TWO ||
      phaseStatus === ChallengeStatus.ENDED_PHASE_TWO,
    [phaseStatus]
  );
  const isPhaseTwoComplete = phaseStatus === ChallengeStatus.ENDED_PHASE_TWO;

  const phaseOneStart =
    challenge?.startPhaseOneDateTime || challenge?.startDatetime;
  const phaseOneEndMs = getPhaseEndMs(
    phaseOneStart,
    challenge?.duration,
    challenge?.endPhaseOneDateTime
  );
  const phaseOneEndDisplay = resolveEndDisplay(
    challenge?.endPhaseOneDateTime,
    phaseOneEndMs
  );
  const phaseTwoStart = challenge?.startPhaseTwoDateTime;
  const phaseTwoEndMs = getPhaseEndMs(
    phaseTwoStart,
    challenge?.durationPeerReview,
    challenge?.endPhaseTwoDateTime
  );
  const phaseTwoEndDisplay = resolveEndDisplay(
    challenge?.endPhaseTwoDateTime,
    phaseTwoEndMs
  );

  const phaseOneTimeLeft =
    isPhaseOneActive && phaseOneEndMs
      ? Math.max(0, Math.floor((phaseOneEndMs - phaseNow) / 1000))
      : null;
  const phaseTwoTimeLeft =
    isPhaseTwoActive && phaseTwoEndMs
      ? Math.max(0, Math.floor((phaseTwoEndMs - phaseNow) / 1000))
      : null;

  const phaseOneCardClass = useMemo(() => {
    if (isPhaseOneActive) {
      return 'border-emerald-500/40 bg-emerald-500/10 ring-1 ring-emerald-500/30';
    }
    if (isPhaseOneComplete) {
      return 'border-border/60 bg-muted/40';
    }
    return 'border-border/60 bg-card';
  }, [isPhaseOneActive, isPhaseOneComplete]);

  const phaseTwoCardClass = useMemo(() => {
    if (isPhaseTwoActive) {
      return 'border-indigo-500/40 bg-indigo-500/10 ring-1 ring-indigo-500/30';
    }
    if (isPhaseTwoComplete) {
      return 'border-border/60 bg-muted/40';
    }
    return 'border-border/60 bg-card';
  }, [isPhaseTwoActive, isPhaseTwoComplete]);

  const showPhaseTwoSubmissionCount = useMemo(
    () =>
      phaseStatus === ChallengeStatus.ENDED_PHASE_ONE ||
      phaseStatus === ChallengeStatus.STARTED_PHASE_TWO ||
      phaseStatus === ChallengeStatus.ENDED_PHASE_TWO,
    [phaseStatus]
  );
  const expectedReviewsLocked =
    phaseStatus === ChallengeStatus.STARTED_PHASE_TWO ||
    phaseStatus === ChallengeStatus.ENDED_PHASE_TWO;
  const expectedReviewsDirty =
    String(challenge?.allowedNumberOfReview ?? '') !== expectedReviews;

  const handleSaveExpectedReviews = useCallback(async () => {
    if (!challengeId || expectedReviewsLocked) return;
    const parsed = parseExpectedReviews(expectedReviews);
    if (!parsed) {
      setExpectedReviewsError(
        'Enter a whole number greater than or equal to 2.'
      );
      setExpectedReviewsSaved('');
      return;
    }
    setExpectedReviewsError('');
    setExpectedReviewsSaved('');
    setSavingExpectedReviews(true);
    setError(null);
    try {
      const res = await updateExpectedReviews(challengeId, parsed);
      if (res?.success === false) {
        setExpectedReviewsError(
          res?.error || res?.message || 'Unable to save expected reviews.'
        );
        return;
      }
      setChallenge((prev) =>
        prev ? { ...prev, allowedNumberOfReview: parsed } : prev
      );
      setExpectedReviews(String(parsed));
      setExpectedReviewsSaved('Saved.');
    } catch (_err) {
      setExpectedReviewsError('Unable to save expected reviews.');
    } finally {
      setSavingExpectedReviews(false);
    }
  }, [
    challengeId,
    expectedReviews,
    expectedReviewsLocked,
    parseExpectedReviews,
    updateExpectedReviews,
  ]);

  const statusBadge = useMemo(() => {
    const tone =
      statusTone[challenge?.status] || statusTone[ChallengeStatus.PRIVATE];
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${tone}`}
      >
        {challenge?.status || '—'}
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
          className='h-9 w-full max-w-[140px] rounded-md border border-border/60 bg-background px-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:bg-muted/40'
          value={expectedReviews}
          onChange={(event) => {
            setExpectedReviews(event.target.value);
            setExpectedReviewsError('');
            setExpectedReviewsSaved('');
          }}
        />
        {!expectedReviewsLocked ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleSaveExpectedReviews}
            disabled={savingExpectedReviews || !expectedReviewsDirty}
            title='Save expected reviews per submission'
          >
            {savingExpectedReviews ? 'Saving...' : 'Save'}
          </Button>
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

  return (
    <div className='max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6'>
      <div className='space-y-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-2'>
            <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
              Challenge overview
            </p>
            <div className='flex flex-wrap items-center gap-3'>
              <h1 className='text-3xl font-bold text-foreground'>
                {challenge?.title || 'Challenge'}
              </h1>
              {statusBadge}
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
            <Button variant='outline' asChild>
              <Link href='/challenges' title='Back to challenges list'>
                Back
              </Link>
            </Button>
            <Button
              variant='outline'
              onClick={load}
              disabled={loading}
              title='Refresh challenge details'
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            {challenge?.status === ChallengeStatus.PUBLIC ? (
              <Button
                onClick={handleAssign}
                disabled={assigning || loading}
                title='Assign students to this challenge'
              >
                {assigning ? 'Assigning...' : 'Assign students'}
              </Button>
            ) : null}
            {showStartButton ? (
              <Button
                onClick={handleStart}
                disabled={starting || loading}
                title='Start the challenge for assigned students'
              >
                {starting ? 'Starting...' : 'Start'}
              </Button>
            ) : null}
            {showAssignReviewsButton ? (
              <Button
                onClick={handleAssignReviews}
                disabled={assigningReviews || loading}
                title='Assign peer reviews for this challenge'
              >
                {assigningReviews ? 'Assigning...' : 'Assign'}
              </Button>
            ) : null}
            {showStartPeerReviewButton ? (
              <Button
                onClick={handleStartPeerReview}
                disabled={startingPeerReview || loading}
                title='Start the peer review phase'
              >
                {startingPeerReview ? 'Starting...' : 'Start Peer Review'}
              </Button>
            ) : null}
          </div>
        </div>
        <dl className='flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center'>
          {detailItems.map((item) => (
            <div
              key={item.label}
              className='w-full rounded-lg border border-border/60 bg-muted/60 px-3 py-2 sm:min-w-[170px] sm:w-auto'
            >
              <dt className='text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground'>
                {item.label}
              </dt>
              <dd className='text-sm font-semibold text-foreground'>
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card className={`border ${phaseOneCardClass}`}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg font-semibold text-foreground'>
              Phase One
            </CardTitle>
            <CardDescription className='text-sm text-muted-foreground'>
              Coding phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2 text-sm text-foreground'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Start
                </span>
                <span>{formatDateTime(phaseOneStart)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>End</span>
                <span>{formatDateTime(phaseOneEndDisplay)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Duration
                </span>
                <span>
                  {challenge?.duration ? `${challenge.duration} min` : '—'}
                </span>
              </div>
              {isPhaseOneActive ? (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-emerald-700'>
                    Time left
                  </span>
                  <span className='font-mono text-emerald-700'>
                    {formatTimer(phaseOneTimeLeft)}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${phaseTwoCardClass}`}>
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg font-semibold text-foreground'>
              Phase Two
            </CardTitle>
            <CardDescription className='text-sm text-muted-foreground'>
              Peer review phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2 text-sm text-foreground'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Start
                </span>
                <span>{formatDateTime(phaseTwoStart)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>End</span>
                <span>{formatDateTime(phaseTwoEndDisplay)}</span>
              </div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className='font-semibold text-muted-foreground'>
                  Duration
                </span>
                <span>
                  {challenge?.durationPeerReview
                    ? `${challenge.durationPeerReview} min`
                    : '—'}
                </span>
              </div>
              {showPhaseTwoSubmissionCount ? (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-muted-foreground'>
                    Submissions for peer review
                  </span>
                  <span>{challenge?.validSubmissionsCount ?? 0}</span>
                </div>
              ) : null}
              {showPhaseTwoSubmissionCount ? (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-muted-foreground'>
                    Number of submissions
                  </span>
                  <span>{challenge?.totalSubmissionsCount ?? 0}</span>
                </div>
              ) : null}
              {isPhaseTwoActive ? (
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-semibold text-indigo-700'>
                    Time left
                  </span>
                  <span className='font-mono text-indigo-700'>
                    {formatTimer(phaseTwoTimeLeft)}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      {showStartPeerReviewButton ? (
        <Card className='border border-emerald-500/30 bg-emerald-500/10 text-emerald-700'>
          <CardContent className='py-4'>
            <p className='text-sm font-medium'>
              Peer review assignments are ready. You can start the peer review
              phase when you are ready.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {peerReviewMessages.length > 0 && (
        <div className='space-y-2'>
          {peerReviewMessages.map((message) => (
            <Card
              key={`${message.tone}-${message.text}`}
              className={`border ${peerReviewTones[message.tone] || peerReviewTones.error}`}
            >
              <CardContent className='py-3'>
                <p className='text-sm font-medium'>{message.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!assignments.length && !error ? (
        <Card className='border border-dashed border-border bg-card text-card-foreground shadow-sm'>
          <CardContent className='py-6'>
            <p className='text-muted-foreground text-sm'>
              No matches have been assigned yet for this challenge.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className='space-y-4'>
        {assignments.map((group) => (
          <Card
            key={group.challengeMatchSettingId}
            className='border border-border bg-card text-card-foreground shadow-sm'
          >
            <CardHeader className='pb-2'>
              <CardTitle className='text-lg font-semibold text-foreground'>
                {group.matchSetting?.problemTitle || 'Match setting'}
              </CardTitle>
              <CardDescription className='text-sm text-muted-foreground space-y-1'>
                <span className='block'>
                  Match setting ID:{' '}
                  {group.matchSetting?.id ?? group.challengeMatchSettingId}
                </span>
                <span className='block'>
                  Valid submissions: {group.validSubmissionsCount ?? 0}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-auto rounded-lg border border-border'>
                <table className='min-w-full table-auto text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left text-muted-foreground'>
                      <th className='px-4 py-3 font-semibold'>Match ID</th>
                      <th className='px-4 py-3 font-semibold'>Student</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.matches.map((match) => (
                      <tr key={match.id} className='border-t border-border/60'>
                        <td className='px-4 py-3 font-medium text-foreground'>
                          {match.id}
                        </td>
                        <td className='px-4 py-3 text-foreground'>
                          {match.student?.username || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {group.peerReviewAssignments?.length ? (
                <details className='mt-4 rounded-lg border border-border/60 bg-muted/40 p-3'>
                  <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                    Peer review assignments
                  </summary>
                  <div className='mt-3 space-y-3'>
                    {group.peerReviewAssignments.map((assignment) => {
                      const revieweeNames = assignment.reviewees
                        .map((reviewee) => reviewee.username)
                        .join(', ');
                      return (
                        <div
                          key={assignment.reviewer.participantId}
                          className='text-sm'
                        >
                          <p className='font-semibold text-foreground'>
                            {assignment.reviewer.username}
                          </p>
                          <p className='text-muted-foreground break-words'>
                            Reviews: {revieweeNames || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
