'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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

const statusTone = {
  [ChallengeStatus.PUBLIC]: 'bg-primary/10 text-primary ring-1 ring-primary/20',
  [ChallengeStatus.ASSIGNED]:
    'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-200',
  [ChallengeStatus.STARTED_PHASE_ONE]:
    'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-200',
  [ChallengeStatus.PRIVATE]:
    'bg-muted text-muted-foreground ring-1 ring-border',
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export default function ChallengeDetailPage() {
  const params = useParams();
  const { getChallengeMatches, assignChallenge, getChallengeParticipants } =
    useChallenge();
  const challengeId = params?.id;

  const [challenge, setChallenge] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [studentCount, setStudentCount] = useState(0);

  const load = useCallback(async () => {
    if (!challengeId) return;
    setError(null);
    setLoading(true);
    try {
      const [matchesRes, participantsRes] = await Promise.all([
        getChallengeMatches(challengeId),
        getChallengeParticipants(challengeId),
      ]);

      if (matchesRes?.success) {
        setChallenge(matchesRes.challenge);
        setAssignments(matchesRes.assignments || []);
      } else {
        setError(
          matchesRes?.error || matchesRes?.message || 'Unable to load matches'
        );
        setAssignments([]);
      }

      if (participantsRes?.success && Array.isArray(participantsRes.data)) {
        setStudentCount(participantsRes.data.length);
      } else {
        setStudentCount(0);
      }
    } catch (_err) {
      setError('Unable to load matches');
      setAssignments([]);
      setStudentCount(0);
    } finally {
      setLoading(false);
    }
  }, [challengeId, getChallengeMatches, getChallengeParticipants]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = useCallback(async () => {
    if (!challengeId) return;
    const now = new Date();
    const canStartNow =
      challenge?.startDatetime && new Date(challenge.startDatetime) <= now;
    if (!canStartNow) {
      setError('The challenge start time has not been reached yet.');
      return;
    }
    if (!studentCount) {
      setError('No students have joined this challenge yet.');
      return;
    }
    setAssigning(true);
    setError(null);
    try {
      const res = await assignChallenge(challengeId);
      if (res?.success === false) {
        setError(res?.error || res?.message || 'Unable to assign students');
      }
      await load();
    } catch (_err) {
      setError('Unable to assign students');
    } finally {
      setAssigning(false);
    }
  }, [
    assignChallenge,
    challengeId,
    load,
    studentCount,
    challenge?.startDatetime,
  ]);

  const statusBadge = useMemo(() => {
    const tone =
      statusTone[challenge?.status] || statusTone[ChallengeStatus.PRIVATE];
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${tone}`}
      >
        {challenge?.status || '—'}
      </span>
    );
  }, [challenge?.status]);

  return (
    <div className='max-w-6xl mx-auto px-6 py-8 space-y-6'>
      <div className='flex items-center justify-between gap-3'>
        <div className='space-y-2'>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Challenge overview
          </p>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='text-3xl font-bold text-foreground'>
              {challenge?.title || 'Challenge'}
            </h1>
            {statusBadge}
          </div>
          <p className='text-muted-foreground text-sm'>
            Start: {formatDateTime(challenge?.startDatetime)} · Duration:{' '}
            {challenge?.duration || '—'} min
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' asChild>
            <Link href='/challenges'>Back</Link>
          </Button>
          <Button variant='outline' onClick={load} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          {challenge?.status === ChallengeStatus.PUBLIC ? (
            <Button onClick={handleAssign} disabled={assigning || loading}>
              {assigning ? 'Assigning...' : 'Assign students'}
            </Button>
          ) : null}
        </div>
      </div>

      {error && (
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      {!assignments.length && !error ? (
        <Card className='border border-dashed border-border bg-card text-card-foreground shadow-sm'>
          <CardContent className='py-6'>
            <p className='text-muted-foreground text-sm'>
              No matches have been assigned yet for this challenge.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className='space-y-4'>
        {assignments.map((group) => (
          <Card
            key={group.challengeMatchSettingId}
            className='border border-border bg-card text-card-foreground shadow-sm'
          >
            <CardHeader className='pb-2'>
              <CardTitle className='text-lg font-semibold text-foreground'>
                {group.matchSetting?.problemTitle || 'Match setting'}
              </CardTitle>
              <CardDescription className='text-sm text-muted-foreground'>
                Match setting ID:{' '}
                {group.matchSetting?.id ?? group.challengeMatchSettingId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-auto rounded-lg border border-border'>
                <table className='min-w-full table-auto text-sm'>
                  <thead className='bg-muted'>
                    <tr className='text-left text-muted-foreground'>
                      <th className='px-4 py-3 font-semibold'>Match ID</th>
                      <th className='px-4 py-3 font-semibold'>Student</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.matches.map((match) => (
                      <tr key={match.id} className='border-t border-border/60'>
                        <td className='px-4 py-3 font-medium text-foreground'>
                          {match.id}
                        </td>
                        <td className='px-4 py-3 text-foreground'>
                          {match.student?.username || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
