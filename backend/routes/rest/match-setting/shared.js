import { Op } from 'sequelize';
import MatchSetting from '#root/models/match-setting.js';
import { validateImportsBlock } from '#root/services/import-validation.js';

export const hasOwn = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const normalizeText = (value) =>
  typeof value === 'string' ? value : '';

export const normalizeTests = (value) => (Array.isArray(value) ? value : []);

const MAX_EXECUTION_ERROR_MESSAGE_LENGTH = 220;
const CPP_UNQUALIFIED_STL_SYMBOL_REGEX =
  /\b(string|vector|unordered_map|map|set|queue|stack|deque|list|pair|cin|cout|cerr|clog|getline)\b/i;
const CPP_NOT_DECLARED_REGEX = /was not declared in this scope/i;

export const isBlank = (value) =>
  typeof value !== 'string' || value.trim().length === 0;

const hasTestCases = (tests) => Array.isArray(tests) && tests.length > 0;

const hasValidTestCases = (tests) =>
  Array.isArray(tests) &&
  tests.length > 0 &&
  tests.every(
    (testCase) =>
      testCase && hasOwn(testCase, 'input') && hasOwn(testCase, 'output')
  );

const sanitizeExecutionMessage = (value) => {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  if (normalized.length <= MAX_EXECUTION_ERROR_MESSAGE_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_EXECUTION_ERROR_MESSAGE_LENGTH - 3)}...`;
};

const getExecutionFailureDetail = (executionResult) => {
  if (!executionResult || typeof executionResult !== 'object') return null;

  const { errors, testResults } = executionResult;

  if (Array.isArray(errors)) {
    for (const entry of errors) {
      const detail = sanitizeExecutionMessage(entry?.error);
      if (detail) return detail;
    }
  }

  if (Array.isArray(testResults)) {
    for (const testResult of testResults) {
      const stderrDetail = sanitizeExecutionMessage(testResult?.stderr);
      if (stderrDetail) return stderrDetail;

      const errorDetail = sanitizeExecutionMessage(testResult?.error);
      if (errorDetail) return errorDetail;
    }
  }

  return null;
};

const buildCppNamespaceHint = (detail) => {
  if (typeof detail !== 'string' || !detail.trim()) return null;
  if (!CPP_NOT_DECLARED_REGEX.test(detail)) return null;
  if (!CPP_UNQUALIFIED_STL_SYMBOL_REGEX.test(detail)) return null;

  return 'Hint: add "using namespace std;" in fixed prefix, or use std:: for STL symbols.';
};

export const buildPublishFailureMessage = ({
  visibilityLabel,
  executionResult,
  language,
}) => {
  const baseMessage = `Reference solution failed ${visibilityLabel} tests. Fix it before publishing.`;
  const detail = getExecutionFailureDetail(executionResult);
  if (!detail) return baseMessage;

  let message = `${baseMessage} Details: ${detail}`;
  if (language?.toLowerCase() === 'cpp') {
    const cppHint = buildCppNamespaceHint(detail);
    if (cppHint) {
      message = `${message} ${cppHint}`;
    }
  }
  return message;
};

export const buildDuplicateTitle = async (title) => {
  const baseTitle = title || 'Untitled match setting';
  const escaped = baseTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `${baseTitle} (Copy`;
  const candidates = await MatchSetting.findAll({
    attributes: ['problemTitle'],
    where: {
      problemTitle: {
        [Op.iLike]: `${pattern}%`,
      },
    },
  });

  const regex = new RegExp(`^${escaped} \\(Copy(?: (\\d+))?\\)$`, 'i');
  const existing = new Set(
    candidates
      .map((row) => row.problemTitle)
      .filter((value) => typeof value === 'string')
  );

  const baseCopy = `${baseTitle} (Copy)`;
  if (!existing.has(baseCopy)) return baseCopy;

  let maxSuffix = 1;
  existing.forEach((value) => {
    const match = value.match(regex);
    if (!match) return;
    const suffix = match[1] ? Number.parseInt(match[1], 10) : 1;
    if (Number.isFinite(suffix) && suffix > maxSuffix) {
      maxSuffix = suffix;
    }
  });

  return `${baseTitle} (Copy ${maxSuffix + 1})`;
};

const buildReferenceSolutionError = (referenceSolution, language) => {
  if (isBlank(referenceSolution)) {
    return 'Reference solution is required to publish.';
  }
  const importError = validateImportsBlock(referenceSolution, language);
  if (importError) return importError;
  return null;
};

export const validatePublishRequirements = (matchSetting) => {
  if (!matchSetting) return 'Match setting not found.';
  if (isBlank(matchSetting.problemTitle)) {
    return 'Problem title is required to publish.';
  }
  if (isBlank(matchSetting.problemDescription)) {
    return 'Problem description is required to publish.';
  }

  const referenceSolutionError = buildReferenceSolutionError(
    matchSetting.referenceSolution,
    'cpp'
  );
  if (referenceSolutionError) return referenceSolutionError;

  const publicTests = normalizeTests(matchSetting.publicTests);
  const privateTests = normalizeTests(matchSetting.privateTests);
  if (!hasTestCases(publicTests)) {
    return 'At least one public test case is required to publish.';
  }
  if (!hasTestCases(privateTests)) {
    return 'At least one private test case is required to publish.';
  }
  if (!hasValidTestCases(publicTests)) {
    return 'All public test cases must include input and output.';
  }
  if (!hasValidTestCases(privateTests)) {
    return 'All private test cases must include input and output.';
  }

  return null;
};
