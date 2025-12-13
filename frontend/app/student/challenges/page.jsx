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
  [ChallengeStatus.STARTED_PHASE_ONE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

export default function StudentChallengesPage() {
  const router = useRouter();
  const STUDENT_ID = 1;
  const { getChallenges, joinChallenge, getChallengeForJoinedStudent } =
    useChallenge();

  const [challenges, setChallenges] = useState([]);
  const [joined, setJoined] = useState({});
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

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
    setNow(new Date());
    loadChallenges();
  }, [loadChallenges]);

  const visibleChallenges = useMemo(() => {
    const list = challenges.filter((c) => new Date(c.startDatetime) <= now);
    if (list.length > 0) return [list[0]];
    return [];
  }, [challenges, now]);

  useEffect(() => {
    if (visibleChallenges.length === 0) {
      return undefined;
    }
    const challenge = visibleChallenges[0];
    let cancelled = false;

    async function checkJoined() {
      try {
        const res = await getChallengeForJoinedStudent(
          challenge.id,
          STUDENT_ID
        );
        if (!cancelled && res?.success && res.data) {
          setJoined((prev) => ({ ...prev, [challenge.id]: true }));
        }
      } catch {
        // ignore
      }
    }

    checkJoined();

    return () => {
      cancelled = true;
    };
  }, [visibleChallenges, getChallengeForJoinedStudent]);

  useEffect(() => {
    if (visibleChallenges.length === 0) {
      return undefined;
    }
    const challenge = visibleChallenges[0];
    if (!joined[challenge.id]) {
      return undefined;
    }

    const poll = async () => {
      try {
        const res = await getChallengeForJoinedStudent(
          challenge.id,
          STUDENT_ID
        );
        if (!res?.success || !res.data) return;

        const { status, startPhaseOneDateTime } = res.data;

        if (
          status === ChallengeStatus.STARTED_PHASE_ONE ||
          status === ChallengeStatus.ENDED_PHASE_ONE ||
          status === ChallengeStatus.STARTED_PHASE_TWO ||
          status === ChallengeStatus.ENDED_PHASE_TWO
        ) {
          const start = new Date(startPhaseOneDateTime).getTime();
          const elapsed = Math.floor((Date.now() - start) / 1000);
          const remaining = Math.max(3 - elapsed, 0);

          if (remaining <= 0) {
            router.push(`/student/challenges/${challenge.id}/match`);
          } else {
            setCountdown({ challengeId: challenge.id, value: remaining });
          }
        }
      } catch {
        // ignore
      }
    };

    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [visibleChallenges, joined, getChallengeForJoinedStudent, router]);

  useEffect(() => {
    if (!countdown) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (countdown.value <= 0) {
        router.push(`/student/challenges/${countdown.challengeId}/match`);
      } else {
        setCountdown((c) => {
          if (!c) return null;
          return { ...c, value: c.value - 1 };
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

  const handleJoin = async (challengeId) => {
    setError(null);
    try {
      const res = await joinChallenge(challengeId, STUDENT_ID);
      if (res?.success) {
        setJoined((prev) => ({ ...prev, [challengeId]: true }));
      } else {
        setError(res?.message || 'Unable to join challenge');
      }
    } catch {
      setError('Unable to join challenge');
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
    const isStarted = challenge.status === ChallengeStatus.STARTED_PHASE_ONE;
    const isCounting = countdown && countdown.challengeId === challenge.id;

    if (isCounting) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Challenge starting in {countdown.value}…
        </div>
      );
    }

    if (!isJoined && !isStarted) {
      return (
        <Button size='lg' onClick={() => handleJoin(challenge.id)}>
          Join
        </Button>
      );
    }

    if (!isJoined && isStarted) {
      return (
        <div className='text-destructive font-semibold text-sm'>
          The challenge is already in progress.
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
