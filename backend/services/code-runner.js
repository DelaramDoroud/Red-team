// Stubbed compile-and-test runner. Colleagues will replace with real compiler/tester.
// Returns compilation_failed if the source contains the token "INVALID_CODE"; otherwise succeeds.
export async function runSubmission({ code, matchSetting }) {
  if (!code || typeof code !== 'string') {
    return {
      status: 'compilation_failed',
      compilationError: 'Code is empty or not a string.',
    };
  }

  if (code.includes('INVALID_CODE')) {
    return {
      status: 'compilation_failed',
      compilationError: 'Stub compiler: found INVALID_CODE token.',
    };
  }

  return {
    status: 'compiled',
    compilationError: null,
    testResults: {
      publicTests: [],
      privateTests: [],
      summary: { passed: 0, failed: 0 },
      matchSettingId: matchSetting?.id ?? null,
    },
  };
}

export default { runSubmission };
