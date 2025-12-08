import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const LANGUAGE_CONFIGS = {
  python: {
    command: 'python3',
    extension: '.py',
    timeout: 10000,
  },
  javascript: {
    command: 'node',
    extension: '.js',
    timeout: 10000,
  },
  java: {
    command: 'javac && java',
    extension: '.java',
    timeout: 15000,
    compileFirst: true,
  },
  cpp: {
    command: 'g++ -o main && ./main',
    extension: '.cpp',
    timeout: 15000,
    compileFirst: true,
  },
  c: {
    command: 'gcc -o main && ./main',
    extension: '.c',
    timeout: 15000,
    compileFirst: true,
  },
};

const DOCKER_IMAGE = process.env.CODE_RUNNER_IMAGE || 'judge0/compilers:latest';

const getTempBase = () => {
  return tmpdir();
};

export async function runCode(code, language, input = '') {
  console.log('[CODE RUNNER] Starting code execution:', {
    language,
    codeLength: code.length,
    inputLength: input.length,
    timestamp: new Date().toISOString(),
  });

  const config = LANGUAGE_CONFIGS[language.toLowerCase()];
  if (!config) {
    console.error('[CODE RUNNER] Unsupported language:', language);
    throw new Error(
      `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`
    );
  }

  console.log('[CODE RUNNER] Language config:', {
    command: config.command,
    timeout: config.timeout,
    compileFirst: config.compileFirst || false,
  });

  const tempBase = getTempBase();
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const codeFile = join(tempBase, `code-${uniqueId}${config.extension}`);
  const inputFile = join(tempBase, `input-${uniqueId}.txt`);
  const codeFileName = `code-${uniqueId}${config.extension}`;
  const inputFileName = `input-${uniqueId}.txt`;
  const cidFile = join(tempBase, `cid-${uniqueId}.txt`); // Container ID file

  try {
    await writeFile(codeFile, code, 'utf8');

    if (input) {
      await writeFile(inputFile, input, 'utf8');
    }

    return new Promise((resolve) => {
      const getContainerId = async () => {
        try {
          const { readFile } = await import('fs/promises');
          const cid = await readFile(cidFile, 'utf8');
          return cid.trim();
        } catch {
          return null;
        }
      };

      const killContainer = async (containerId) => {
        if (!containerId) return;
        try {
          const { spawn: spawnKill } = await import('child_process');
          const killProcess = spawnKill('docker', ['kill', containerId], {
            stdio: 'ignore',
          });
          killProcess.on('error', () => {
            // Ignore errors when killing container - it may already be stopped
          });
        } catch {
          // Ignore errors - container may not exist or already be killed
        }
      };

      const dockerArgs = [
        'run',
        '--rm',
        '--cidfile',
        cidFile,
        '--network',
        'none',
        '--memory=128m',
        '--cpus=0.5',
        '--read-only',
        '--tmpfs',
        '/tmp:rw,noexec,nosuid,size=10m',
        '-i',
        DOCKER_IMAGE,
        'sh',
        '-c',
      ];

      let execCommand;
      const codeFilePath = `/tmp/${codeFileName}`;
      const inputFilePath = `/tmp/${inputFileName}`;

      let setupCommand = `cat > ${codeFilePath}`;
      if (input) {
        setupCommand += ` && echo '${input.replace(/'/g, "'\\''")}' > ${inputFilePath}`;
      }

      if (config.compileFirst) {
        const compileCmd = config.command.split(' && ')[0];
        const runCmd = config.command.split(' && ')[1];
        const outputName = `/tmp/output-${uniqueId}`;
        execCommand = `${setupCommand} && ${compileCmd} ${codeFilePath} -o ${outputName} && ${runCmd} ${outputName}`;
      } else {
        if (input) {
          execCommand = `${setupCommand} && ${config.command} ${codeFilePath} < ${inputFilePath}`;
        } else {
          execCommand = `${setupCommand} && ${config.command} ${codeFilePath}`;
        }
      }

      dockerArgs.push(execCommand);

      console.log('[CODE RUNNER] Spawning Docker container:', {
        image: DOCKER_IMAGE,
        command: execCommand.substring(0, 100) + '...',
        uniqueId,
      });

      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      console.log(
        '[CODE RUNNER] Docker process spawned, PID:',
        dockerProcess.pid
      );

      dockerProcess.stdin.write(code, 'utf8', () => {
        console.log('[CODE RUNNER] Code written to stdin, closing stdin');
        dockerProcess.stdin.end();
      });

      setTimeout(() => {
        if (!dockerProcess.stdin.destroyed) {
          dockerProcess.stdin.destroy();
        }
      }, 100);

      let stdout = '';
      let stderr = '';
      let timeoutId;
      let resolved = false;

      timeoutId = setTimeout(async () => {
        if (!resolved) {
          console.log('[CODE RUNNER] Timeout reached, killing container');
          resolved = true;
          if (!dockerProcess.stdin.destroyed) {
            dockerProcess.stdin.destroy();
          }
          dockerProcess.kill('SIGKILL');

          const containerId = await getContainerId();
          if (containerId) {
            await killContainer(containerId);
          }

          cleanup(codeFile, inputFile, cidFile).catch(() => {});
          resolve({
            success: false,
            stdout: '',
            stderr: 'Execution timeout',
            exitCode: 124,
          });
        }
      }, config.timeout);

      dockerProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(
          '[CODE RUNNER] Received stdout chunk:',
          output.substring(0, 100)
        );
      });

      dockerProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(
          '[CODE RUNNER] Received stderr chunk:',
          output.substring(0, 100)
        );
      });

      dockerProcess.on('close', async (code) => {
        if (resolved) {
          console.log(
            '[CODE RUNNER] Container already resolved, ignoring close event'
          );
          return;
        }
        resolved = true;
        clearTimeout(timeoutId);

        console.log('[CODE RUNNER] Container closed with exit code:', code);
        console.log('[CODE RUNNER] Final stdout length:', stdout.length);
        console.log('[CODE RUNNER] Final stderr length:', stderr.length);

        const containerId = await getContainerId();
        if (containerId) {
          console.log('[CODE RUNNER] Container ID:', containerId);
          setTimeout(async () => {
            try {
              const { execSync } = await import('child_process');
              execSync(
                `docker ps --filter id=${containerId} --format "{{.ID}}"`,
                { stdio: 'ignore' }
              );
              await killContainer(containerId);
            } catch {
              // Ignore errors - container already removed, which is expected
            }
          }, 1000);
        }

        await cleanup(codeFile, inputFile, cidFile);

        const result = {
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        };

        console.log('[CODE RUNNER] Execution completed:', {
          success: result.success,
          exitCode: result.exitCode,
          stdoutLength: result.stdout.length,
          stderrLength: result.stderr.length,
        });

        resolve(result);
      });

      dockerProcess.on('error', async (error) => {
        console.error('[CODE RUNNER] Docker process error:', error.message);
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        if (!dockerProcess.stdin.destroyed) {
          dockerProcess.stdin.destroy();
        }

        // Try to kill container on error
        const containerId = await getContainerId();
        if (containerId) {
          await killContainer(containerId);
        }

        await cleanup(codeFile, inputFile, cidFile);

        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: 1,
          error: error.message,
        });
      });

      dockerProcess.stdin.on('error', () => {});
    });
  } catch (error) {
    await cleanup(codeFile, inputFile, cidFile);
    throw error;
  }
}

async function cleanup(codeFile, inputFile, cidFile) {
  try {
    await unlink(codeFile).catch(() => {});
    if (inputFile) {
      await unlink(inputFile).catch(() => {});
    }
    if (cidFile) {
      await unlink(cidFile).catch(() => {});
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

export function getSupportedLanguages() {
  return Object.keys(LANGUAGE_CONFIGS);
}
