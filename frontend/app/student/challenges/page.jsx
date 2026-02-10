'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '#components/common/Button';
import { Card, CardContent } from '#components/common/card';
import { ChallengeStatus } from '#js/constants';
import { useRouter } from '#js/router';
import useChallenge from '#js/useChallenge';
import useRoleGuard from '#js/useRoleGuard';
import useSseEvent from '#js/useSseEvent';
import {
  ChallengeCardItem,
  ChallengeStatusBadge,
  EmptyChallengeCard,
} from './ChallengeCardItem';
import {
  ALLOWED_ROLES,
  activeStatuses,
  getActivePriority,
  getChallengeRoute,
  getChallengeStartTimestamp,
  getStudentStatusLabel,
  sortByStartAsc,
  sortByStartDesc,
  unjoinableStatuses,
} from './challengePageUtils';

export default function StudentChallengesPage() {
  const router = useRouter();
  const { user, isAuthorized } = useRoleGuard({
    allowedRoles: ALLOWED_ROLES,
  });
  const studentId = user?.id;
  const { getChallengesForStudent, joinChallenge } = useChallenge();
  const [challenges, setChallenges] = useState([]);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());
  const [pendingActions, setPendingActions] = useState({});
  const lastRedirectKeyRef = useRef(null);
  const activeRedirectStatuses = useRef([
    ChallengeStatus.ASSIGNED,
    ChallengeStatus.STARTED_PEER_REVIEW,
    ChallengeStatus.STARTED_CODING_PHASE,
  ]);
  const loadChallenges = useCallback(async () => {
    try {
      if (!studentId) return undefined;
      const res = await getChallengesForStudent(studentId);
      if (!res || res.success === false) {
        setError(res?.message || 'Unable to load challenges');
        setChallenges([]);
        return undefined;
      }
      let list = [];
      if (Array.isArray(res)) list = res;
      else if (Array.isArray(res?.data)) list = res.data;
      setChallenges(list);
      return undefined;
    } catch {
      setError('Unable to load challenges');
      setChallenges([]);
      return undefined;
    }
  }, [getChallengesForStudent, studentId]);
  useEffect(() => {
    if (!isAuthorized || !studentId) return undefined;
    setNow(new Date());
    loadChallenges();
    const id = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(id);
  }, [loadChallenges, isAuthorized, studentId]);

  const handleChallengeUpdated = useCallback(() => {
    setNow(new Date());
    loadChallenges();
  }, [loadChallenges]);
  useSseEvent('challenge-updated', handleChallengeUpdated);

  useEffect(() => {
    if (!isAuthorized || !studentId) return;
    const activeChallenge = challenges.find(
      (challenge) =>
        challenge.joined &&
        activeRedirectStatuses.current.includes(challenge.status)
    );
    if (!activeChallenge) {
      lastRedirectKeyRef.current = null;
      return;
    }
    const redirectRoute =
      activeChallenge.status === ChallengeStatus.STARTED_PEER_REVIEW
        ? 'peer-review'
        : 'match';
    const nextKey = `${activeChallenge.id}-${activeChallenge.status}`;
    if (lastRedirectKeyRef.current === nextKey) return;
    lastRedirectKeyRef.current = nextKey;
    router.push(`/student/challenges/${activeChallenge.id}/${redirectRoute}`);
  }, [challenges, isAuthorized, router, studentId]);

  const handleJoin = async (challengeId) => {
    setError(null);
    setPendingActions((prev) => ({ ...prev, [challengeId]: { join: true } }));
    if (!studentId) {
      setError('Student profile not available.');
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
      return undefined;
    }
    try {
      const res = await joinChallenge(challengeId, studentId);
      if (res?.success) {
        setChallenges((prev) =>
          prev.map((challenge) => {
            if (challenge.id !== challengeId) return challenge;
            return { ...challenge, joined: true };
          })
        );
      } else {
        setError(res?.message || 'Unable to join challenge');
      }
      return undefined;
    } catch {
      setError('Unable to join challenge');
      return undefined;
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[challengeId];
        return next;
      });
    }
  };

  const nowMs = now.getTime();

  const renderAction = (challenge) => {
    const isJoined = Boolean(challenge.joined);
    const { status } = challenge;
    const isUnjoinable = unjoinableStatuses.has(status);
    const isCodingPhaseActive = status === ChallengeStatus.STARTED_CODING_PHASE;
    const isPeerReviewActive = status === ChallengeStatus.STARTED_PEER_REVIEW;
    const isCodingPhaseComplete = status === ChallengeStatus.ENDED_CODING_PHASE;
    const isPeerReviewComplete = status === ChallengeStatus.ENDED_PEER_REVIEW;
    const startTimestamp = getChallengeStartTimestamp(challenge);
    const isUpcoming = startTimestamp !== null ? startTimestamp > nowMs : false;
    const isJoining = pendingActions[challenge.id]?.join;

    if (isUpcoming) {
      return (
        <div className='text-muted-foreground font-semibold text-sm'>
          Starts soon
        </div>
      );
    }

    if (!isJoined && status === ChallengeStatus.ASSIGNED) {
      return (
        <div className='text-destructive font-semibold text-sm'>
          Assignments are already set. Contact your teacher if you need access.
        </div>
      );
    }

    if (!isJoined && isUnjoinable) {
      return (
        <div className='text-destructive font-semibold text-sm'>
          the challenge is already in progress.
        </div>
      );
    }

    if (!isJoined) {
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

    if (isJoined && isCodingPhaseActive) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Challenge started. Redirecting...
        </div>
      );
    }

    if (isJoined && status === ChallengeStatus.ASSIGNED) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Challenge assigned. Redirecting...
        </div>
      );
    }

    if (isJoined && isPeerReviewActive) {
      return (
        <div className='text-primary font-semibold text-sm'>
          Peer review started. Redirecting...
        </div>
      );
    }

    if (isJoined && isCodingPhaseComplete) {
      return (
        <Button
          size='lg'
          variant='secondary'
          onClick={() => router.push(getChallengeRoute(challenge))}
        >
          Open
        </Button>
      );
    }

    if (isJoined && isPeerReviewComplete) {
      if (!challenge.resultsReady) {
        return null;
      }
      return (
        <Button
          size='lg'
          variant='secondary'
          onClick={() => router.push(getChallengeRoute(challenge))}
        >
          View Your Solution & Feedback
        </Button>
      );
    }

    return (
      <div className='text-primary font-semibold text-sm'>
        Wait for the teacher to start the challenge.
      </div>
    );
  };

  const activeChallenge = useMemo(() => {
    const joinedCandidates = challenges.filter(
      (challenge) => challenge.joined && activeStatuses.has(challenge.status)
    );
    if (joinedCandidates.length > 0) {
      const sorted = [...joinedCandidates].sort((a, b) => {
        const priorityDiff =
          getActivePriority(a.status) - getActivePriority(b.status);
        if (priorityDiff !== 0) return priorityDiff;
        return sortByStartAsc(a, b);
      });
      return sorted[0];
    }

    const joinableCurrent = challenges.filter((challenge) => {
      if (challenge.status !== ChallengeStatus.PUBLIC) return false;
      const startTimestamp = getChallengeStartTimestamp(challenge);
      if (startTimestamp == null) return false;
      return startTimestamp <= nowMs;
    });

    if (joinableCurrent.length > 0) {
      const sorted = [...joinableCurrent].sort(sortByStartAsc);
      return sorted[0];
    }

    const nonJoinedActive = challenges.filter(
      (challenge) => !challenge.joined && activeStatuses.has(challenge.status)
    );
    if (nonJoinedActive.length > 0) {
      const sorted = [...nonJoinedActive].sort((a, b) => {
        const priorityDiff =
          getActivePriority(a.status) - getActivePriority(b.status);
        if (priorityDiff !== 0) return priorityDiff;
        return sortByStartAsc(a, b);
      });
      return sorted[0];
    }

    return null;
  }, [challenges, nowMs]);

  const upcomingChallenge = useMemo(() => {
    const candidates = challenges.filter((challenge) => {
      const startTimestamp = getChallengeStartTimestamp(challenge);
      if (startTimestamp == null) return false;
      if (startTimestamp <= nowMs) return false;
      if (challenge.status === ChallengeStatus.ENDED_PEER_REVIEW) return false;
      return !(activeChallenge && challenge.id === activeChallenge.id);
    });

    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort(sortByStartAsc);
    return sorted[0];
  }, [activeChallenge, challenges, nowMs]);

  const endedChallenges = useMemo(() => {
    const ended = challenges.filter(
      (challenge) =>
        challenge.joined &&
        challenge.status === ChallengeStatus.ENDED_PEER_REVIEW
    );
    return [...ended].sort(sortByStartDesc);
  }, [challenges]);

  if (!isAuthorized || !studentId) return null;

  return (
    <div className='max-w-5xl mx-auto px-6 py-8 space-y-6 relative'>
      <div className='space-y-2'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Student area
        </p>
        <h1 className='text-3xl font-bold text-foreground'>
          Available Challenges
        </h1>
        <p className='text-muted-foreground text-sm'>
          Track future, active, and completed challenges in one place.
        </p>
      </div>

      {error && (
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      <section className='space-y-3'>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold text-foreground'>Active</h2>
          <p className='text-sm text-muted-foreground'>
            Your current challenge, if one is active.
          </p>
        </div>
        {activeChallenge ? (
          <ChallengeCardItem
            challenge={activeChallenge}
            statusLabel={getStudentStatusLabel(activeChallenge, nowMs)}
            statusBadge={
              <ChallengeStatusBadge status={activeChallenge.status} />
            }
            actionNode={renderAction(activeChallenge)}
          />
        ) : (
          <EmptyChallengeCard message='No active challenges right now.' />
        )}
      </section>
      <section className='space-y-3'>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold text-foreground'>Upcoming</h2>
          <p className='text-sm text-muted-foreground'>
            The nearest upcoming challenge in your schedule.
          </p>
        </div>
        {upcomingChallenge ? (
          <ChallengeCardItem
            challenge={upcomingChallenge}
            statusLabel={getStudentStatusLabel(upcomingChallenge, nowMs)}
            statusBadge={
              <ChallengeStatusBadge status={upcomingChallenge.status} />
            }
            actionNode={renderAction(upcomingChallenge)}
          />
        ) : (
          <EmptyChallengeCard message='No upcoming challenges available.' />
        )}
      </section>

      <section className='space-y-3'>
        <div className='space-y-1'>
          <h2 className='text-lg font-semibold text-foreground'>Ended</h2>
          <p className='text-sm text-muted-foreground'>
            Completed challenges you participated in.
          </p>
        </div>
        {endedChallenges.length === 0 ? (
          <EmptyChallengeCard message='No completed challenges yet.' />
        ) : (
          endedChallenges.map((challenge) => (
            <ChallengeCardItem
              key={challenge.id}
              challenge={challenge}
              statusLabel={getStudentStatusLabel(challenge, nowMs)}
              statusBadge={<ChallengeStatusBadge status={challenge.status} />}
              actionNode={renderAction(challenge)}
            />
          ))
        )}
      </section>
    </div>
  );
}
