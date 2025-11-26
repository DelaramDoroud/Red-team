'use client';

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
    startDatetime: '2025-11-27 10:00',
  },
  {
    id: 2,
    title: 'Backend Coding Match',
    duration: '5 days',
    startDatetime: '2025-11-26 17:42',
  },
];

export default function StudentChallengesPage() {
  const [joinedChallenges, setJoinedChallenges] = useState({});
  const [countdowns, setCountdowns] = useState({});

  // Calculate countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns = {};

      dummyData.forEach((c) => {
        if (joinedChallenges[c.id]) {
          const now = new Date();
          const start = new Date(c.startDatetime);
          const diff = start - now;

          if (diff <= 0) {
            newCountdowns[c.id] =
              'Wait for the teacher to start the challenge.';
          } else {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            newCountdowns[c.id] = `${hours}h ${minutes}m ${seconds}s`;
          }
        }
      });

      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [joinedChallenges]);

  const handleJoin = (id) => {
    setJoinedChallenges((prev) => ({ ...prev, [id]: true }));
  };
  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      {/* <div className="w-96 h-32 bg-red-500 mb-100">TEST</div> */}
      <h1 className='text-3xl font-bold text-white'>Available Challenges</h1>

      <div>
        {dummyData.map((c) => (
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
                    Pending... ⏳
                    <br />
                    <span className='text-white'>{countdowns[c.id]}</span>
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
