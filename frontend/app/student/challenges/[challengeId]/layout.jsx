'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '#components/common/card';
import useChallenge from '#js/useChallenge';
import Timer from './(components)/Timer';

// shared layout for both /match and /result
export default function ChallengeLayout({ children }) {
  const params = useParams();
  const challengeId = params?.challengeId;
  const { getChallengeStatus } = useChallenge();
  const [challengeData, setchallengeData] = useState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const studentId = 1;

  useEffect(() => {
    if (!challengeId || !studentId) return () => {};

    let cancelled = false;

    async function loadStatus() {
      setLoading(true);
      setError(null);

      try {
        const data = await getChallengeStatus(challengeId, studentId);

        if (!cancelled) {
          setchallengeData(data.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError({
            message:
              'Network error while loading challenge information. Please try again.',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [challengeId, studentId, getChallengeStatus]);

  //   const title =
  //     challengeData?.challengeTitle || challengeData?.challenge?.title;

  function getPhaseLabel(status) {
    switch (status) {
      case 'started':
        return 'Phase 1';
      // here we can add also scoring phase and peer revirew phase(third sprint)
      case '':
        return '';

      default:
        return status || 'Unknown';
    }
  }
  const status = challengeData?.status;
  const phaseLabel = getPhaseLabel(status);

  return (
    <div className='max-w-5xl mx-auto py-8 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>
            challenge title
            {loading ? 'Loading challenge...' : ''}
          </CardTitle>

          <CardDescription className='flex items-center gap-2'>
            <span>Phase: {phaseLabel}</span>

            <Timer duration={challengeData?.duration || 'error'} />
          </CardDescription>
        </CardHeader>

        {error && (
          <CardContent>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {error.message}
            </p>
          </CardContent>
        )}
      </Card>

      {children}
    </div>
  );
}
