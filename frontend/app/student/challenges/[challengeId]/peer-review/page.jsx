'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import useChallenge from '#js/useChallenge';
import useRoleGuard from '#js/useRoleGuard';
import { ChallengeStatus } from '#js/constants';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';

const formatTimer = (seconds) => {
  if (seconds == null) return '--:--:--';
  const safeSeconds = Math.max(0, seconds);
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(safeSeconds % 60).padStart(2, '0');
  return `${hours}:${mins}:${secs}`;
};

const buildTimeLeft = (startValue, durationMinutes) => {
  if (!startValue || !durationMinutes) return null;
  const startMs = new Date(startValue).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + durationMinutes * 60 * 1000;
  return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
};

export default function PeerReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthorized } = useRoleGuard({ allowedRoles: ['student'] });
  const studentId = user?.id;
  const challengeId = params?.challengeId;
  const { getStudentPeerReviewAssignments } = useChallenge();
  const redirectOnError = useApiErrorRedirect();

  const [assignments, setAssignments] = useState([]);
  const [challengeInfo, setChallengeInfo] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [voteMap, setVoteMap] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!challengeId || !studentId || !isAuthorized) return undefined;
    let cancelled = false;

    const loadAssignments = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getStudentPeerReviewAssignments(
          challengeId,
          studentId
        );
        if (cancelled) return;
        if (res?.success === false) {
          if (redirectOnError(res)) return;
          setError(getApiErrorMessage(res, 'Unable to load peer review.'));
          setAssignments([]);
          return;
        }
        const nextAssignments = Array.isArray(res?.assignments)
          ? res.assignments
          : [];
        setAssignments(nextAssignments);
        setChallengeInfo(res?.challenge || null);

        if (nextAssignments.length > 0) {
          setSelectedIndex(0);
        }
      } catch (_err) {
        if (!cancelled) {
          setError('Unable to load peer review.');
          setAssignments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [
    challengeId,
    studentId,
    isAuthorized,
    getStudentPeerReviewAssignments,
    redirectOnError,
  ]);

  useEffect(() => {
    if (
      !challengeInfo?.startPhaseTwoDateTime ||
      !challengeInfo?.durationPeerReview
    )
      return undefined;

    const tick = () => {
      setTimeLeft(
        buildTimeLeft(
          challengeInfo.startPhaseTwoDateTime,
          challengeInfo.durationPeerReview
        )
      );
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [challengeInfo?.startPhaseTwoDateTime, challengeInfo?.durationPeerReview]);

  const isPeerReviewActive =
    challengeInfo?.status === ChallengeStatus.STARTED_PHASE_TWO ||
    challengeInfo?.status === ChallengeStatus.ENDED_PHASE_TWO;

  const selectedAssignment = assignments[selectedIndex] || null;
  const selectedSubmissionId = selectedAssignment?.submissionId;
  const currentVote = selectedSubmissionId
    ? voteMap[selectedSubmissionId] || ''
    : '';

  const completedCount = useMemo(
    () =>
      assignments.filter((assignment) =>
        Boolean(voteMap[assignment.submissionId])
      ).length,
    [assignments, voteMap]
  );

  const progressValue = assignments.length
    ? Math.round((completedCount / assignments.length) * 100)
    : 0;

  const handleVoteChange = (value) => {
    if (!selectedSubmissionId) return;
    setVoteMap((prev) => ({
      ...prev,
      [selectedSubmissionId]: value,
    }));
  };

  const handleExit = () => {
    router.push('/student/challenges');
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => Math.min(assignments.length - 1, prev + 1));
  };

  const isFirst = selectedIndex <= 0;
  const isLast =
    assignments.length === 0 || selectedIndex >= assignments.length - 1;
  if (!isAuthorized || !studentId) return null;

  if (!loading && !isPeerReviewActive) {
    return (
      <div className='max-w-3xl mx-auto px-4 py-8 space-y-4'>
        <Card>
          <CardHeader>
            <CardTitle>Peer Review</CardTitle>
            <CardDescription>
              Wait for your teacher to start the peer review phase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant='outline'
              onClick={() => router.push('/student/challenges')}
            >
              Back to challenges
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Peer Review Phase
          </p>
          <h1 className='text-3xl font-bold text-foreground'>
            Review solutions and submit your assessment
          </h1>
        </div>
        <div className='inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary'>
          <span className='h-2 w-2 rounded-full bg-primary' />
          {formatTimer(timeLeft)}
        </div>
      </div>

      {error && (
        <Card className='mt-4 border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className='mt-6 grid gap-6 lg:grid-cols-[280px_1fr]'>
        <aside className='space-y-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-semibold'>
                Overall Progress
              </CardTitle>
              <CardDescription className='text-xs text-muted-foreground'>
                {completedCount}/{assignments.length}
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='h-2 w-full rounded-full bg-muted'>
                <div
                  className='h-2 rounded-full bg-primary transition-all'
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              <p className='text-xs text-muted-foreground'>
                {progressValue}% completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-semibold'>
                Solutions to Review
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              {loading && (
                <p className='text-xs text-muted-foreground'>Loading...</p>
              )}
              {!loading && assignments.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No assignments available yet.
                </p>
              )}
              {assignments.map((assignment, index) => {
                const isSelected = index === selectedIndex;
                const vote = voteMap[assignment.submissionId];
                const status = vote ? 'Reviewed' : 'Not voted yet';
                return (
                  <button
                    key={assignment.id}
                    type='button'
                    onClick={() => setSelectedIndex(index)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className='flex items-center gap-2 font-semibold'>
                      <span className='flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted text-xs'>
                        {index + 1}
                      </span>
                      Solution {index + 1}
                    </div>
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {status}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className='space-y-2'>
            <Button className='w-full' variant='primary'>
              Summary
            </Button>
            <Button className='w-full' variant='outline' onClick={handleExit}>
              Exit
            </Button>
          </div>
        </aside>

        <section className='space-y-4 min-w-0'>
          <Card>
            <CardHeader className='bg-primary text-primary-foreground rounded-t-xl'>
              <CardTitle className='text-lg font-semibold'>
                {selectedAssignment
                  ? `Solution ${selectedIndex + 1}`
                  : 'Solution'}
              </CardTitle>
              <CardDescription className='text-primary-foreground/80'>
                Review this solution and cast your vote
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 min-w-0'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Submitted Code
                </p>
                <pre className='mt-2 max-h-[320px] w-full max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-border bg-muted p-4 text-sm text-foreground'>
                  {selectedAssignment?.code || 'No code available.'}
                </pre>
              </div>

              <div className='rounded-xl border border-border bg-muted/40 p-4 space-y-3'>
                <div>
                  <p className='text-sm font-semibold text-foreground'>
                    Your Assessment
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Your selection is saved locally. You can change it anytime.
                  </p>
                </div>

                {['correct', 'incorrect', 'abstain'].map((option) => {
                  let label = 'Abstain';
                  if (option === 'correct') label = 'Correct';
                  if (option === 'incorrect') label = 'Incorrect';
                  const isSelected = currentVote === option;
                  return (
                    <label
                      key={option}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${
                        isSelected
                          ? 'border-primary/40 bg-primary/10 shadow-sm'
                          : 'border-border bg-card'
                      }`}
                    >
                      <span>{label}</span>
                      <input
                        type='radio'
                        name='assessment'
                        value={option}
                        checked={isSelected}
                        onChange={() => handleVoteChange(option)}
                        className='h-4 w-4 accent-primary cursor-pointer'
                      />
                    </label>
                  );
                })}
              </div>

              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <Button
                  type='button'
                  variant='primary'
                  onClick={handlePrev}
                  disabled={isFirst}
                >
                  Previous
                </Button>
                <span>
                  {assignments.length
                    ? `Solution ${selectedIndex + 1} of ${assignments.length}`
                    : 'No solutions assigned'}
                </span>
                <Button
                  type='button'
                  variant='primary'
                  onClick={handleNext}
                  disabled={isLast}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
