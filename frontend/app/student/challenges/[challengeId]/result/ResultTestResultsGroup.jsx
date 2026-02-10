import {
  buildResultBadge,
  buildTestKey,
  formatValue,
  getResultCardClasses,
  getResultStatusClasses,
  getTestFailureDetails,
} from './resultUtils';

const renderValue = (value) => (
  <span className='whitespace-pre-wrap'>{formatValue(value)}</span>
);

export default function ResultTestResultsGroup({ title, results }) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;

  return (
    <div>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm font-semibold text-foreground'>{title}</p>
        <div className='flex flex-wrap items-center gap-2'>
          <span className={buildResultBadge(passed, 'success')}>
            {passed} Passed
          </span>
          <span className={buildResultBadge(failed, 'danger')}>
            {failed} Failed
          </span>
        </div>
      </div>
      {results.map((result, index) => {
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
  );
}
