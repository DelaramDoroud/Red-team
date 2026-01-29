'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '#components/common/Button';
import ToggleSwitch from '#components/common/ToggleSwitch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/common/Table';
import useChallenge from '#js/useChallenge';
import { useAppSelector } from '#js/store/hooks';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import { ChallengeStatus } from '#js/constants';
import { formatDateTime } from '#js/date';
import SnakeGame from '#components/common/SnakeGame';
import { useDuration } from '../(context)/DurationContext';

const normalizeMultilineValue = (value) =>
  typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return normalizeMultilineValue(value);
  try {
    return normalizeMultilineValue(JSON.stringify(value));
  } catch {
    return normalizeMultilineValue(String(value));
  }
};

const renderValue = (value) => (
  <span className='whitespace-pre-wrap'>{formatValue(value)}</span>
);

const buildTestKey = (result) => {
  if (Number.isInteger(result?.testIndex)) return `private-${result.testIndex}`;
  return JSON.stringify({
    expectedOutput: result?.expectedOutput,
    actualOutput: result?.actualOutput,
    passed: result?.passed,
  });
};

export default function ChallengeResultPage() {
  const params = useParams();
  const router = useRouter();
  const durationContext = useDuration();
  const challengeStatus = durationContext?.status;
  const hasChallengeStatus =
    challengeStatus !== null && challengeStatus !== undefined;
  const isChallengeEnded = challengeStatus === ChallengeStatus.ENDED_PHASE_TWO;
  const canLoadResults =
    !durationContext || (hasChallengeStatus && isChallengeEnded);
  const {
    user,
    loading: authLoading,
    isLoggedIn,
  } = useAppSelector((state) => state.auth);
  const studentId = user?.id;
  const challengeId = params?.challengeId;
  const { getChallengeResults } = useChallenge();
  const redirectOnError = useApiErrorRedirect();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [finalization, setFinalization] = useState(null);
  const [isFinalizationPending, setIsFinalizationPending] = useState(false);
  const [awaitingChallengeEnd, setAwaitingChallengeEnd] = useState(false);
  const [showReviewDetails, setShowReviewDetails] = useState(false);

  const loadResults = useCallback(async () => {
    if (!challengeId || !studentId || !isLoggedIn) return;
    setAwaitingChallengeEnd(false);
    setLoading(true);
    setError(null);
    try {
      const res = await getChallengeResults(challengeId, studentId);
      if (res?.success === false) {
        const apiMessage = res?.error?.message || getApiErrorMessage(res, null);
        if (apiMessage?.toLowerCase().includes('has not ended yet')) {
          setAwaitingChallengeEnd(true);
          setLoading(false);
          setError(null);
          return;
        }
        if (redirectOnError(res)) return;
        setError(getApiErrorMessage(res, 'Unable to load results.'));
        setResultData(null);
        setFinalization(null);
        return;
      }
      const payload = res?.data || res;
      const finalizationInfo = payload?.finalization || null;
      const resultsReady = finalizationInfo?.resultsReady !== false;
      setFinalization(finalizationInfo);
      setResultData(payload);
      if (!resultsReady) {
        setIsFinalizationPending(true);
        return;
      }
      setIsFinalizationPending(false);
    } catch {
      setError('Unable to load results.');
    } finally {
      setLoading(false);
    }
  }, [
    challengeId,
    studentId,
    isLoggedIn,
    getChallengeResults,
    redirectOnError,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (durationContext && hasChallengeStatus && !isChallengeEnded) {
      setLoading(false);
      return undefined;
    }
    if (!canLoadResults) return undefined;
    if (!challengeId || !studentId || !isLoggedIn) return undefined;
    const run = async () => {
      if (cancelled) return;
      await loadResults();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    canLoadResults,
    challengeId,
    durationContext,
    hasChallengeStatus,
    isChallengeEnded,
    isLoggedIn,
    loadResults,
    studentId,
  ]);

  useEffect(() => {
    if (!isFinalizationPending || !canLoadResults) return undefined;
    const timeoutId = setTimeout(() => {
      loadResults();
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [canLoadResults, isFinalizationPending, loadResults]);

  if (authLoading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading your profile...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isLoggedIn || !studentId) return null;

  if (durationContext && !hasChallengeStatus && loading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading challenge status...
          </CardContent>
        </Card>
      </div>
    );
  }

  const isWaitingForResults =
    awaitingChallengeEnd ||
    (durationContext && hasChallengeStatus && !isChallengeEnded);

  if (isWaitingForResults) {
    return (
      <div className='max-w-5xl mx-auto px-4 py-10 space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Peer review in progress</CardTitle>
            <CardDescription>
              Your review is complete. Results will be available once the
              challenge ends.
            </CardDescription>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            You can play a quick round of Snake while you wait.
          </CardContent>
        </Card>
        <SnakeGame />
      </div>
    );
  }

  if (isFinalizationPending) {
    const totalMatches = finalization?.totalMatches;
    const finalizedCount = finalization?.finalSubmissionCount;
    const pendingCount = finalization?.pendingFinalCount;
    const progressText =
      typeof totalMatches === 'number' && typeof finalizedCount === 'number'
        ? `${finalizedCount} / ${totalMatches}`
        : null;
    const pendingText =
      typeof pendingCount === 'number' ? `${pendingCount}` : null;

    return (
      <div className='max-w-5xl mx-auto px-4 py-10 space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Preparing your results</CardTitle>
            <CardDescription>
              We are still finalizing submissions for the class. You can play a
              quick round of Snake while we finish.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            {progressText && (
              <p>
                Finalized submissions:{' '}
                <span className='font-semibold'>{progressText}</span>
              </p>
            )}
            {pendingText && (
              <p>
                Pending calculations:{' '}
                <span className='font-semibold'>{pendingText}</span>
              </p>
            )}
            {error && (
              <p className='text-amber-700'>
                Having trouble refreshing results. Retrying automatically...
              </p>
            )}
          </CardContent>
        </Card>
        <SnakeGame />
      </div>
    );
  }

  if (loading) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading results...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10 space-y-4'>
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
        <Button
          variant='outline'
          onClick={() => router.push('/student/challenges')}
        >
          Back to challenges
        </Button>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            No results available yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { challenge, matchSetting, scoreBreakdown } = resultData;
  const phaseTwoEndTimestamp = challenge?.endPhaseTwoDateTime
    ? new Date(challenge.endPhaseTwoDateTime).getTime()
    : null;
  const hasPhaseTwoEnded =
    phaseTwoEndTimestamp !== null ? phaseTwoEndTimestamp <= Date.now() : false;
  const isFullyEnded =
    challenge?.status === ChallengeStatus.ENDED_PHASE_TWO && hasPhaseTwoEnded;
  const studentSubmission = resultData?.studentSubmission || null;
  const privateResults = Array.isArray(studentSubmission?.privateTestResults)
    ? studentSubmission.privateTestResults
    : [];
  const peerReviewTests =
    isFullyEnded && Array.isArray(resultData?.peerReviewTests)
      ? resultData.peerReviewTests
      : [];
  const otherSubmissions =
    isFullyEnded && Array.isArray(resultData?.otherSubmissions)
      ? resultData.otherSubmissions
      : [];
  const hasPeerReviewTests = peerReviewTests.some(
    (review) => Array.isArray(review.tests) && review.tests.length > 0
  );

  return (
    <div className='max-w-6xl mx-auto px-4 py-8 space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>{challenge?.title || 'Challenge results'}</CardTitle>
          <CardDescription>
            {matchSetting?.problemTitle
              ? `Problem: ${matchSetting.problemTitle}`
              : 'Review the outcome of your challenge.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your submission</CardTitle>
          <CardDescription>
            Results appear after the challenge ends.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {!studentSubmission && (
            <p className='text-sm text-muted-foreground'>
              You did not submit a solution for this challenge.
            </p>
          )}

          {studentSubmission && (
            <>
              <div className='rounded-xl border border-border bg-muted/40 p-4 space-y-2'>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  Submitted at {formatDateTime(studentSubmission.createdAt)}
                </p>
                <pre className='max-h-[320px] w-full overflow-auto rounded-lg border border-border bg-background p-4 text-sm'>
                  {studentSubmission.code || ''}
                </pre>
              </div>

              <div>
                <p className='text-sm font-semibold'>Private test results</p>
                {privateResults.length === 0 ? (
                  <p className='text-xs text-muted-foreground mt-2'>
                    No private test results available.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Expected output</TableHead>
                        <TableHead>Your output</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {privateResults.map((result, index) => {
                        const displayIndex = Number.isInteger(result.testIndex)
                          ? result.testIndex + 1
                          : index + 1;
                        const statusLabel = result.passed ? 'Passed' : 'Failed';
                        const statusClass = result.passed
                          ? 'text-emerald-600'
                          : 'text-red-600';
                        return (
                          <TableRow key={buildTestKey(result)}>
                            <TableCell>Test {displayIndex}</TableCell>
                            <TableCell>
                              {renderValue(result.expectedOutput)}
                            </TableCell>
                            <TableCell>
                              {renderValue(result.actualOutput)}
                            </TableCell>
                            <TableCell className={statusClass}>
                              {statusLabel}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isFullyEnded && (
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <div className='space-y-1'>
              <CardTitle>Peer Review Results</CardTitle>
              <CardDescription>
                Overview of your performance in the peer review phase.
              </CardDescription>
            </div>
            {scoreBreakdown && (
              <ToggleSwitch
                checked={showReviewDetails}
                onChange={() => setShowReviewDetails((prev) => !prev)}
                label='Show details'
              />
            )}
          </CardHeader>
          <CardContent className='space-y-6 pt-4'>
            {scoreBreakdown && !showReviewDetails && (
              <div className='grid gap-4 md:grid-cols-3'>
                <div className='rounded-xl border border-border bg-muted/40 p-4'>
                  <div className='text-sm font-medium text-muted-foreground'>
                    Total Score
                  </div>
                  <div className='text-2xl font-bold'>
                    {scoreBreakdown.totalScore}
                  </div>
                </div>
                <div className='rounded-xl border border-border bg-muted/40 p-4'>
                  <div className='text-sm font-medium text-muted-foreground'>
                    Implementation
                  </div>
                  <div className='text-2xl font-bold'>
                    {scoreBreakdown.implementationScore}
                  </div>
                </div>
                <div className='rounded-xl border border-border bg-muted/40 p-4'>
                  <div className='text-sm font-medium text-muted-foreground'>
                    Code Review
                  </div>
                  <div className='text-2xl font-bold'>
                    {scoreBreakdown.codeReviewScore}
                  </div>
                </div>
              </div>
            )}

            {(showReviewDetails || !scoreBreakdown) && (
              <div className='space-y-4 animate-in fade-in slide-in-from-top-2 duration-300'>
                <h3 className='text-sm font-semibold'>Received Tests</h3>
                {!hasPeerReviewTests && (
                  <p className='text-sm text-muted-foreground'>
                    No peer review tests were submitted for your solution.
                  </p>
                )}
                {hasPeerReviewTests &&
                  peerReviewTests.map((review) => {
                    const reviewerName =
                      review.reviewer?.username || 'Anonymous';
                    const tests = Array.isArray(review.tests)
                      ? review.tests
                      : [];
                    if (tests.length === 0) return null;
                    return (
                      <div
                        key={`review-${review.id}`}
                        className='rounded-xl border border-border bg-muted/40 p-4 space-y-3'
                      >
                        <p className='text-sm font-semibold'>
                          Reviewer: {reviewerName}
                        </p>
                        <div className='space-y-3'>
                          {tests.map((test) => {
                            const testKey = JSON.stringify({
                              input: test.input,
                              expectedOutput: test.expectedOutput,
                              notes: test.notes,
                            });
                            return (
                              <div
                                key={testKey}
                                className='rounded-lg border border-border bg-background p-3 text-xs space-y-2'
                              >
                                <p>
                                  <span className='font-semibold'>Input:</span>{' '}
                                  {renderValue(test.input)}
                                </p>
                                <p>
                                  <span className='font-semibold'>
                                    Expected output:
                                  </span>{' '}
                                  {renderValue(test.expectedOutput)}
                                </p>
                                {test.notes && (
                                  <p>
                                    <span className='font-semibold'>
                                      Notes:
                                    </span>{' '}
                                    {test.notes}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isFullyEnded && (
        <Card>
          <CardHeader>
            <CardTitle>Other participant solutions</CardTitle>
            <CardDescription>
              Explore how classmates solved the same problem.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {otherSubmissions.length === 0 && (
              <p className='text-sm text-muted-foreground'>
                No other submissions available.
              </p>
            )}
            {otherSubmissions.map((submission) => {
              const authorName = submission.student?.username || 'Student';
              return (
                <div
                  key={`submission-${submission.id}`}
                  className='rounded-xl border border-border bg-muted/40 p-4 space-y-2'
                >
                  <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                    <p className='text-sm font-semibold'>{authorName}</p>
                    {submission.createdAt && (
                      <p className='text-xs text-muted-foreground'>
                        {formatDateTime(submission.createdAt)}
                      </p>
                    )}
                  </div>
                  <pre className='max-h-[240px] w-full overflow-auto rounded-lg border border-border bg-background p-4 text-xs'>
                    {submission.code || ''}
                  </pre>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Button
        variant='outline'
        onClick={() => router.push('/student/challenges')}
      >
        Back to challenges
      </Button>
    </div>
  );
}
