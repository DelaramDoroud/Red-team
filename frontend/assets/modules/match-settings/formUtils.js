import { MatchSettingStatus } from '#js/constants';

export const IMPORTS_END_MARKER = '// __CODYMATCH_IMPORTS_END__';
export const PREFIX_END_MARKER = '// __CODYMATCH_PREFIX_END__';
export const SOLUTION_END_MARKER = '// __CODYMATCH_SOLUTION_END__';

export const createTestCaseId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isBlank = (value) =>
  typeof value !== 'string' || value.trim().length === 0;

const formatTestValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
};

export const splitReferenceSolution = (value) => {
  if (!value || typeof value !== 'string') {
    return { imports: '', prefix: '', solution: '', suffix: '' };
  }

  const importsIndex = value.indexOf(IMPORTS_END_MARKER);
  const prefixIndex = value.indexOf(PREFIX_END_MARKER);
  const solutionIndex = value.indexOf(SOLUTION_END_MARKER);

  if (importsIndex !== -1 && prefixIndex !== -1 && solutionIndex !== -1) {
    const imports = value.slice(0, importsIndex).trim();
    const prefix = value
      .slice(importsIndex + IMPORTS_END_MARKER.length, prefixIndex)
      .replace(/^\s*\n?/, '')
      .replace(/\s*$/, '');
    const solution = value
      .slice(prefixIndex + PREFIX_END_MARKER.length, solutionIndex)
      .replace(/^\s*\n?/, '')
      .replace(/\s*$/, '');
    const suffix = value
      .slice(solutionIndex + SOLUTION_END_MARKER.length)
      .replace(/^\s*\n?/, '')
      .replace(/\s*$/, '');

    return {
      imports,
      prefix,
      solution,
      suffix,
    };
  }

  if (importsIndex !== -1) {
    const imports = value.slice(0, importsIndex).trim();
    const rawCode = value.slice(importsIndex + IMPORTS_END_MARKER.length);
    return {
      imports,
      prefix: '',
      solution: rawCode.replace(/^\s*\n?/, ''),
      suffix: '',
    };
  }

  const lines = value.split(/\r?\n/);
  const importLines = [];
  const codeLines = [];
  lines.forEach((line) => {
    if (/^\s*#include\b/.test(line)) {
      importLines.push(line);
    } else {
      codeLines.push(line);
    }
  });

  return {
    imports: importLines.join('\n'),
    prefix: '',
    solution: codeLines.join('\n'),
    suffix: '',
  };
};

export const assembleReferenceSolution = (
  imports,
  prefix,
  solution,
  suffix
) => {
  const trimmedImports = typeof imports === 'string' ? imports.trim() : '';
  const safePrefix = typeof prefix === 'string' ? prefix : '';
  const safeSolution = typeof solution === 'string' ? solution : '';
  const safeSuffix = typeof suffix === 'string' ? suffix : '';

  if (
    !trimmedImports &&
    !safePrefix.trim() &&
    !safeSolution.trim() &&
    !safeSuffix.trim()
  ) {
    return '';
  }

  return [
    trimmedImports,
    IMPORTS_END_MARKER,
    safePrefix,
    PREFIX_END_MARKER,
    safeSolution,
    SOLUTION_END_MARKER,
    safeSuffix,
  ]
    .filter((section, index) => section !== '' || index < 2)
    .join('\n\n');
};

export const mapTestCases = (tests) => {
  if (!Array.isArray(tests)) return [];
  return tests.map((testCase) => ({
    id: createTestCaseId(),
    input: formatTestValue(testCase?.input),
    output: formatTestValue(testCase?.output),
  }));
};

const isEmptyTestCase = (testCase) => {
  const inputValue =
    typeof testCase.input === 'string' ? testCase.input.trim() : '';
  const outputValue =
    typeof testCase.output === 'string' ? testCase.output.trim() : '';
  return !inputValue && !outputValue;
};

export const serializeTestCases = (tests) =>
  tests
    .filter((testCase) => !isEmptyTestCase(testCase))
    .map((testCase) => ({
      input: parseMaybeJson(testCase.input),
      output: parseMaybeJson(testCase.output),
    }));

export const getStatusLabel = (status) => {
  if (status === MatchSettingStatus.READY) return 'Ready for use';
  return 'Draft';
};

export const getStatusVariant = (status) => {
  if (status === MatchSettingStatus.READY) return 'secondary';
  return 'outline';
};
