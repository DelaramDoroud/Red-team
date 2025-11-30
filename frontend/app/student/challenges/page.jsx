'use client';

import { Button } from '#components/common/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '#components/common/card';

const dummyData = [
  {
    id: 1,
    title: 'Frontend Challenge',
    duration: '3 days',
    startDatetime: '2025-01-14 10:00',
  },
  {
    id: 2,
    title: 'Backend Coding Match',
    duration: '5 days',
    startDatetime: '2025-01-20 09:00',
  },
];

export default function StudentChallengesPage() {
  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <h1 className='text-3xl font-bold text-white'>Available Challenges</h1>

      <div className='space-y-4'>
        {dummyData.map((c) => (
          <Card
            key={c.id}
            className='bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-xl mb-px-20 p-4 w-auto min-w-md'
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

                <Button className='bg-white text-black hover:bg-gray-200 w-8'>
                  Join
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
