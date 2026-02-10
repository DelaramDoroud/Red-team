import { Loader2 } from 'lucide-react';
import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import Spinner from '#components/common/Spinner';
import Tooltip from '#components/common/Tooltip';

export default function MatchViewEditorCard({
  CppEditor,
  actionButtonSize,
  canClean,
  canRestore,
  canSubmitNow,
  editorDisabled,
  error,
  fixedPrefix,
  fixedSuffix,
  imports,
  importsInputClassName,
  importsWarning,
  isBusy,
  isChallengeFinished,
  isRunning,
  isSubmitting,
  isTimeUp,
  message,
  onClean,
  onImportsBlur,
  onImportsChange,
  onRestore,
  onRun,
  onStudentCodeChange,
  onSubmit,
  onTryAgain,
  runResult,
  runResultClass,
  saveIndicator,
  showImportsWarning,
  studentCode,
  submitTitle,
  tryAgainTitle,
}) {
  const messageToneClass = (() => {
    if (!message) return 'text-blue-600 dark:text-blue-400';
    if (message.includes('Thanks for your submission')) {
      if (message.includes('problems') || message.includes('edge cases')) {
        return 'text-yellow-600 dark:text-yellow-400';
      }
      return 'text-green-600 dark:text-green-400';
    }
    return 'text-blue-600 dark:text-blue-400';
  })();

  return (
    <div className='space-y-6 w-full lg:w-2/3'>
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle>Code editor</CardTitle>
              <CardDescription>Language: C++</CardDescription>
            </div>
            {saveIndicator ? (
              <div role='status' aria-live='polite'>
                {saveIndicator}
              </div>
            ) : null}
          </div>
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
              {showImportsWarning ? (
                <p className='text-xs text-amber-600 mt-1' role='alert'>
                  {importsWarning}
                </p>
              ) : null}
            </div>

            {fixedPrefix?.trim() ? (
              <div>
                <pre className='rounded-md border bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap'>
                  {fixedPrefix}
                </pre>
              </div>
            ) : null}

            <div>
              <h2 className='text-sm font-medium mb-1'>Your solution</h2>
              <CppEditor
                value={studentCode || ''}
                onChange={onStudentCodeChange}
                disabled={editorDisabled}
                height='35vh'
              />
            </div>

            {fixedSuffix?.trim() ? (
              <div>
                <pre className='rounded-md border bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap'>
                  {fixedSuffix}
                </pre>
              </div>
            ) : null}
          </div>

          <div className='mt-2'>
            <h2 className='text-sm font-medium mb-1'>Result</h2>
            <div
              className={`min-h-[90px] rounded-md border bg-muted px-3 py-2 text-xs ${runResultClass}`}
            >
              {runResult?.message ||
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
              {isRunning ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
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
                {isSubmitting ? <Spinner label='Submitting…' /> : null}
                {!isSubmitting ? 'Submit' : null}
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

          {error ? (
            <p className='text-sm text-red-500 dark:text-red-400'>
              {error?.message ||
                (typeof error === 'string' ? error : 'An error occurred')}
            </p>
          ) : null}

          {message ? (
            <div className='space-y-2'>
              <p className={`text-sm ${messageToneClass}`}>{message}</p>
              {onTryAgain && !isChallengeFinished ? (
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
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
