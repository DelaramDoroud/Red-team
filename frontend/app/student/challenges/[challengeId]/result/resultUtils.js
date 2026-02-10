export const normalizeMultilineValue = (value) =>
  typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;

export const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return normalizeMultilineValue(value);
  try {
    return normalizeMultilineValue(JSON.stringify(value));
  } catch {
    return normalizeMultilineValue(String(value));
  }
};

export const buildResultBadge = (count, tone) => {
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

export const getResultCardClasses = (passed) => {
  if (passed) {
    return 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/40 dark:bg-emerald-500/10';
  }
  return 'border-rose-200 bg-rose-50/70 dark:border-rose-400/40 dark:bg-rose-500/10';
};

export const getResultStatusClasses = (passed) => {
  if (passed) {
    return 'text-emerald-700 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-500/15';
  }
  return 'text-rose-700 bg-rose-100 dark:text-rose-200 dark:bg-rose-500/15';
};

export const getTestFailureDetails = (result) => {
  if (!result || result.passed) return null;
  if (result.error) return result.error;
  if (result.stderr) return result.stderr;
  if (typeof result.exitCode === 'number' && result.exitCode !== 0) {
    return `Execution failed with exit code ${result.exitCode}.`;
  }
  return 'Output did not match the expected result.';
};

export const buildTestKey = (result) => {
  if (Number.isInteger(result?.testIndex)) return `private-${result.testIndex}`;
  return JSON.stringify({
    expectedOutput: result?.expectedOutput,
    actualOutput: result?.actualOutput,
    passed: result?.passed,
  });
};
