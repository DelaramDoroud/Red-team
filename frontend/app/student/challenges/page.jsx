'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import useChallenge from '#js/useChallenge';
import styles from './page.module.css';

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
  const { getChallenges, joinChallenge } = useChallenge();
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

  function filterChallenges(allChallenges, joined, nowTime) {
    return allChallenges.filter((c) => {
      const start = new Date(c.startDatetime);
      // const end = new Date(start.getTime() + 60 * 1000); // +1 minute

      return nowTime >= start;
    });
  }

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

      if (res.success) {
        setJoinedChallenges((prev) => ({ ...prev, [challengeId]: true }));
      } else {
        // console.error('Join failed', res.error);
      }
    } catch (err) {
      // console.error('Join error:', err);
    }
  };
  function renderChallengeStatus(c) {
    const joined = joinedChallenges[c.id];
    const started = c.status === 'started';

    if (!joined && !started) {
      return (
        <Button
          variant='default'
          size='lg'
          className={styles.joinButton}
          onClick={() => handleJoin(c.id)}
        >
          Join
        </Button>
      );
    }

    if (!joined && started) {
      return (
        <div className='text-destructive font-semibold text-sm'>
          the challenge is in progress.
        </div>
      );
    }

    return (
      <div className='text-accent font-semibold text-sm'>
        Wait for the teacher to start the challenge.
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <h1 className='text-3xl font-bold '>Available Challenges</h1>

      <div>
        {error && (
          <Card className='mb-4 shadow-sm'>
            <CardContent className='py-6'>
              <p className='text-destructive text-sm'>{error}</p>
            </CardContent>
          </Card>
        )}
        {visibleChallenges.length === 0 ? (
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
