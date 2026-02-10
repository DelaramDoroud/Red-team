import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { formatDateTime } from '#js/date';
import ResultTestResultsGroup from './ResultTestResultsGroup';
import { normalizeMultilineValue } from './resultUtils';

export default function ResultSolutionFeedbackSection({
  feedbackSectionId,
  studentSubmission,
  matchSetting,
  publicResults,
  privateResults,
}) {
  return (
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
                  <p className='text-sm font-semibold text-foreground'>Code</p>
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

            <ResultTestResultsGroup
              title='Public test results'
              results={publicResults}
            />
            <ResultTestResultsGroup
              title='Private test results'
              results={privateResults}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
