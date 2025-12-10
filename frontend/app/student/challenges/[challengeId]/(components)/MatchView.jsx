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

import CppEditor from './CppEditor';
import Timer from './Timer';
import { useDuration } from '../(context)/DurationContext';

export default function MatchView({
  loading,
  error,
  message,
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
}) {
  const { duration } = useDuration();

  const isBusy = isRunning || isSubmitting;

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

  if (isChallengeFinished) {
    return (
      <div className='max-w-2xl mx-auto py-10'>
        <Card>
          <CardContent>
            <p className='text-sm'>
              Challenge is over. You can no longer submit your solution.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { problemTitle, problemDescription, publicTests = [] } = matchData;

  return (
    <div className='max-w-7xl h-full my-2'>
      <div className='flex justify-end text-lg font-bold'>
        <Timer duration={duration} onFinish={onTimerFinish} />
      </div>

      <div className='my-2 flex justify-normal gap-x-2'>
        <div className='space-y-2 w-1/3'>
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
                      {publicTests.map((test) => (
                        <TableRow key={JSON.stringify(test)}>
                          <TableCell>{JSON.stringify(test.input)}</TableCell>
                          <TableCell>{JSON.stringify(test.output)}</TableCell>
                          <TableCell>{/* your output */}</TableCell>
                        </TableRow>
                      ))}
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
          <Card>
            <CardHeader>
              <CardTitle>Code editor</CardTitle>
              <CardDescription>Language: C++</CardDescription>
            </CardHeader>

            <CardContent className='space-y-4'>
              <CppEditor value={code} onChange={setCode} />

              <div className='mt-2'>
                <h2 className='text-sm font-medium mb-1'>Result</h2>
                <div className='min-h-[90px] rounded-md border bg-muted px-3 py-2 text-xs'>
                  {runResult ??
                    'Run your code to see compilation and test results.'}
                </div>
              </div>

              <div className='flex gap-3'>
                <Button
                  onClick={onRun}
                  disabled={isBusy}
                  className='flex items-center gap-2'
                >
                  {isRunning && <Spinner label='Running…' />}
                  {!isRunning && 'Run'}
                </Button>

                {isSubmittingActive ? (
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
