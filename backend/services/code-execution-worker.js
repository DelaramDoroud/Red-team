import { getQueue, initializeQueue } from './code-execution-queue.js';
import { runCode } from './code-runner.js';

const WORKER_CONCURRENCY = parseInt(
  process.env.CODE_EXECUTION_CONCURRENCY || '5',
  10
);

let workerStarted = false;

export async function startWorker() {
  console.log('[WORKER] startWorker called, workerStarted:', workerStarted);
  if (workerStarted) {
    console.log('[WORKER] Code execution worker already started');
    return;
  }

  console.log('[WORKER] Initializing queue...');
  const queue = await initializeQueue();
  console.log('[WORKER] Queue initialized:', !!queue);

  // Set up event listeners before starting work (if available)
  if (typeof queue.onComplete === 'function') {
    queue.onComplete('execute-code', (job) => {
      console.log(`[WORKER] Job ${job.id} completed successfully`);
    });
  } else {
    console.log('[WORKER] queue.onComplete is not a function');
  }

  if (typeof queue.onFail === 'function') {
    queue.onFail('execute-code', (job) => {
      console.error(
        `[WORKER] Job ${job.id} failed:`,
        job.output?.message || 'Unknown error'
      );
    });
  } else {
    console.log('[WORKER] queue.onFail is not a function');
  }

  if (typeof queue.onError === 'function') {
    queue.onError((error) => {
      console.error('[WORKER] Queue error:', error);
    });
  } else {
    console.log('[WORKER] queue.onError is not a function');
  }

  console.log(
    '[WORKER] Starting queue.work with concurrency:',
    WORKER_CONCURRENCY
  );
  console.log('[WORKER] Queue name: execute-code');
  console.log('[WORKER] Queue object:', {
    hasWork: typeof queue.work === 'function',
    hasOnComplete: typeof queue.onComplete === 'function',
    hasOnFail: typeof queue.onFail === 'function',
  });

  try {
    // pg-boss work() doesn't return a promise that resolves - it starts the worker
    // The worker runs continuously in the background
    queue.work(
      'execute-code',
      {
        teamSize: WORKER_CONCURRENCY,
        teamConcurrency: WORKER_CONCURRENCY,
      },
      async (job) => {
        console.log('[WORKER] ===== JOB RECEIVED =====');

        const actualJob = Array.isArray(job) && job.length > 0 ? job[0] : job;

        console.log('[WORKER] Processing job:', {
          jobId: actualJob?.id,
          name: actualJob?.name,
          hasData: !!actualJob?.data,
        });

        const jobData = actualJob?.data || {};
        const { code, language, input, userId, submissionId, matchId } =
          jobData;
        const jobId = actualJob?.id;
        const startTime = Date.now();

        console.log('[WORKER] Processing job:', {
          jobId,
          language,
          codeLength: code?.length,
          inputLength: input?.length,
          hasCode: !!code,
          hasLanguage: !!language,
          timestamp: new Date().toISOString(),
        });

        try {
          if (!code || !language) {
            console.error('[WORKER] Missing code or language:', {
              code: !!code,
              language: !!language,
            });
            throw new Error('Code and language are required');
          }

          console.log('[WORKER] Calling runCode for job:', jobId);
          const result = await runCode(code, language, input || '');
          console.log('[WORKER] runCode completed for job:', jobId, {
            success: result.success,
            exitCode: result.exitCode,
            stdoutLength: result.stdout?.length,
            stderrLength: result.stderr?.length,
          });

          const executionTime = Date.now() - startTime;

          const jobResult = {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            executionTime,
            timestamp: new Date().toISOString(),
            userId,
            submissionId,
            matchId,
          };

          console.log('[WORKER] Job completed successfully:', {
            jobId,
            executionTime,
            success: result.success,
          });

          return jobResult;
        } catch (error) {
          const executionTime = Date.now() - startTime;
          console.error('[WORKER] Job failed:', {
            jobId,
            error: error.message,
            executionTime,
          });
          throw new Error(
            `Code execution failed: ${error.message}. Execution time: ${executionTime}ms`
          );
        }
      }
    );

    console.log(
      '[WORKER] queue.work() called, worker is now listening for jobs'
    );
    // Note: queue.work() doesn't return a promise - it starts the worker in the background
    // The worker will continue running and processing jobs
  } catch (error) {
    console.error('[WORKER] Error starting worker:', error);
    throw error;
  }

  workerStarted = true;
  console.log(
    `✓ Code execution worker started with concurrency: ${WORKER_CONCURRENCY}`
  );
}

export async function stopWorker() {
  if (!workerStarted) {
    return;
  }

  const queue = getQueue();
  if (queue) {
    await queue.stop();
    workerStarted = false;
    console.log('Code execution worker stopped');
  }
}
