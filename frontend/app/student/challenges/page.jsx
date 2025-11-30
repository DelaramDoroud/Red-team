'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import useChallenge from '#js/useChallenge';

// const dummyData = [
//   {
//     id: 1,
//     title: 'Frontend Challenge',
//     duration: '3 days',
//     startDatetime: '2025-11-29 11:19',
//     status: 'started',
//   },
//   {
//     id: 2,
//     title: 'Backend Coding Match',
//     duration: '5 days',
//     startDatetime: '2025-11-28 9:50',
//     status: 'started',
//   },
// ];

export default function StudentChallengesPage() {
  const router = useRouter();
  const { loading, getChallenges, joinChallenge } = useChallenge();
  const [challenges, setChallenges] = useState([]);
  const [joinedChallenges, setJoinedChallenges] = useState({});
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

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

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (!cancelled) {
        await load();
      }
    };
    tick();
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [load]);

  function filterChallenges(allChallenges, joined, nowTime) {
    return allChallenges.filter((c) => {
      const start = new Date(c.startDatetime);
      // const end = new Date(start.getTime() + 60 * 1000); // +1 minute

      return nowTime >= start;
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      challenges.forEach((c) => {
        if (joinedChallenges[c.id] && c.status === 'started')
          router.push(`/new-challenge`);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [joinedChallenges, router, challenges]);
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const allAvailableChallenges = filterChallenges(
    challenges,
    joinedChallenges,
    now
  );
  const visibleChallenges =
    allAvailableChallenges.length > 0 ? [allAvailableChallenges[0]] : [];
  const handleJoin = async (challengeId) => {
    try {
      const res = await joinChallenge(challengeId, 1);
      if (res?.success === false) {
        console.error('Join failed', res.error || res.message);
        return;
      }
      setJoinedChallenges((prev) => ({ ...prev, [challengeId]: true }));
    } catch (err) {
      console.error('Join error:', err);
    }
  };
  function renderChallengeStatus(c) {
    const joined = joinedChallenges[c.id];
    const started = c.status === 'started';

    if (!joined && !started) {
      return <Button onClick={() => handleJoin(c.id)}>Join</Button>;
    }

    if (!joined && started) {
      return (
        <div className='text-red-300 font-semibold text-sm'>
          the challenge is in progress.
        </div>
      );
    }

    return (
      <div className='text-yellow-300 font-semibold text-sm'>
        Wait for the teacher to start the challenge.
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <h1 className='text-3xl font-bold '>Available Challenges</h1>

      <div>
        {error && (
          <Card className='bg-red-500/10 border border-red-500/30 text-white rounded-xl w-lg mb-4'>
            <CardContent className='py-6'>
              <p className='text-red-300 text-sm'>{error}</p>
            </CardContent>
          </Card>
        )}
        {!error && loading && (
          <Card className='bg-white/5 border border-dashed border-white/20 text-white rounded-xl w-lg mb-4'>
            <CardContent className='py-6'>
              <p className='text-sm text-gray-200'>Loading challenges…</p>
            </CardContent>
          </Card>
        )}
        {!error && !loading && visibleChallenges.length === 0 ? (
          <Card className='bg-white/5 border border-dashed border-white/20 text-white rounded-xl w-lg mb-4'>
            <CardContent className='py-6'>
              <p className='text-warning text-sm'>
                There is no available challenge at the moment. Please wait for
                your teacher to schedule one.
              </p>
            </CardContent>
          </Card>
        ) : (
          visibleChallenges.map((c) => (
            <Card
              key={c.id}
              className='bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl w-lg mb-4'
            >
              <CardHeader className='pb-5'>
                <CardTitle className='text-xl'>{c.title}</CardTitle>
              </CardHeader>

              <CardContent>
                <div className='flex items-center justify-between w-full'>
                  <CardDescription className='text-gray-300 text-sm'>
                    Start: {c.startDatetime}
                    <br />
                    Duration: {c.duration}
                  </CardDescription>
                  {renderChallengeStatus(c)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
