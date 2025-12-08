import { Router } from 'express';
import MatchSetting from '#root/models/match-setting.js';
import { enqueueCodeExecution } from '#root/services/code-execution-queue.js';
import { getJobStatus } from '#root/services/code-execution-queue.js';
import { wrapCode } from '#root/services/wrappers/index.js';

const router = Router();

router.post('/run', async (req, res) => {
  try {
    const { matchSettingId, code, language } = req.body;

    if (!matchSettingId) {
      return res.status(400).json({
        success: false,
        error: { message: 'matchSettingId is required' },
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        error: { message: 'code is required' },
      });
    }

    if (!language) {
      return res.status(400).json({
        success: false,
        error: { message: 'language is required' },
      });
    }

    const matchSetting = await MatchSetting.findByPk(matchSettingId);

    if (!matchSetting) {
      return res.status(404).json({
        success: false,
        error: { message: 'Match setting not found' },
      });
    }

    const publicTests = matchSetting.publicTests;

    if (!Array.isArray(publicTests) || publicTests.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No public tests found for this match setting' },
      });
    }

    const testResults = [];
    const jobPromises = [];

    for (let i = 0; i < publicTests.length; i++) {
      const testCase = publicTests[i];
      const { input, output: expectedOutput } = testCase;

      let wrappedCode;
      let inputString = '';

      try {
        wrappedCode = wrapCode(language, code);
        if (input !== undefined && input !== null) {
          inputString = JSON.stringify(input);
        }
      } catch (error) {
        if (
          error.message.includes('No wrapper registered') ||
          error.message.includes('not yet implemented') ||
          error.message.includes('Unsupported language')
        ) {
          if (input !== undefined && input !== null) {
            if (Array.isArray(input)) {
              inputString = JSON.stringify(input);
            } else {
              inputString = String(input);
            }
          }
          wrappedCode = code;
        } else {
          throw error;
        }
      }

      const job = await enqueueCodeExecution(
        {
          code: wrappedCode,
          language,
          input: inputString,
          userId: req.user?.id,
        },
        {
          priority: 0,
        }
      );
      jobPromises.push({
        jobId: job.id,
        testIndex: i,
        input,
        expectedOutput,
      });
    }

    const maxWaitTime = 30000;
    const pollInterval = 500;

    const jobStatusPromises = jobPromises.map(async (jobInfo) => {
      let jobStatus = null;
      const jobStartTime = Date.now();

      while (Date.now() - jobStartTime < maxWaitTime) {
        jobStatus = await getJobStatus(jobInfo.jobId);

        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      return { jobInfo, jobStatus };
    });

    const jobResults = await Promise.all(jobStatusPromises);

    for (const { jobInfo, jobStatus } of jobResults) {
      if (jobStatus?.status === 'completed') {
        const result = jobStatus.result;
        const actualOutput = result.stdout;

        let parsedOutput;
        try {
          parsedOutput = JSON.parse(actualOutput);
        } catch {
          parsedOutput = actualOutput.trim();
        }

        const passed =
          JSON.stringify(parsedOutput) ===
          JSON.stringify(jobInfo.expectedOutput);

        testResults.push({
          testIndex: jobInfo.testIndex,
          input: jobInfo.input,
          expectedOutput: jobInfo.expectedOutput,
          actualOutput: parsedOutput,
          passed,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTime: result.executionTime,
        });
      } else {
        testResults.push({
          testIndex: jobInfo.testIndex,
          input: jobInfo.input,
          expectedOutput: jobInfo.expectedOutput,
          actualOutput: null,
          passed: false,
          stdout: jobStatus?.result?.stdout || '',
          stderr:
            jobStatus?.result?.stderr ||
            jobStatus?.error?.message ||
            'Execution failed or timed out',
          exitCode: jobStatus?.result?.exitCode || -1,
          executionTime: jobStatus?.result?.executionTime || 0,
        });
      }
    }

    const passedCount = testResults.filter((r) => r.passed).length;
    const totalCount = testResults.length;
    const allPassed = passedCount === totalCount;

    const isCompiled = testResults.some(
      (result) =>
        result.exitCode === 0 ||
        (result.exitCode !== -1 &&
          result.stderr &&
          !result.stderr.toLowerCase().includes('syntax error') &&
          !result.stderr.toLowerCase().includes('nameerror') &&
          !result.stderr.toLowerCase().includes('indentationerror'))
    );

    const isPassed = allPassed;

    const errors = testResults
      .filter((result) => !result.passed)
      .map((result) => ({
        testIndex: result.testIndex,
        error:
          result.stderr || result.stdout || 'Execution failed or timed out',
        exitCode: result.exitCode,
        input: result.input,
        expectedOutput: result.expectedOutput,
        actualOutput: result.actualOutput,
      }));

    // Get the first error message for quick display (if any)
    const firstError = errors.length > 0 ? errors[0].error : null;

    const response = {
      success: true,
      matchSettingId,
      data: {
        isCompiled,
        isPassed,
        matchSettingId,
        error: firstError,
        errors: errors.length > 0 ? errors : undefined,
      },
      summary: {
        total: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        allPassed,
      },
      results: testResults,
    };

    res.json(response);
  } catch (error) {
    let errorMessage = 'An error occurred while processing the request';

    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.toString && error.toString() !== '[object Object]') {
      errorMessage = error.toString();
    } else if (error?.name) {
      errorMessage = `${error.name}: An error occurred`;
    }

    const errorResponse = {
      message: errorMessage,
    };

    if (process.env.NODE_ENV === 'development') {
      if (error?.stack) {
        errorResponse.stack = error.stack;
      }
      if (error?.name) {
        errorResponse.name = error.name;
      }
      if (error?.code) {
        errorResponse.code = error.code;
      }
    }

    res.status(500).json({
      success: false,
      error: errorResponse,
    });
  }
});

export default router;
