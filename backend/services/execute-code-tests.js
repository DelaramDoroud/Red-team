import { enqueueCodeExecution, getJobStatus } from './code-execution-queue.js';
import { wrapCode, hasWrapper } from './wrappers/index.js';

const POLL_INTERVAL_MS = 500; // Poll every 500ms
const MAX_POLL_TIME_MS = 30000; // Maximum 30 seconds per test case
const MAX_POLL_ATTEMPTS = Math.ceil(MAX_POLL_TIME_MS / POLL_INTERVAL_MS);

/**
 * Executes code against multiple test cases using the job queue system.
 * Enqueues jobs for each test case, polls for results, and aggregates them.
 *
 * @param {Object} params - Execution parameters
 * @param {string} params.code - User's code to execute
 * @param {string} params.language - Programming language (cpp, python, etc.)
 * @param {Array<Object>} params.testCases - Array of test cases with `input` and `output` properties
 * @param {number|null} params.userId - Optional user ID for tracking
 * @returns {Promise<Object>} Aggregated execution results
 */
export async function executeCodeTests({
  code,
  language,
  testCases,
  userId = null,
}) {
  if (
    !code ||
    !language ||
    !Array.isArray(testCases) ||
    testCases.length === 0
  ) {
    throw new Error(
      'Invalid parameters: code, language, and non-empty testCases array are required'
    );
  }

  // Wrap code if a wrapper exists for this language
  let wrappedCode = code;
  try {
    if (hasWrapper(language)) {
      wrappedCode = wrapCode(language, code);
    }
  } catch (error) {
    // If wrapping fails, use original code
    // Some languages might not have wrappers
    console.warn(
      `[EXECUTE CODE TESTS] Wrapper not available for ${language}, using original code`
    );
  }

  // Enqueue all test cases
  const jobPromises = testCases.map(async (testCase, index) => {
    const testInput =
      typeof testCase.input === 'string'
        ? testCase.input
        : JSON.stringify(testCase.input);

    const { id: jobId } = await enqueueCodeExecution(
      {
        code: wrappedCode,
        language,
        input: testInput,
        userId,
      },
      {
        priority: 0,
      }
    );

    return { jobId, testCase, index };
  });

  const enqueuedJobs = await Promise.all(jobPromises);

  // Poll for results
  const testResults = await Promise.all(
    enqueuedJobs.map(async ({ jobId, testCase, index }) => {
      let pollAttempts = 0;
      let jobStatus;

      // Poll until job completes or max attempts reached
      while (pollAttempts < MAX_POLL_ATTEMPTS) {
        jobStatus = await getJobStatus(jobId);

        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          break;
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        pollAttempts++;
      }

      // Handle job result
      if (jobStatus.status === 'failed' || jobStatus.status === 'not_found') {
        return {
          testIndex: index,
          passed: false,
          error: jobStatus.error?.message || 'Job execution failed',
          exitCode: -1,
          stdout: '',
          stderr: jobStatus.error?.message || 'Execution failed',
          expectedOutput: testCase.output,
          actualOutput: null,
        };
      }

      if (jobStatus.status !== 'completed') {
        return {
          testIndex: index,
          passed: false,
          error: 'Job execution timeout',
          exitCode: -1,
          stdout: '',
          stderr: 'Execution timeout',
          expectedOutput: testCase.output,
          actualOutput: null,
        };
      }

      const result = jobStatus.result;
      if (!result) {
        return {
          testIndex: index,
          passed: false,
          error: 'No result returned from job',
          exitCode: -1,
          stdout: '',
          stderr: 'No result returned',
          expectedOutput: testCase.output,
          actualOutput: null,
        };
      }

      // Normalize outputs for comparison
      const actualOutput = normalizeOutput(result.stdout);
      const expectedOutput = normalizeOutput(testCase.output);

      // Check if test passed
      const passed =
        result.exitCode === 0 && compareOutputs(actualOutput, expectedOutput);

      return {
        testIndex: index,
        passed,
        exitCode: result.exitCode || 0,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        expectedOutput: testCase.output,
        actualOutput: result.stdout || '',
        executionTime: result.executionTime || 0,
      };
    })
  );

  // Calculate summary
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;
  const allPassed = passed === total;

  // Check compilation status (if any test has exitCode !== 0 or stderr contains "error", compilation likely failed)
  const hasCompilationError = testResults.some(
    (r) =>
      r.exitCode !== 0 || (r.stderr && r.stderr.toLowerCase().includes('error'))
  );
  const isCompiled = !hasCompilationError;

  // Collect errors
  const errors = testResults
    .filter((r) => r.error || (!r.passed && r.exitCode !== 0))
    .map((r) => ({
      testIndex: r.testIndex,
      error: r.error || r.stderr || 'Test failed',
      exitCode: r.exitCode,
    }));

  return {
    testResults,
    summary: {
      total,
      passed,
      failed,
      allPassed,
    },
    isCompiled,
    isPassed: allPassed && isCompiled,
    errors,
  };
}

/**
 * Normalizes output for comparison (handles JSON strings, arrays, primitives)
 */
function normalizeOutput(output) {
  if (output === null || output === undefined) {
    return null;
  }

  if (typeof output === 'string') {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(output.trim());
      return parsed;
    } catch {
      // Not JSON, return trimmed string
      return output.trim();
    }
  }

  return output;
}

/**
 * Compares actual and expected outputs
 */
function compareOutputs(actual, expected) {
  // Handle null/undefined
  if (actual === null || actual === undefined) {
    return expected === null || expected === undefined;
  }

  // Deep equality check for objects/arrays
  if (typeof actual === 'object' && typeof expected === 'object') {
    try {
      return JSON.stringify(actual) === JSON.stringify(expected);
    } catch {
      return false;
    }
  }

  // String comparison (case-sensitive)
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual === expected;
  }

  // Primitive comparison
  return actual === expected;
}
