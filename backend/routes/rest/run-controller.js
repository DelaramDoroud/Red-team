import { Router } from 'express';
import MatchSetting from '#root/models/match-setting.js';
import { handleException } from '#root/services/error.js';
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

    for (const jobInfo of jobPromises) {
      let jobStatus = null;
      const jobStartTime = Date.now();

      while (Date.now() - jobStartTime < maxWaitTime) {
        jobStatus = await getJobStatus(jobInfo.jobId);

        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

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
        // Job failed or timed out
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

    res.json({
      success: true,
      matchSettingId,
      summary: {
        total: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        allPassed,
      },
      results: testResults,
    });
  } catch (error) {
    handleException(res, error);
  }
});

export default router;
