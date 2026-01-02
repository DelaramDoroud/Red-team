'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import useRoleGuard from '#js/useRoleGuard';

const statusStyles = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/15',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-200',
  [ChallengeStatus.STARTED_PHASE_ONE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

const startedStatuses = new Set([
  ChallengeStatus.STARTED_PHASE_ONE,
  ChallengeStatus.ENDED_PHASE_ONE,
  ChallengeStatus.STARTED_PHASE_TWO,
  ChallengeStatus.ENDED_PHASE_TWO,
]);

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

export default function StudentChallengesPage() {
  const router = useRouter();
  const { user, isAuthorized } = useRoleGuard({ allowedRoles: ['student'] });
  const studentId = user?.id;
  const { getChallenges, joinChallenge, getChallengeForJoinedStudent } =
    useChallenge();

  const [challenges, setChallenges] = useState([]);
  const [joined, setJoined] = useState({});
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [pendingActions, setPendingActions] = useState({});
  const redirectingRef = useRef(false);

  const filterChallenges = useCallback(
    (items, current) =>
      (items || []).filter((challenge) => {
        if (!challenge?.startDatetime) return false;
        return new Date(challenge.startDatetime) <= current;
      }),
    []
  );

  const loadChallenges = useCallback(async () => {
    try {
      const res = await getChallenges();
      if (!res || res.success === false) {
        setError(res?.message || 'Unable to load challenges');
        setChallenges([]);
        return;
      }
      let list = [];
      if (Array.isArray(res)) {
        list = res;
      } else if (Array.isArray(res?.data)) {
        list = res.data;
      }
      setChallenges(list);
    } catch {
      setError('Unable to load challenges');
      setChallenges([]);
    }
  }, [getChallenges]);

  useEffect(() => {
    if (!isAuthorized || !studentId) return undefined;
    setNow(new Date());
    loadChallenges();

    const id = setInterval(() => {
      setNow(new Date());
      loadChallenges();
    }, 3000);

    return () => clearInterval(id);
  }, [loadChallenges, isAuthorized, studentId]);

  const visibleChallenges = useMemo(() => {
    const available = filterChallenges(challenges, now);
    return available.length > 0 ? [available[0]] : [];
  }, [challenges, filterChallenges, now]);

  useEffect(() => {
    if (!visibleChallenges.length || !studentId || !isAuthorized)
      return undefined;

    const challenge = visibleChallenges[0];
    let cancelled = false;

    (async () => {
      try {
        const res = await getChallengeForJoinedStudent(challenge.id, studentId);

        if (!cancelled && res?.success && res.data) {
          setJoined((prev) => ({ ...prev, [challenge.id]: true }));
        }
      } catch {
        if (!cancelled) {
          setError('Unable to verify challenge status');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    visibleChallenges,
    getChallengeForJoinedStudent,
    studentId,
    isAuthorized,
  ]);

  useEffect(() => {
    if (!visibleChallenges.length || !studentId || !isAuthorized)
      return undefined;

    const challenge = visibleChallenges[0];
    if (!joined[challenge.id]) return undefined;

    const pollStatus = async () => {
      if (redirectingRef.current) return;
      try {
        const res = await getChallengeForJoinedStudent(challenge.id, studentId);
        if (!res?.success || !res.data) return;

        const { status, startPhaseOneDateTime } = res.data;
        if (!startedStatuses.has(status)) return;

        const startedTime =
          startPhaseOneDateTime ||
          challenge.startPhaseOneDateTime ||
          challenge.startDatetime;

        const startMs = startedTime
          ? new Date(startedTime).getTime()
          : Date.now();
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        const remaining = Math.max(3 - elapsed, 0);

        if (remaining <= 0) {
          redirectingRef.current = true;
          router.push(`/student/challenges/${challenge.id}/match`);
          return;
        }

        setCountdown({ challengeId: challenge.id, value: remaining });
      } catch {
        // ignore transient errors
      }
    };

    pollStatus();
    const id = setInterval(pollStatus, 1000);

    return () => {
      clearInterval(id);
    };
  }, [
    visibleChallenges,
    joined,
    getChallengeForJoinedStudent,
    router,
    studentId,
    isAuthorized,
  ]);

  useEffect(() => {
    if (!countdown) return undefined;

    if (countdown.value <= 0) {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        router.push(`/student/challenges/${countdown.challengeId}/match`);
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => {
        if (!prev || prev.challengeId !== countdown.challengeId) return prev;
        return { ...prev, value: prev.value - 1 };
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router]);

  const handleJoin = async (challengeId) => {
    setError(null);
    setPendingActions((prev) => ({ ...prev, [challengeId]: { join: true } }));
    if (!studentId) {
      setError('Profilo studente non disponibile.');
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
      return;
    }
    try {
      const res = await joinChallenge(challengeId, studentId);
      if (res?.success) {
        setJoined((prev) => ({ ...prev, [challengeId]: true }));
      } else {
        setError(res?.message || 'Unable to join challenge');
      }
    } catch {
      setError('Unable to join challenge');
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
    }
  };

  const renderStatusBadge = (status) => {
    const styles =
      statusStyles[status] || statusStyles[ChallengeStatus.PRIVATE];
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${styles}`}
      >
        {status}
      </span>
    );
  };

  const renderAction = (challenge) => {
    const isJoined = joined[challenge.id];
    const isStarted = startedStatuses.has(challenge.status);
    const isJoining = pendingActions[challenge.id]?.join;
    const isCounting = countdown && countdown.challengeId === challenge.id;

    if (isCounting) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Challenge starting in {countdown.value}…
        </div>
      );
    }

    if (!isJoined && isStarted) {
      return (
        <div className='text-destructive font-semibold text-sm'>
          The challenge is already in progress.
        </div>
      );
    }

    if (!isJoined) {
      return (
        <Button
          size='lg'
          onClick={() => handleJoin(challenge.id)}
          disabled={isJoining}
          title='Join this challenge'
        >
          {isJoining ? 'Joining...' : 'Join'}
        </Button>
      );
    }

    return (
      <div className='text-primary font-semibold text-sm'>
        Wait for the teacher to start the challenge.
      </div>
    );
  };

  if (!isAuthorized || !studentId) return null;

  return (
    <div className='max-w-5xl mx-auto px-6 py-8 space-y-6'>
      {countdown && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
          <div className='bg-card rounded-2xl px-10 py-8 text-center shadow-xl border border-border'>
            <p className='text-sm text-muted-foreground mb-2'>Get ready…</p>
            <p className='text-6xl font-bold mb-4'>{countdown.value}</p>
            <p className='text-sm text-muted-foreground'>
              The challenge is about to start.
            </p>
          </div>
        </div>
      )}

      <div className='space-y-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Student area
        </p>
        <h1 className='text-3xl font-bold text-foreground'>
          Available Challenges
        </h1>
        <p className='text-muted-foreground text-sm'>
          Challenges become visible once their start time arrives.
        </p>
      </div>

      {error && (
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      {visibleChallenges.length === 0 && (
        <Card className='border border-dashed border-border bg-card'>
          <CardContent className='py-6'>
            <p className='text-muted-foreground text-sm'>
              There is no available challenge at the moment. Please wait for
              your teacher to schedule one.
            </p>
          </CardContent>
        </Card>
      )}

      {visibleChallenges.map((challenge) => (
        <Card
          key={challenge.id}
          className='border border-border bg-card shadow-sm'
        >
          <CardHeader className='pb-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
              <div className='space-y-1.5'>
                <CardTitle className='text-xl font-semibold'>
                  {challenge.title}
                </CardTitle>
                <CardDescription className='text-muted-foreground'>
                  Join and wait for your teacher to start the challenge.
                </CardDescription>
              </div>
              {renderStatusBadge(challenge.status)}
            </div>
          </CardHeader>

          <CardContent>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <dl className='flex flex-wrap gap-6 text-sm text-muted-foreground'>
                <div className='space-y-1'>
                  <dt className='text-xs font-semibold uppercase tracking-wide'>
                    Start
                  </dt>
                  <dd className='text-foreground font-medium'>
                    {formatDateTime(challenge.startDatetime)}
                  </dd>
                </div>
                <div className='space-y-1'>
                  <dt className='text-xs font-semibold uppercase tracking-wide'>
                    Duration
                  </dt>
                  <dd className='text-foreground font-medium'>
                    {challenge.duration} min
                  </dd>
                </div>
              </dl>

              <div className='flex flex-wrap gap-3 justify-end'>
                {renderAction(challenge)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
