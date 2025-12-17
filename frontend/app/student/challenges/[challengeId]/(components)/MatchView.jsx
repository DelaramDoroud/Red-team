'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '#components/common/card';
import { Button } from '#components/common/Button';
import {
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableHead,
} from '#components/common/Table';

import Tooltip from '#components/common/Tooltip';
import Spinner from '#components/common/Spinner';

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import CppEditor from './CppEditor';
import Timer from './Timer';
import { useDuration } from '../(context)/DurationContext';

export default function MatchView({
  loading,
  error,
  message,
  challengeId,
  matchData,
  code,
  setCode,
  isRunning,
  isSubmitting,
  isSubmittingActive,
  runResult,
  onRun,
  onSubmit,
  onTimerFinish,
  isChallengeFinished,
  testResults,
  canSubmit,
  isTimeUp,
  isCompiled,
}) {
  const { duration, startPhaseOneDateTime, startDatetime } = useDuration();

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
              {error.message}
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
            <h3 className='font-semibold mb-2'>Your submitted code:</h3>
            <pre className='bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-sm'>
              {code}
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
        </Card>
      </div>
    );
  }

  const { problemTitle, problemDescription, publicTests = [] } = matchData;

  return (
    <div className='max-w-7xl h-full my-2 relative'>
      {isSubmittingFinal && (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/40'>
          <Spinner label='Submitting your code...' />
        </div>
      )}

      <div className='flex justify-end text-lg font-bold'>
        <Timer
          duration={duration}
          challengeId={challengeId}
          startTime={startPhaseOneDateTime || startDatetime}
          onFinish={timerFinishHandler}
        />
      </div>
      <div className='my-2 flex justify-normal gap-x-2 '>
        <div className='space-y-2 w-1/3'>
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

        <div className='space-y-6 w-2/3'>
          {/* editor + controls + result panel */}
          <Card>
            <CardHeader>
              <CardTitle>Code editor</CardTitle>
              <CardDescription>Language: C++</CardDescription>
            </CardHeader>

            <CardContent className='space-y-4'>
              <CppEditor
                value={code}
                onChange={setCode}
                disabled={isSubmittingFinal}
              />

              <div className='mt-2'>
                <h2 className='text-sm font-medium mb-1'>Result</h2>
                <div
                  className={`min-h-[90px] rounded-md border bg-muted px-3 py-2 text-xs ${runResultClass}`}
                >
                  {runResult?.message ??
                    'Run your code to see compilation and test results.'}
                </div>
              </div>

              <div className='flex gap-3'>
                <Button onClick={onRun} disabled={isRunning || isTimeUp}>
                  {isRunning && <Loader2 className='h-4 w-4 animate-spin' />}
                  {isRunning ? 'Running...' : 'Run'}
                </Button>

                {canSubmitNow ? (
                  <button
                    type='button'
                    onClick={onSubmit}
                    disabled={isBusy}
                    className='px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-400 flex items-center gap-2'
                  >
                    {isSubmitting && <Spinner label='Submitting…' />}
                    {!isSubmitting && 'Submit'}
                  </button>
                ) : (
                  <Tooltip
                    text='You cannot submit yet. Run your code first.'
                    position='top'
                  >
                    <button
                      type='button'
                      disabled
                      className='px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-400'
                    >
                      Submit
                    </button>
                  </Tooltip>
                )}
              </div>

              {error && (
                <p className='text-sm text-red-500 dark:text-red-400'>
                  {error.message}
                </p>
              )}

              {message && (
                <p className='text-sm text-green-600 dark:text-green-400'>
                  {message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
