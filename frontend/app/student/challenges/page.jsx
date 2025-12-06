'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const statusStyles = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/15',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-200',
  [ChallengeStatus.STARTED]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export default function StudentChallengesPage() {
  const { getChallenges, joinChallenge, getChallengeStatus } = useChallenge();
  const [challenges, setChallenges] = useState([]);
  const [joinedChallenges, setJoinedChallenges] = useState({});
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [pendingActions, setPendingActions] = useState({});
  const [countdown, setCountdown] = useState(null);
  const load = useCallback(async () => {
    setError(null);
    const res = await getChallenges();
    if (res?.success === false) {
      setChallenges([]);
      setError(res.message || 'Unable to load challenges');
      return;
    }
    if (Array.isArray(res)) {
      setChallenges(res);
    } else if (Array.isArray(res?.data)) {
      setChallenges(res.data);
    } else {
      setChallenges([]);
    }
  }, [getChallenges]);
  const STUDENT_ID = 1;
  const router = useRouter();
  useEffect(() => {
    let isCancelled = false;
    async function doFetch() {
      if (isCancelled) return;
      setNow(new Date());
      await load();
    }
    doFetch();
    return () => {
      isCancelled = true;
    };
  }, [load]);

  const filterChallenges = useCallback(
    (allChallenges, nowTime) =>
      allChallenges.filter((challenge) => {
        const start = new Date(challenge.startDatetime);
        return nowTime >= start;
      }),
    []
  );

  const visibleChallenges = useMemo(() => {
    const available = filterChallenges(challenges, now);
    return available.length > 0 ? [available[0]] : [];
  }, [challenges, filterChallenges, now]);
  useEffect(() => {
    if (!visibleChallenges.length) return () => {};

    const challenge = visibleChallenges[0];
    let cancelled = false;

    async function checkJoined() {
      try {
        const res = await getChallengeStatus(challenge.id, STUDENT_ID);
        if (!cancelled && res?.success && res.data) {
          setJoinedChallenges((prev) => ({
            ...prev,
            [challenge.id]: true,
          }));
        }
      } catch (_err) {
        setError(_err);
      }
    }

    checkJoined();

    return () => {
      cancelled = true;
    };
  }, [visibleChallenges, getChallengeStatus]);

  useEffect(() => {
    if (!visibleChallenges.length) return () => {};

    const challenge = visibleChallenges[0];
    const joined = joinedChallenges[challenge.id];
    if (!joined) return () => {};

    let intervalId;

    const pollStatus = async () => {
      const res = await getChallengeStatus(challenge.id, STUDENT_ID);
      if (!res?.success || !res.data) return;

      const { status, startedAt } = res.data;

      if (status === ChallengeStatus.STARTED) {
        let remaining = 3;

        if (startedAt) {
          const startedTime = new Date(startedAt).getTime();
          const diffSeconds = Math.floor((Date.now() - startedTime) / 1000);
          remaining = Math.max(3 - diffSeconds, 0);
        }

        if (remaining <= 0) {
          router.push(`/student/challenges/${challenge.id}/match`);
        } else {
          setCountdown((prev) =>
            prev && prev.challengeId === challenge.id
              ? prev
              : { challengeId: challenge.id, value: remaining }
          );
        }

        if (intervalId) clearInterval(intervalId);
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [visibleChallenges, joinedChallenges, getChallengeStatus, router]);

  useEffect(() => {
    if (!countdown) return () => {};

    if (countdown.value <= 0) {
      const { challengeId } = countdown.challengeId;
      setCountdown(null);
      router.push(`/student/challenges/${challengeId}/match`);
      return () => {};
    }

    const timeoutId = setTimeout(() => {
      setCountdown((prev) => {
        if (!prev || prev.challengeId !== countdown.challengeId) return prev;
        return { ...prev, value: prev.value - 1 };
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [countdown, router]);

  const setActionPending = (challengeId, actionKey, isPending) => {
    setPendingActions((prev) => ({
      ...prev,
      [challengeId]: { ...(prev[challengeId] || {}), [actionKey]: isPending },
    }));
  };

  const handleJoin = async (challengeId) => {
    setError(null);
    setActionPending(challengeId, 'join', true);
    try {
      const res = await joinChallenge(challengeId, STUDENT_ID);

      if (res.success) {
        setJoinedChallenges((prev) => ({ ...prev, [challengeId]: true }));
      } else {
        setError(res?.error || res?.message || 'Unable to join the challenge');
      }
    } catch (_err) {
      setError('Unable to join the challenge');
    } finally {
      setActionPending(challengeId, 'join', false);
    }
  };

  const renderStatusBadge = (status) => {
    const badgeStyles =
      statusStyles[status] || statusStyles[ChallengeStatus.PRIVATE];
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${badgeStyles}`}
      >
        {status || 'draft'}
      </span>
    );
  };

  const renderStudentAction = (challenge) => {
    const joined = joinedChallenges[challenge.id];
    const started = challenge.status === ChallengeStatus.STARTED;
    const assigned = challenge.status === ChallengeStatus.ASSIGNED;
    const isJoining = pendingActions[challenge.id]?.join;
    const isCountingDown = countdown && countdown.challengeId === challenge.id;

    if (isCountingDown) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Challenge starting in {countdown.value}…
        </div>
      );
    }

    if (!joined && !started && !assigned) {
      return (
        <Button
          size='lg'
          onClick={() => handleJoin(challenge.id)}
          disabled={isJoining}
        >
          {isJoining ? 'Joining...' : 'Join'}
        </Button>
      );
    }

    if (!joined && assigned) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Wait for the teacher to start the challenge.
        </div>
      );
    }

    if (!joined && started) {
      return (
        <div className='text-destructive font-semibold text-sm'>
          The challenge is in progress.
        </div>
      );
    }

    return (
      <div className='text-primary font-semibold text-sm'>
        Wait for the teacher to start the challenge.
      </div>
    );
  };

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
          Challenges become visible once their start time arrives. Join to be
          included, then wait for your teacher to start the challenge.
        </p>
      </div>

      <div className='space-y-3'>
        {error && (
          <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
            <CardContent className='py-4'>
              <p className='text-sm'>{error}</p>
            </CardContent>
          </Card>
        )}

        {visibleChallenges.length === 0 ? (
          <Card className='border border-dashed border-border bg-card text-card-foreground shadow-sm'>
            <CardContent className='py-6'>
              <p className='text-muted-foreground text-sm'>
                There is no available challenge at the moment. Please wait for
                your teacher to schedule one.
              </p>
            </CardContent>
          </Card>
        ) : (
          visibleChallenges.map((challenge) => (
            <Card
              key={challenge.id}
              className='border border-border bg-card text-card-foreground shadow-sm'
            >
              <CardHeader className='pb-4'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-1.5'>
                    <CardTitle className='text-xl font-semibold text-foreground'>
                      {challenge.title}
                    </CardTitle>
                    <CardDescription className='text-muted-foreground text-sm leading-normal'>
                      Join the challenge and wait for your teacher to assign
                      matches.
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
                    {renderStudentAction(challenge)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
