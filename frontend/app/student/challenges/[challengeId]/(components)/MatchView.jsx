'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '#components/common/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
} from '#components/common/Table';
import { Button } from '#components/common/Button';

import Tooltip from '#components/common/Tooltip';
import Spinner from '#components/common/Spinner';

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import Timer from '#components/common/Timer';
import CppEditor from './CppEditor';
import { useDuration } from '../(context)/DurationContext';

export default function MatchView({
  loading,
  error,
  message,
  challengeId,
  matchData,
  imports,
  onImportsChange,
  onImportsBlur,
  importsWarning,
  studentCode,
  onStudentCodeChange,
  fixedPrefix,
  fixedSuffix,
  finalCode,
  isRunning,
  isSubmitting,
  isSubmittingActive,
  peerReviewNotice,
  peerReviewPendingMessage,
  runResult,
  onRun,
  onSubmit,
  onTimerFinish,
  isChallengeFinished,
  testResults,
  canSubmit,
  isTimeUp,
  isCompiled,
  onTryAgain,
  onClean,
  onRestore,
  hasRestorableCode,
}) {
  const { duration, startPhaseOneDateTime, startDatetime } = useDuration();

  const getBufferedStart = (value) => {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return null;
    return timestamp + 3000;
  };
  const phaseOneTimerStart = (() => {
    const base = startPhaseOneDateTime || startDatetime;
    return getBufferedStart(base);
  })();

  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);

  const hasTimerFinished = useRef(false);
  const runResultClass = (() => {
    if (runResult?.type === 'error') return 'text-red-700 dark:text-red-400';
    if (runResult?.type === 'success')
      return 'text-green-700 dark:text-green-400';
    if (runResult?.type === 'info') return 'text-blue-700 dark:text-blue-400';
    return 'text-foreground';
  })();
  const isBusy = isRunning || isSubmitting || isSubmittingFinal;
  const canSubmitNow =
    canSubmit && isSubmittingActive && !isSubmittingFinal && !isTimeUp;
  const canClean =
    Boolean(onClean) && !isBusy && !isTimeUp && !isChallengeFinished;
  const canRestore =
    Boolean(onRestore) &&
    hasRestorableCode &&
    !isBusy &&
    !isTimeUp &&
    !isChallengeFinished;
  const editorDisabled = isSubmittingFinal || isTimeUp || isChallengeFinished;
  const showImportsWarning = Boolean(importsWarning);
  let importsInputClassName =
    'w-full min-h-[96px] rounded-md border bg-background p-3 font-mono text-sm leading-relaxed';
  if (showImportsWarning) {
    importsInputClassName += ' border-amber-500';
  }
  const submitTitle = canSubmitNow
    ? 'Submit your solution for evaluation'
    : 'Run your code before submitting';
  const tryAgainTitle = isTimeUp
    ? 'View your submitted code'
    : 'Clear the results to try again';
  const actionButtonSize = 'sm';

  const handleTimerEnd = async () => {
    if (hasTimerFinished.current) return;
    if (!duration || duration <= 0) return;

    hasTimerFinished.current = true;
    setIsSubmittingFinal(true);
    setSubmissionError(null);

    try {
      const result = await onSubmit();

      if (result === false || result?.success === false) {
        setSubmissionError('Your code did not compile successfully.');
      }
    } catch {
      setSubmissionError('Error during final submission.');
    } finally {
      setIsSubmittingFinal(false);
      setFinished(true);
    }
  };

  const timerFinishHandler = onTimerFinish || handleTimerEnd;

  if (loading) {
    return (
      <div className='max-w-2xl mx-auto py-10'>
        <Card>
          <CardContent className='py-10 text-center text-sm text-muted-foreground'>
            Loading your match...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !matchData) {
    return (
      <div className='max-w-2xl mx-auto py-10'>
        <Card>
          <CardHeader>
            <CardTitle>Match unavailable</CardTitle>
            <CardDescription>
              You cannot access this match right now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-red-500 dark:text-red-400'>
              {error?.message ||
                (typeof error === 'string' ? error : 'An error occurred')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className='max-w-2xl mx-auto py-10'>
        <Card>
          <CardContent>
            <p className='text-sm'>
              Something went wrong while loading this match.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (finished) {
    const displayMessage = submissionError
      ? `${submissionError} Thanks for your participation`
      : 'Thanks for your participation';

    return (
      <div
        className='max-w-4xl mx-auto py-10 space-y-4'
        data-testid='challenge-finished'
      >
        <Card>
          <CardHeader>
            <CardTitle>Phase One Complete</CardTitle>
            <CardDescription data-testid='message'>
              {displayMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {peerReviewNotice ? (
              <p className='text-sm font-medium text-amber-700 mb-4'>
                {peerReviewNotice}
              </p>
            ) : null}
            {peerReviewPendingMessage ? (
              <p className='text-sm font-medium text-slate-600 mb-4'>
                {peerReviewPendingMessage}
              </p>
            ) : null}
            <h3 className='font-semibold mb-2'>Your submitted code:</h3>
            <pre className='bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-sm'>
              {finalCode || ''}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isChallengeFinished) {
    return (
      <div className='max-w-2xl mx-auto py-10'>
        <Card>
          <CardHeader>
            <CardTitle>Phase One Complete</CardTitle>
            <CardDescription>
              {message ||
                'Challenge is over. You can no longer submit your solution.'}
            </CardDescription>
          </CardHeader>
          {peerReviewNotice ? (
            <CardContent>
              <p className='text-sm font-medium text-amber-700'>
                {peerReviewNotice}
              </p>
            </CardContent>
          ) : null}
          {peerReviewPendingMessage ? (
            <CardContent>
              <p className='text-sm font-medium text-slate-600'>
                {peerReviewPendingMessage}
              </p>
            </CardContent>
          ) : null}
        </Card>
      </div>
    );
  }

  const { problemTitle, problemDescription, publicTests = [] } = matchData;

  return (
    <div className='max-w-7xl h-full my-2 relative px-3 sm:px-4'>
      {isSubmittingFinal && (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/40'>
          <Spinner label='Submitting your code...' />
        </div>
      )}

      <div className='flex justify-center text-base font-bold sm:justify-end sm:text-lg'>
        <Timer
          duration={duration}
          challengeId={challengeId}
          startTime={phaseOneTimerStart}
          onFinish={timerFinishHandler}
        />
      </div>
      <div className='my-4 flex flex-col gap-4 lg:flex-row lg:gap-6'>
        <div className='space-y-2 w-full lg:w-1/3'>
          {/* problem description */}
          <Card>
            <CardHeader>
              <CardTitle>{problemTitle}</CardTitle>
              <CardDescription>Read carefully before coding.</CardDescription>
            </CardHeader>
            <CardContent>
              <CardTitle>Problem Description:</CardTitle>
              <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                {problemDescription}
              </p>
            </CardContent>
          </Card>

          {/* public tests */}
          <Card>
            <CardHeader>
              <CardTitle>Public tests</CardTitle>
              <CardDescription>
                These are sample cases your C++ solution should handle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publicTests && publicTests.length > 0 ? (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Input</TableHead>
                        <TableHead>Expected Output</TableHead>
                        <TableHead>Your Output</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {publicTests.map((test, index) => {
                        const result = testResults?.[index];
                        const key = JSON.stringify({
                          input: test.input,
                          output: test.output,
                        });
                        const outputClass = (() => {
                          if (!result) return 'text-muted-foreground';
                          return result.passed
                            ? 'text-green-600'
                            : 'text-red-600';
                        })();

                        return (
                          <TableRow key={key}>
                            <TableCell>{JSON.stringify(test.input)}</TableCell>

                            <TableCell>{JSON.stringify(test.output)}</TableCell>

                            <TableCell className={outputClass}>
                              {isCompiled === true &&
                              result?.actualOutput !== undefined ? (
                                <pre className='whitespace-pre-wrap'>
                                  {JSON.stringify(result.actualOutput)}
                                </pre>
                              ) : (
                                <span className='text-muted-foreground italic'>
                                  —
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className='text-sm text-red-500'>
                  No public tests available for this match.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6 w-full lg:w-2/3'>
          {/* editor + controls + result panel */}
          <Card>
            <CardHeader>
              <CardTitle>Code editor</CardTitle>
              <CardDescription>Language: C++</CardDescription>
            </CardHeader>

            <CardContent className='space-y-4'>
              <div className='space-y-4'>
                <div>
                  <h2 className='text-sm font-medium mb-1'>Imports</h2>
                  <textarea
                    className={importsInputClassName}
                    value={imports || ''}
                    onChange={(event) => onImportsChange(event.target.value)}
                    onBlur={onImportsBlur}
                    disabled={editorDisabled}
                    placeholder='#include <iostream>'
                  />
                  <p className='text-xs text-muted-foreground mt-1'>
                    Only <code>#include</code> lines are allowed.
                  </p>
                  {showImportsWarning && (
                    <p className='text-xs text-amber-600 mt-1' role='alert'>
                      {importsWarning}
                    </p>
                  )}
                </div>

                {fixedPrefix?.trim() && (
                  <div>
                    <pre className='rounded-md border bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap'>
                      {fixedPrefix}
                    </pre>
                  </div>
                )}

                <div>
                  <h2 className='text-sm font-medium mb-1'>Your solution</h2>
                  <CppEditor
                    value={studentCode || ''}
                    onChange={onStudentCodeChange}
                    disabled={editorDisabled}
                    height='35vh'
                  />
                </div>

                {fixedSuffix?.trim() && (
                  <div>
                    <pre className='rounded-md border bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap'>
                      {fixedSuffix}
                    </pre>
                  </div>
                )}
              </div>

              <div className='mt-2'>
                <h2 className='text-sm font-medium mb-1'>Result</h2>
                <div
                  className={`min-h-[90px] rounded-md border bg-muted px-3 py-2 text-xs ${runResultClass}`}
                >
                  {runResult?.message ??
                    'Run your code to see compilation and test results.'}
                </div>
              </div>

              <div className='flex flex-wrap gap-3'>
                <Button
                  type='button'
                  onClick={onClean}
                  disabled={!canClean}
                  variant='destructive'
                  size={actionButtonSize}
                  title='Reset the editor to the default template'
                >
                  Clean
                </Button>
                <Button
                  type='button'
                  onClick={onRestore}
                  disabled={!canRestore}
                  variant='outline'
                  size={actionButtonSize}
                  title='Restore your last compiled code'
                >
                  Restore
                </Button>
                <Button
                  type='button'
                  onClick={onRun}
                  disabled={isRunning || isTimeUp}
                  variant='secondary'
                  size={actionButtonSize}
                  title='Compile and run your code against public tests'
                >
                  {isRunning && <Loader2 className='h-4 w-4 animate-spin' />}
                  {isRunning ? 'Running...' : 'Run'}
                </Button>

                {canSubmitNow ? (
                  <Button
                    type='button'
                    onClick={onSubmit}
                    disabled={isBusy}
                    size={actionButtonSize}
                    title={submitTitle}
                  >
                    {isSubmitting && <Spinner label='Submitting…' />}
                    {!isSubmitting && 'Submit'}
                  </Button>
                ) : (
                  <Tooltip
                    text='You cannot submit yet. Run your code first.'
                    position='top'
                  >
                    <Button
                      type='button'
                      disabled
                      size={actionButtonSize}
                      title={submitTitle}
                    >
                      Submit
                    </Button>
                  </Tooltip>
                )}
              </div>

              {error && (
                <p className='text-sm text-red-500 dark:text-red-400'>
                  {error?.message ||
                    (typeof error === 'string' ? error : 'An error occurred')}
                </p>
              )}

              {message && (
                <div className='space-y-2'>
                  <p
                    className={`text-sm ${(() => {
                      if (message.includes('Thanks for your submission')) {
                        if (
                          message.includes('problems') ||
                          message.includes('edge cases')
                        ) {
                          return 'text-yellow-600 dark:text-yellow-400';
                        }
                        return 'text-green-600 dark:text-green-400';
                      }
                      return 'text-blue-600 dark:text-blue-400';
                    })()}`}
                  >
                    {message}
                  </p>
                  {onTryAgain && !isChallengeFinished && (
                    <Button
                      type='button'
                      onClick={onTryAgain}
                      variant='outline'
                      size={actionButtonSize}
                      className='mt-2'
                      title={tryAgainTitle}
                    >
                      {isTimeUp ? 'View code' : 'Try again'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
