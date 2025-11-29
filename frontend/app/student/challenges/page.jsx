'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';

const dummyData = [
  {
    id: 1,
    title: 'Frontend Challenge',
    duration: '3 days',
    startDatetime: '2025-11-29 11:19',
    status: 'started',
  },
  {
    id: 2,
    title: 'Backend Coding Match',
    duration: '5 days',
    startDatetime: '2025-11-28 9:50',
    status: 'started',
  },
];

export default function StudentChallengesPage() {
  const [joinedChallenges, setJoinedChallenges] = useState({});
  // const [tick, setTick] = useState(0);
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  function filterChallenges(challenges, joined, nowTime) {
    return challenges.filter((c) => {
      const start = new Date(c.startDatetime);
      // const end = new Date(start.getTime() + 60 * 1000); // +1 minute

      const inWindow = nowTime >= start;
      const status = c.status !== 'started';
      const isJoined = joined[c.id] === true;

      return inWindow && (status || isJoined);
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      // setTick((t) => t + 1);
      setNow(new Date());
      dummyData.forEach((c) => {
        if (joinedChallenges[c.id] && c.status === 'started') {
          router.push(`/newChallenge`);
        }
      }); // این باعث رندر دوباره صفحه می‌شود
    }, 2000);
    return () => clearInterval(interval);
  }, [joinedChallenges, router]);

  const visibleChallenges = filterChallenges(dummyData, joinedChallenges, now);

  const handleJoin = (id) => {
    setJoinedChallenges((prev) => ({ ...prev, [id]: true }));
  };
  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      {/* <div className="w-96 h-32 bg-red-500 mb-100">TEST</div> */}
      <h1 className='text-3xl font-bold text-white'>Available Challenges</h1>

      <div>
        {visibleChallenges.map((c) => (
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
                {!joinedChallenges[c.id] ? (
                  <Button
                    className='bg-white text-black hover:bg-gray-200 w-200'
                    onClick={() => handleJoin(c.id)}
                  >
                    Join
                  </Button>
                ) : (
                  <div className='text-yellow-300 font-semibold text-sm'>
                    Wait for the teacher to start the challenge.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
