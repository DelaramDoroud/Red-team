import { PgBoss } from 'pg-boss';
import databaseConfig from '#root/config/database.js';

const getConnectionString = () => {
  const { user, password, name, options } = databaseConfig;
  const { host, port } = options;

  const encodedPassword = password ? encodeURIComponent(password) : '';
  const passwordPart = encodedPassword ? `:${encodedPassword}` : '';
  return `postgresql://${user}${passwordPart}@${host}:${port || 5432}/${name}`;
};

let codeExecutionQueue = null;

export async function initializeQueue() {
  if (codeExecutionQueue) {
    return codeExecutionQueue;
  }

  codeExecutionQueue = new PgBoss({
    connectionString: getConnectionString(),
    schema: 'pgboss',
    retryLimit: 3,
    retryDelay: 2000,
    retryBackoff: true,
    deleteAfterHours: 1,
    deleteAfterHoursArchived: 24,
  });

  await codeExecutionQueue.start();
  console.log('✓ Code execution queue initialized (pg-boss)');

  return codeExecutionQueue;
}

export async function enqueueCodeExecution(jobData, options = {}) {
  if (!codeExecutionQueue) {
    await initializeQueue();
  }

  const {
    code,
    language,
    input = '',
    userId = null,
    submissionId = null,
    matchId = null,
    priority = 0,
  } = jobData;

  const jobId =
    submissionId ||
    `code-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const job = await codeExecutionQueue.send(
    'execute-code',
    {
      code,
      language,
      input,
      userId,
      submissionId,
      matchId,
      timestamp: new Date().toISOString(),
    },
    {
      id: jobId,
      priority,
      retryLimit: options.retryLimit || 3,
      retryDelay: options.retryDelay || 2000,
      ...options,
    }
  );

  return { id: job };
}
