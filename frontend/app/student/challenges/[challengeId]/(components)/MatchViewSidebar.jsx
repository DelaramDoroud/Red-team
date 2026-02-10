import { Button } from '#components/common/Button';
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

export default function MatchViewSidebar({
  actionButtonSize,
  customResultClass,
  customResultMap,
  customRunResult,
  customTests,
  editorDisabled,
  formatCustomOutput,
  isCompiled,
  isCustomRunning,
  matchData,
  onCustomTestAdd,
  onCustomTestChange,
  onCustomTestRemove,
  onRunCustomTests,
  renderDisplayValue,
  testResults,
}) {
  const { problemTitle, problemDescription, publicTests = [] } = matchData;

  return (
    <div className='space-y-2 w-full lg:w-1/3'>
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
                  {publicTests.map((test, index) => {
                    const result = testResults?.[index];
                    const key = JSON.stringify({
                      input: test.input,
                      output: test.output,
                    });
                    const outputClass = (() => {
                      if (!result) return 'text-muted-foreground';
                      return result.passed ? 'text-green-600' : 'text-red-600';
                    })();

                    return (
                      <TableRow key={key}>
                        <TableCell>{renderDisplayValue(test.input)}</TableCell>

                        <TableCell>{renderDisplayValue(test.output)}</TableCell>

                        <TableCell className={outputClass}>
                          {isCompiled === true &&
                          result?.actualOutput !== undefined ? (
                            renderDisplayValue(result.actualOutput)
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

      <Card>
        <CardHeader>
          <CardTitle>Custom tests</CardTitle>
          <CardDescription>
            Add inputs to see how your code behaves beyond public tests.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {customTests?.length ? (
            <div className='space-y-3'>
              {customTests.map((testCase) => {
                const { id, input, expectedOutput } = testCase;
                const inputId = `custom-input-${id}`;
                const expectedId = `custom-expected-${id}`;
                const result = customResultMap.get(id);
                const actualOutput = result?.actualOutput;
                const outputLabel = result
                  ? formatCustomOutput(actualOutput)
                  : '—';
                return (
                  <div
                    key={id}
                    className='rounded-lg border border-border bg-muted/40 p-3 space-y-3'
                  >
                    <div className='grid gap-3 md:grid-cols-2'>
                      <div className='space-y-1'>
                        <label
                          htmlFor={inputId}
                          className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'
                        >
                          Input
                        </label>
                        <textarea
                          id={inputId}
                          className='w-full min-h-[72px] rounded-md border bg-background px-3 py-2 text-xs'
                          value={input}
                          onChange={(event) =>
                            onCustomTestChange(id, 'input', event.target.value)
                          }
                          placeholder='Enter custom input'
                          disabled={editorDisabled}
                        />
                      </div>
                      <div className='space-y-1'>
                        <label
                          htmlFor={expectedId}
                          className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'
                        >
                          Expected output (optional)
                        </label>
                        <textarea
                          id={expectedId}
                          className='w-full min-h-[72px] rounded-md border bg-background px-3 py-2 text-xs'
                          value={expectedOutput}
                          onChange={(event) =>
                            onCustomTestChange(
                              id,
                              'expectedOutput',
                              event.target.value
                            )
                          }
                          placeholder='Enter expected output'
                          disabled={editorDisabled}
                        />
                      </div>
                    </div>
                    <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
                      <span>Actual output: {outputLabel}</span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => onCustomTestRemove(id)}
                        disabled={editorDisabled}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className='text-xs text-muted-foreground'>
              Add a custom test to try extra inputs.
            </p>
          )}

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              size={actionButtonSize}
              onClick={onCustomTestAdd}
              disabled={editorDisabled}
            >
              Add custom test
            </Button>
            <Button
              type='button'
              variant='secondary'
              size={actionButtonSize}
              onClick={onRunCustomTests}
              disabled={editorDisabled || isCustomRunning}
            >
              {isCustomRunning ? 'Running...' : 'Run custom tests'}
            </Button>
          </div>

          <div
            className={`min-h-[64px] rounded-md border bg-muted px-3 py-2 text-xs ${customResultClass}`}
          >
            {customRunResult?.message ||
              'Run your custom tests to see outputs.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
