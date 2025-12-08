import { getQueue, initializeQueue } from './code-execution-queue.js';
import { runCode } from './code-runner.js';

const WORKER_CONCURRENCY = parseInt(
  process.env.CODE_EXECUTION_CONCURRENCY || '5',
  10
);

let workerStarted = false;

export async function startWorker() {
  if (workerStarted) {
    console.log('Code execution worker already started');
    return;
  }

  const queue = await initializeQueue();

  await queue.work(
    'execute-code',
    {
      teamSize: WORKER_CONCURRENCY,
      teamConcurrency: WORKER_CONCURRENCY,
    },
    async (job) => {
      const { code, language, input, userId, submissionId, matchId } = job.data;
      const startTime = Date.now();

      try {
        // Validate required fields
        if (!code || !language) {
          throw new Error('Code and language are required');
        }

        const result = await runCode(code, language, input || '');

        const executionTime = Date.now() - startTime;

        return {
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
      } catch (error) {
        const executionTime = Date.now() - startTime;
        throw new Error(
          `Code execution failed: ${error.message}. Execution time: ${executionTime}ms`
        );
      }
    }
  );

  workerStarted = true;
  console.log(
    `✓ Code execution worker started with concurrency: ${WORKER_CONCURRENCY}`
  );

  queue.onComplete('execute-code', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  queue.onFail('execute-code', (job) => {
    console.error(
      `Job ${job.id} failed:`,
      job.output?.message || 'Unknown error'
    );
  });

  queue.onError((error) => {
    console.error('Queue error:', error);
  });
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
