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
import CppEditor from './CppEditor';
import Timer from './Timer';
import { Loader2 } from 'lucide-react';
import { useDuration } from '../(context)/DurationContext';

export default function MatchView({
  loading,
  error,
  challengeId,
  matchData,
  code,
  setCode,
  isRunning,
  isSubmitting,
  runResult,
  onRun,
  onSubmit,
  onTimerFinish,
  testResults,
  canSubmit,
  isTimeUp,
  isCompiled,
}) {
  const { duration } = useDuration();
  // loading
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

  const { problemTitle, problemDescription, publicTests = [] } = matchData;

  return (
    <div className='max-w-7xl h-full my-2 '>
      <div className='flex justify-end text-lg font-bold'>
        <Timer
          duration={duration}
          challengeId={challengeId}
          onFinish={onTimerFinish}
        />
      </div>
      <div className=' my-2 flex justify-normal gap-x-2 '>
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
                        return (
                          <TableRow key={index}>
                            <TableCell>{JSON.stringify(test.input)}</TableCell>

                            <TableCell>{JSON.stringify(test.output)}</TableCell>

                            <TableCell
                              className={
                                result
                                  ? result.passed
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                  : 'text-muted-foreground'
                              }
                            >
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
            <CardContent className='space-y-4 '>
              <CppEditor value={code} onChange={setCode} />
              <div className='mt-2'>
                <h2 className='text-sm font-medium mb-1'>Result</h2>
                <div
                  className={`min-h-[90px] rounded-md border bg-muted px-3 py-2 text-xs ${
                    runResult?.type === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : runResult?.type === 'success'
                        ? 'text-green-700 dark:text-green-400'
                        : runResult?.type === 'info'
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-foreground'
                  }`}
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
                <Button
                  onClick={onSubmit}
                  disabled={!canSubmit || isRunning || isSubmitting || isTimeUp}
                >
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
