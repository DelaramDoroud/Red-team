'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '#components/common/card';
import useChallenge from '#js/useChallenge';

import { ChallengeStatus } from '#js/constants';
import { DurationProvider } from './(context)/DurationContext';

// shared layout for both /match and /result
export default function ChallengeLayout({ children }) {
  const params = useParams();
  const challengeId = params?.challengeId;
  const { getChallengeForJoinedStudent } = useChallenge();
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
        const { data } = await getChallengeForJoinedStudent(
          challengeId,
          studentId
        );

        if (!cancelled) {
          setchallengeData(data);
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
  }, [challengeId, studentId, getChallengeForJoinedStudent]);
  const { status, title, duration } = challengeData || {};
  const phaseLabel = () => {
    switch (status) {
      case ChallengeStatus.STARTED_PHASE_ONE:
        return 'Coding Phase';
      // here we can add also scoring phase and peer revirew phase(third sprint)
      case '':
        return '';

      default:
        return status || 'Unknown';
    }
  };
  return (
    <div className='max-w-7xl mx-auto py-1 space-y-1 '>
      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? 'Loading challenge...' : title}-{' '}
            <span>{phaseLabel()}</span>
          </CardTitle>
        </CardHeader>

        {error && (
          <CardContent>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {error.message}
            </p>
          </CardContent>
        )}
      </Card>
      <DurationProvider value={{ duration, challengeId }}>
        {children}
      </DurationProvider>
    </div>
  );
}
