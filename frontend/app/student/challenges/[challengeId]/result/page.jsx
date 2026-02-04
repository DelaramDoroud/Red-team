'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { setSolutionFeedbackVisibility } from '#js/store/slices/ui';
import { markBadgeSeen } from '#js/store/slices/auth';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import { ChallengeStatus } from '#js/constants';
import { formatDateTime } from '#js/date';
import SnakeGame from '#components/common/SnakeGame';
import SubmissionScoreCard from '#components/challenge/SubmissionScoreCard';
import BadgeModal from '#components/badge/BadgeModal';
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

const buildResultBadge = (count, tone) => {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold';
  if (tone === 'success') {
    return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200`;
  }
  if (tone === 'danger') {
    return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200`;
  }
  return `${base} bg-muted text-muted-foreground`;
};

const getResultCardClasses = (passed) =>
  passed
    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/40 dark:bg-emerald-500/10'
    : 'border-rose-200 bg-rose-50/70 dark:border-rose-400/40 dark:bg-rose-500/10';

const getResultStatusClasses = (passed) =>
  passed
    ? 'text-emerald-700 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-500/15'
    : 'text-rose-700 bg-rose-100 dark:text-rose-200 dark:bg-rose-500/15';

const getTestFailureDetails = (result) => {
  if (!result || result.passed) return null;
  if (result.error) return result.error;
  if (result.stderr) return result.stderr;
  if (typeof result.exitCode === 'number' && result.exitCode !== 0) {
    return `Execution failed with exit code ${result.exitCode}.`;
  }
  return 'Output did not match the expected result.';
};

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
  const dispatch = useAppDispatch();
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
  const solutionFeedbackVisibility = useAppSelector(
    (state) => state.ui.solutionFeedbackVisibility
  );
  const badgeSeen = useAppSelector((state) => state.auth.badgeSeen);

  const studentId = user?.id;
  const challengeId = params?.challengeId;
  const solutionFeedbackKey = challengeId ? String(challengeId) : null;
  const isSolutionFeedbackOpen = Boolean(
    studentId &&
    solutionFeedbackKey &&
    solutionFeedbackVisibility?.[studentId]?.[solutionFeedbackKey]
  );

  const { getChallengeResults } = useChallenge();
  const redirectOnError = useApiErrorRedirect();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [finalization, setFinalization] = useState(null);
  const [isFinalizationPending, setIsFinalizationPending] = useState(false);
  const [awaitingChallengeEnd, setAwaitingChallengeEnd] = useState(false);
  const [badgeQueue, setBadgeQueue] = useState([]);
  const [activeBadge, setActiveBadge] = useState(null);
  const [showBadge, setShowBadge] = useState(false);

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
      setResultData(payload);

      if (payload?.badges?.newlyUnlocked?.length > 0) {
        const unseenBadges = payload.badges.newlyUnlocked.filter(
          (badge) => !badgeSeen?.[studentId]?.[badge.id]
        );
        if (
          unseenBadges.length > 0 &&
          badgeQueue.length === 0 &&
          !activeBadge
        ) {
          setBadgeQueue(unseenBadges);
          setActiveBadge(unseenBadges[0]);
          setShowBadge(true);
        }
      }

      const finalizationInfo = payload?.finalization || null;
      const isScoringCompleted =
        payload?.challenge?.scoringStatus === 'completed';
      const resultsReady =
        finalizationInfo?.resultsReady !== false || isScoringCompleted;

      setFinalization(finalizationInfo);
      setIsFinalizationPending(!resultsReady);
    } catch (e) {
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
    badgeQueue,
    activeBadge,
    badgeSeen,
  ]);

  const handleBadgeClose = () => {
    if (activeBadge && studentId) {
      dispatch(markBadgeSeen({ studentId, badgeId: activeBadge.id }));
    }
    setBadgeQueue((prevQueue) => {
      const [, ...rest] = prevQueue;
      if (rest.length > 0) setActiveBadge(rest[0]);
      else {
        setActiveBadge(null);
        setShowBadge(false);
      }
      return rest;
    });
  };

  useEffect(() => {
    if (!canLoadResults || !challengeId || !studentId || !isLoggedIn)
      return undefined;
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await loadResults();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [canLoadResults, challengeId, studentId, isLoggedIn, loadResults]);

  useEffect(() => {
    if (!isFinalizationPending || !canLoadResults) return undefined;
    const timeoutId = setTimeout(() => {
      loadResults();
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [canLoadResults, isFinalizationPending, loadResults]);

  if (authLoading)
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading your profile...
          </CardContent>
        </Card>
      </div>
    );
  if (!isLoggedIn || !studentId) return null;
  if (durationContext && !hasChallengeStatus && loading)
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading challenge status...
          </CardContent>
        </Card>
      </div>
    );

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

  if (loading)
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            Loading results...
          </CardContent>
        </Card>
      </div>
    );
  if (error)
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
  if (!resultData)
    return (
      <div className='max-w-4xl mx-auto px-4 py-10'>
        <Card>
          <CardContent className='py-8 text-sm text-muted-foreground'>
            No results available yet.
          </CardContent>
        </Card>
      </div>
    );

  const { challenge, matchSetting, scoreBreakdown } = resultData;
  const phaseTwoEndTimestamp = challenge?.endPhaseTwoDateTime
    ? new Date(challenge.endPhaseTwoDateTime).getTime()
    : null;
  const hasPhaseTwoEnded =
    phaseTwoEndTimestamp !== null ? phaseTwoEndTimestamp <= Date.now() : false;
  const isFullyEnded =
    challenge?.status === ChallengeStatus.ENDED_PHASE_TWO && hasPhaseTwoEnded;

  const studentSubmission = resultData?.studentSubmission || null;
  const publicResults = Array.isArray(studentSubmission?.publicTestResults)
    ? studentSubmission.publicTestResults
    : [];
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
  const feedbackSectionId = solutionFeedbackKey
    ? `solution-feedback-${solutionFeedbackKey}`
    : 'solution-feedback';
  const totalPublic = publicResults.length;
  const totalPrivate = privateResults.length;
  const passedPublic = publicResults.filter((result) => result.passed).length;
  const passedPrivate = privateResults.filter((result) => result.passed).length;
  const failedPublic = totalPublic - passedPublic;
  const failedPrivate = totalPrivate - passedPrivate;

  const handleToggleSolutionFeedback = () => {
    if (!studentId || !solutionFeedbackKey) return;
    dispatch(
      setSolutionFeedbackVisibility({
        userId: studentId,
        challengeId: solutionFeedbackKey,
        value: !isSolutionFeedbackOpen,
      })
    );
  };

  return (
    <div className='max-w-6xl mx-auto px-4 py-8 space-y-6'>
      {/* 1. HEADER CARD */}
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

      {/* 2. PURPLE SCORE CARD */}
      {scoreBreakdown && <SubmissionScoreCard scoreData={scoreBreakdown} />}

      {/* 3. NAVIGATION ACTIONS (SUBTASK RT-218) */}
      <div className='flex flex-col sm:flex-row gap-4'>
        {/* A. Toggle Solution Button (Uses Redux = Persistent state) */}
        <Button
          onClick={handleToggleSolutionFeedback}
          aria-expanded={isSolutionFeedbackOpen}
          aria-controls={feedbackSectionId}
          className='flex-1'
        >
          {isSolutionFeedbackOpen
            ? 'Hide Your Solution & Feedback'
            : 'View Your Solution & Feedback'}
        </Button>

        {/* B. Navigate to Votes Button (Goes to the dedicated page) */}
        <Button
          variant='secondary'
          onClick={() =>
            router.push(`/student/challenges/${challengeId}/peer-reviews`)
          }
          className='flex-1'
        >
          View Your Code Review Votes
        </Button>
      </div>

      {/* 4. SOLUTION SECTION (Visible only if open) */}
      {isSolutionFeedbackOpen && (
        <Card
          id={feedbackSectionId}
          className='animate-in fade-in slide-in-from-top-4 duration-300'
        >
          <CardHeader>
            <CardTitle>Your submission details</CardTitle>
            <CardDescription>Code and automated test results.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!studentSubmission && (
              <p className='text-sm text-muted-foreground'>
                You did not submit a solution for this challenge.
              </p>
            )}
            {studentSubmission && (
              <>
                <div className='space-y-4'>
                  <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-foreground'>
                      <span className='inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary'>
                        {'</>'}
                      </span>
                      Your Solution
                    </div>
                    <div className='text-xs font-semibold text-muted-foreground'>
                      Submitted at {formatDateTime(studentSubmission.createdAt)}
                    </div>
                  </div>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <p className='text-sm font-semibold text-foreground'>
                        Code
                      </p>
                      {matchSetting?.language && (
                        <span className='inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary'>
                          {matchSetting.language.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <pre className='w-full overflow-auto rounded-xl border border-slate-900/80 bg-slate-900 p-4 text-sm text-slate-100 shadow-inner whitespace-pre-wrap dark:border-slate-700 dark:bg-slate-950'>
                      {normalizeMultilineValue(studentSubmission.code || '')}
                    </pre>
                  </div>
                </div>

                {/* Public Results */}
                <div>
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <p className='text-sm font-semibold text-foreground'>
                      Public test results
                    </p>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span
                        className={buildResultBadge(passedPublic, 'success')}
                      >
                        {passedPublic} Passed
                      </span>
                      <span
                        className={buildResultBadge(failedPublic, 'danger')}
                      >
                        {failedPublic} Failed
                      </span>
                    </div>
                  </div>
                  {publicResults.map((result, index) => {
                    const displayIndex = Number.isInteger(result.testIndex)
                      ? result.testIndex + 1
                      : index + 1;
                    const failureDetails = getTestFailureDetails(result);
                    return (
                      <div
                        key={buildTestKey(result)}
                        className={`rounded-xl border p-4 ${getResultCardClasses(result.passed)} mt-3`}
                      >
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <p className='text-sm font-semibold text-foreground'>
                            Test {displayIndex}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getResultStatusClasses(result.passed)}`}
                          >
                            {result.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className='mt-3 rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground space-y-1 dark:bg-slate-950/40'>
                          <p>
                            <span className='font-semibold'>Expected:</span>{' '}
                            {renderValue(result.expectedOutput)}
                          </p>
                          <p>
                            <span className='font-semibold'>Actual:</span>{' '}
                            {renderValue(result.actualOutput)}
                          </p>
                          {failureDetails && (
                            <p className='text-rose-700 dark:text-rose-200'>
                              <span className='font-semibold'>Feedback:</span>{' '}
                              {renderValue(failureDetails)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Private Results */}
                <div>
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <p className='text-sm font-semibold text-foreground'>
                      Private test results
                    </p>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span
                        className={buildResultBadge(passedPrivate, 'success')}
                      >
                        {passedPrivate} Passed
                      </span>
                      <span
                        className={buildResultBadge(failedPrivate, 'danger')}
                      >
                        {failedPrivate} Failed
                      </span>
                    </div>
                  </div>
                  {privateResults.map((result, index) => {
                    const displayIndex = Number.isInteger(result.testIndex)
                      ? result.testIndex + 1
                      : index + 1;
                    const failureDetails = getTestFailureDetails(result);
                    return (
                      <div
                        key={buildTestKey(result)}
                        className={`rounded-xl border p-4 ${getResultCardClasses(result.passed)} mt-3`}
                      >
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <p className='text-sm font-semibold text-foreground'>
                            Test {displayIndex}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getResultStatusClasses(result.passed)}`}
                          >
                            {result.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className='mt-3 rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground space-y-1 dark:bg-slate-950/40'>
                          <p>
                            <span className='font-semibold'>Expected:</span>{' '}
                            {renderValue(result.expectedOutput)}
                          </p>
                          <p>
                            <span className='font-semibold'>Actual:</span>{' '}
                            {renderValue(result.actualOutput)}
                          </p>
                          {failureDetails && (
                            <p className='text-rose-700 dark:text-rose-200'>
                              <span className='font-semibold'>Feedback:</span>{' '}
                              {renderValue(failureDetails)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* --- PEER REVIEW RECEIVED TESTS (VISIBLE) --- */}
      {isFullyEnded && hasPeerReviewTests && (
        <Card>
          <CardHeader>
            <CardTitle>Received Peer Tests</CardTitle>
            <CardDescription>
              Test cases created by other students that your code was evaluated
              against.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {peerReviewTests.map((review) => {
                const tests = review.tests || [];
                if (tests.length === 0) return null;
                return (
                  <div
                    key={`review-${review.id}`}
                    className='rounded-xl border border-border bg-muted/40 p-4 space-y-3'
                  >
                    <p className='text-sm font-semibold'>
                      Reviewer: {review.reviewer?.username || 'Anonymous'}
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
                              <span className='font-semibold'>Expected:</span>{' '}
                              {renderValue(test.expectedOutput)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
            {otherSubmissions.map((submission) => (
              <div
                key={`submission-${submission.id}`}
                className='rounded-xl border border-border bg-muted/40 p-4 space-y-2'
              >
                <p className='text-sm font-semibold'>
                  {submission.student?.username || 'Student'}
                </p>
                <pre className='max-h-[240px] w-full overflow-auto rounded-lg border border-border bg-background p-4 text-xs'>
                  {submission.code || ''}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button
        variant='outline'
        onClick={() => router.push('/student/challenges')}
      >
        Back to challenges
      </Button>
      {showBadge && (
        <BadgeModal badge={activeBadge} onClose={handleBadgeClose} />
      )}
    </div>
  );
}
