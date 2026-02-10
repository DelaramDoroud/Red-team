import { createCustomTestId, getUserFacingErrorMessage } from './matchHelpers';

export const runCodeAction = async ({
  assembledCode,
  challengeId,
  isTimeUp,
  matchData,
  runCode,
  setCanSubmit,
  setError,
  setIsCompiled,
  setIsRunning,
  setIsSubmittingActive,
  setMessage,
  setRunResult,
  setTestResults,
  storeLastCompiled,
}) => {
  if (!matchData) return;
  if (isTimeUp) {
    setRunResult({
      type: 'error',
      message: 'Time is up. You can no longer run or submit code.',
    });
    return;
  }

  setRunResult({ type: 'info', message: 'Running your code...' });
  setIsRunning(true);
  setMessage(null);
  setError(null);
  setCanSubmit(false);
  setIsCompiled(null);
  setIsSubmittingActive(false);

  try {
    if (!runCode) {
      setRunResult({
        type: 'success',
        message: 'Your code compiled successfully.',
      });
      setIsCompiled(true);
      setCanSubmit(true);
      setIsSubmittingActive(true);
      setTestResults([]);
      storeLastCompiled();
      return;
    }

    const payload = {
      matchSettingId:
        matchData.id ||
        matchData.matchSettingId ||
        matchData.challengeMatchSettingId ||
        challengeId,
      code: assembledCode,
      language: 'cpp',
    };
    const res = await runCode(payload);
    const results = res?.results || res?.data?.results || [];
    setTestResults(results);

    if (!res?.success) {
      const errorMessage = getUserFacingErrorMessage(
        res,
        'Unable to run your code.'
      );
      setRunResult({ type: 'error', message: errorMessage });
      setIsCompiled(false);
      setCanSubmit(false);
      return;
    }

    const isCompiledValue =
      res?.data?.isCompiled !== undefined
        ? res.data.isCompiled
        : res.isCompiled;
    const isPassed =
      res?.data?.isPassed !== undefined ? res.data.isPassed : res.isPassed;

    if (!isCompiledValue) {
      setRunResult({
        type: 'error',
        message: 'Your code did not compile.',
      });
      setIsCompiled(false);
      setCanSubmit(false);
      return;
    }

    if (!isPassed) {
      setRunResult({
        type: 'error',
        message:
          'Your code did not pass the public tests. Fix the issues and try again.',
      });
      setIsCompiled(true);
      setCanSubmit(false);
      return;
    }

    setRunResult({
      type: 'success',
      message: 'Your code compiled successfully.',
    });
    setIsCompiled(true);
    setCanSubmit(true);
    setIsSubmittingActive(true);
    storeLastCompiled();
  } catch {
    setRunResult({
      type: 'error',
      message: 'Network error while running the code.',
    });
    setIsCompiled(false);
    setCanSubmit(false);
  } finally {
    setIsRunning(false);
  }
};

export const addCustomTestCase = (setCustomTests) => {
  setCustomTests((prev) => [
    ...prev,
    { id: createCustomTestId(), input: '', expectedOutput: '' },
  ]);
};

export const updateCustomTestCase = (setCustomTests, id, field, value) => {
  setCustomTests((prev) =>
    prev.map((testCase) => {
      if (testCase.id !== id) return testCase;
      return { ...testCase, [field]: value };
    })
  );
};

export const removeCustomTestCase = (setCustomTests, id) => {
  setCustomTests((prev) => prev.filter((testCase) => testCase.id !== id));
};

const buildCustomTestsPayload = (tests) => {
  const payload = [];
  const order = [];

  tests.forEach((testCase) => {
    const inputValue =
      typeof testCase.input === 'string' ? testCase.input.trim() : '';
    const expectedValue =
      typeof testCase.expectedOutput === 'string'
        ? testCase.expectedOutput.trim()
        : '';
    if (!inputValue) return;
    const entry = { input: inputValue };
    if (expectedValue) entry.output = expectedValue;
    payload.push(entry);
    order.push(testCase.id);
  });

  return { payload, order };
};

export const runCustomTestsAction = async ({
  assembledCode,
  challengeId,
  customTests,
  isTimeUp,
  runCustomTests,
  setCustomRunOrder,
  setCustomRunResult,
  setCustomTestResults,
  setIsCustomRunning,
  studentId,
}) => {
  if (isTimeUp) {
    setCustomRunResult({
      type: 'error',
      message: 'Time is up. You can no longer run custom tests.',
    });
    return;
  }

  if (!runCustomTests || !studentId || !challengeId) {
    setCustomRunResult({
      type: 'error',
      message: 'Custom tests are not available right now.',
    });
    return;
  }

  const { payload, order } = buildCustomTestsPayload(customTests || []);
  if (payload.length === 0) {
    setCustomRunResult({
      type: 'error',
      message: 'Add at least one custom test input to run.',
    });
    return;
  }

  setCustomRunResult({ type: 'info', message: 'Running custom tests...' });
  setIsCustomRunning(true);
  setCustomTestResults([]);
  setCustomRunOrder(order);

  try {
    const res = await runCustomTests({
      challengeId,
      studentId,
      code: assembledCode,
      tests: payload,
    });

    if (!res?.success) {
      setCustomRunResult({
        type: 'error',
        message: getUserFacingErrorMessage(res, 'Unable to run custom tests.'),
      });
      setIsCustomRunning(false);
      return;
    }

    const results = res?.data?.results || res?.results || [];
    setCustomTestResults(results);
    setCustomRunResult({
      type: 'success',
      message: 'Custom tests executed.',
    });
  } catch {
    setCustomRunResult({
      type: 'error',
      message: 'Network error while running custom tests.',
    });
  } finally {
    setIsCustomRunning(false);
  }
};
