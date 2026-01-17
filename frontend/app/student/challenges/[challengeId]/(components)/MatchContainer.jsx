'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useChallenge from '#js/useChallenge';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import {
  clearChallengeDraft,
  migrateChallengeKey,
  setDraftCode,
  setLastCompiledCode,
  setLastSuccessfulCode,
} from '#js/store/slices/ui';
import { ChallengeStatus, NETWORK_RESPONSE_NOT_OK } from '#js/constants';
import { getApiErrorMessage } from '#js/apiError';
import useApiErrorRedirect from '#js/useApiErrorRedirect';
import MatchView from './MatchView';
import { useDuration } from '../(context)/DurationContext';

const DEFAULT_IMPORTS = '#include <iostream>';
const IMPORTS_END_MARKER = '// __CODYMATCH_IMPORTS_END__';
const DEFAULT_PREFIX = `using namespace std;

int main() {
`;
const DEFAULT_SUFFIX = `
    return 0;
}
`;

const IMPORT_MARKERS = [
  '/* IMPORTS */',
  '// IMPORTS',
  '//IMPORTS',
  '{{IMPORTS}}',
];
const STUDENT_MARKERS = [
  '/* STUDENT_CODE */',
  '// STUDENT_CODE',
  '//STUDENT_CODE',
  '// TODO',
  '//TODO',
  '/* TODO */',
  '{{STUDENT_CODE}}',
];

const MESSAGE_PHASE1_NO_SUBMISSION_INVALID =
  'You did not submit any code. We checked your draft, but it did not pass the public tests, so your submission is not valid.';
const MESSAGE_PHASE1_NO_SUBMISSION_VALID =
  'You did not submit any code. Your draft passed the public tests, so your submission is valid.';
const MESSAGE_PHASE1_SUBMITTED = 'You submitted your code.';
const MESSAGE_PHASE1_SUBMITTED_AUTO_BETTER =
  'You submitted your code. However, your latest version is better, so we kept this latest version automatically.';
const MESSAGE_SUBMISSION_SUCCESS = 'Thanks for your submission.';
const MESSAGE_SUBMISSION_PUBLIC_FAIL =
  'Thanks for your submission. There are problems with your solution, try to improve it.';
const MESSAGE_SUBMISSION_PRIVATE_FAIL =
  'Thanks for your submission. You passed all public test cases, but you missed some edge cases. Read the problem again and try to improve your code.';
const MESSAGE_PEER_REVIEW_PENDING =
  "Wait for the peer review phase to start so you can review your classmates' code.";
const DRAFT_SAVE_DELAY_MS = 600;

const createCustomTestId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const stripMarkers = (code, markers) =>
  markers.reduce((value, marker) => value.split(marker).join(''), code);

const extractImports = (code) => {
  const lines = code.split('\n');
  const importLines = [];
  const restLines = [];
  lines.forEach((line) => {
    if (/^\s*#include\b/.test(line)) {
      importLines.push(line);
    } else {
      restLines.push(line);
    }
  });
  return {
    imports: importLines.join('\n'),
    code: restLines.join('\n'),
  };
};

const splitAtMarker = (code, markers) => {
  const marker = markers.find((candidate) => code.includes(candidate));
  if (!marker) return null;
  const [before, after] = code.split(marker);
  return { before, after };
};

const splitAtReturn = (code) => {
  const marker = 'return 0;';
  const index = code.indexOf(marker);
  if (index === -1) return null;
  return {
    before: code.slice(0, index),
    after: code.slice(index),
  };
};

const buildTemplateParts = (starterCode) => {
  if (!starterCode || !starterCode.trim()) {
    return {
      imports: DEFAULT_IMPORTS,
      fixedPrefix: DEFAULT_PREFIX,
      fixedSuffix: DEFAULT_SUFFIX,
    };
  }

  let working = stripMarkers(starterCode, IMPORT_MARKERS);
  const extracted = extractImports(working);
  const imports = extracted.imports.trim()
    ? extracted.imports
    : DEFAULT_IMPORTS;
  working = extracted.code;

  let split = splitAtMarker(working, STUDENT_MARKERS);
  if (!split) {
    split = splitAtReturn(working);
  }
  if (!split) {
    return {
      imports,
      fixedPrefix: working,
      fixedSuffix: '',
    };
  }
  return {
    imports,
    fixedPrefix: split.before,
    fixedSuffix: split.after,
  };
};

const analyzeImports = (value) => {
  const rawValue = typeof value === 'string' ? value : '';
  const lines = rawValue.split('\n');
  const sanitizedLines = [];
  const invalidLines = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      sanitizedLines.push(line);
      return;
    }
    if (/^\s*#include\b/.test(line)) {
      sanitizedLines.push(line);
      return;
    }
    invalidLines.push(line);
  });
  return {
    sanitized: sanitizedLines.join('\n'),
    invalidLines,
  };
};

const assembleCode = (imports, fixedPrefix, studentCode, fixedSuffix) => {
  const trimmedImports = imports && imports.trim();
  let importBlock = '';
  if (trimmedImports) {
    importBlock = `${trimmedImports}\n${IMPORTS_END_MARKER}\n\n`;
  }
  const prefix = fixedPrefix || '';
  const student = studentCode || '';
  const suffix = fixedSuffix || '';
  return `${importBlock}${prefix}${student}${suffix}`;
};

const normalizeCode = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeSnapshot = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return { imports: '', studentCode: value };
  }
  return {
    imports: value.imports || '',
    studentCode: value.studentCode || '',
  };
};

const IMPORTS_VALIDATION_MESSAGE =
  'Only #include lines are allowed in the imports section.';
const IMPORTS_USER_MESSAGE =
  'Imports can only contain #include lines. Remove any other statements.';

const parseNetworkErrorMessage = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (!value.startsWith(NETWORK_RESPONSE_NOT_OK)) return value;

  const raw = value.slice(NETWORK_RESPONSE_NOT_OK.length);
  try {
    const parsed = JSON.parse(raw);
    const parsedMessage =
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.error?.errors?.[0]?.message;
    if (typeof parsedMessage === 'string' && parsedMessage.trim()) {
      return parsedMessage;
    }
  } catch {
    return null;
  }

  return null;
};

const parseApiErrorMessage = (result) => {
  if (!result) return null;
  if (typeof result === 'string') return parseNetworkErrorMessage(result);

  const directError = result?.error?.message;
  const parsedDirect = parseNetworkErrorMessage(directError);
  if (typeof parsedDirect === 'string' && parsedDirect.trim()) {
    return parsedDirect;
  }

  if (result?.error instanceof Error && result.error.message) {
    return parseNetworkErrorMessage(result.error.message);
  }

  const message = result?.message;
  return parseNetworkErrorMessage(message);
};

const getUserFacingErrorMessage = (result, fallback) => {
  const parsed = parseApiErrorMessage(result);
  if (!parsed) return fallback;
  if (parsed === IMPORTS_VALIDATION_MESSAGE) return IMPORTS_USER_MESSAGE;
  if (parsed.includes(IMPORTS_VALIDATION_MESSAGE)) {
    return IMPORTS_USER_MESSAGE;
  }
  return parsed;
};

export default function MatchContainer({ challengeId, studentId }) {
  const dispatch = useAppDispatch();
  const durationContext = useDuration();
  const challengeStatus = durationContext?.status;
  const hasDurationContext = durationContext !== null;
  const isStatusKnown =
    hasDurationContext &&
    challengeStatus !== null &&
    challengeStatus !== undefined;
  const isPhaseOneActive =
    challengeStatus === ChallengeStatus.STARTED_PHASE_ONE;
  const isWaitingForStart = challengeStatus === ChallengeStatus.ASSIGNED;
  const startSignature =
    durationContext?.startPhaseOneDateTime || durationContext?.startDatetime;
  const challengeSignature = useMemo(
    () =>
      startSignature ? `${challengeId}-${startSignature}` : `${challengeId}`,
    [challengeId, startSignature]
  );
  const peerReviewPendingMessage =
    challengeStatus === ChallengeStatus.ENDED_PHASE_ONE
      ? MESSAGE_PEER_REVIEW_PENDING
      : null;
  const isPhaseOneOver =
    challengeStatus === ChallengeStatus.ENDED_PHASE_ONE ||
    challengeStatus === ChallengeStatus.STARTED_PHASE_TWO ||
    challengeStatus === ChallengeStatus.ENDED_PHASE_TWO;
  const {
    getStudentAssignedMatchSetting,
    getStudentAssignedMatch,
    submitSubmission,
    getLastSubmission,
    runCode,
    runCustomTests,
  } = useChallenge();
  const redirectOnError = useApiErrorRedirect();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [imports, setImports] = useState(DEFAULT_IMPORTS);
  const [studentCode, setStudentCode] = useState('');
  const [importsWarning, setImportsWarning] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [customTests, setCustomTests] = useState([]);
  const [customRunResult, setCustomRunResult] = useState(null);
  const [customTestResults, setCustomTestResults] = useState([]);
  const [customRunOrder, setCustomRunOrder] = useState([]);
  const [isCustomRunning, setIsCustomRunning] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isCompiled, setIsCompiled] = useState(null);
  const [isChallengeFinished, setIsChallengeFinished] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState('saved');
  const hasLoadedFromStorage = useRef(false);
  const lastSuccessRef = useRef(null);
  const autoSubmitTriggeredRef = useRef(false);
  const draftSaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef({ imports: '', studentCode: '' });
  const storageKeyBase = useMemo(
    () => (matchId ? `match-${matchId}` : `challenge-${challengeId}`),
    [matchId, challengeId]
  );
  const templateParts = useMemo(
    () => buildTemplateParts(matchData?.starterCode),
    [matchData]
  );
  const { imports: defaultImports, fixedPrefix, fixedSuffix } = templateParts;

  const assembledCode = useMemo(
    () => assembleCode(imports, fixedPrefix, studentCode, fixedSuffix),
    [imports, fixedPrefix, studentCode, fixedSuffix]
  );

  const savedDraftEntry = useAppSelector((state) => {
    if (!studentId) return null;
    return state.ui.challengeDrafts?.[studentId]?.[storageKeyBase] || null;
  });
  const hasSignatureToken = Boolean(startSignature);
  const shouldIgnoreSavedDraft = Boolean(
    savedDraftEntry &&
    ((savedDraftEntry.signature &&
      savedDraftEntry.signature !== challengeSignature) ||
      (hasSignatureToken && !savedDraftEntry.signature))
  );
  const activeDraftEntry = shouldIgnoreSavedDraft ? null : savedDraftEntry;
  const savedLastCompiledSnapshot = normalizeSnapshot(
    activeDraftEntry?.lastCompiled
  );
  const savedLastSuccessSnapshot = normalizeSnapshot(
    activeDraftEntry?.lastSuccessful
  );

  useEffect(
    () => () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
    },
    []
  );

  const resetMatchStateForWaiting = useCallback(() => {
    setMessage(null);
    setError(null);
    setRunResult(null);
    setIsRunning(false);
    setIsSubmitting(false);
    setIsSubmittingActive(false);
    setTestResults([]);
    setCustomTests([]);
    setCustomRunResult(null);
    setCustomTestResults([]);
    setCustomRunOrder([]);
    setIsCustomRunning(false);
    setCanSubmit(false);
    setIsCompiled(null);
    setIsTimeUp(false);
    setMatchData(null);
    setMatchId(null);
    lastSuccessRef.current = null;
    autoSubmitTriggeredRef.current = false;
    hasLoadedFromStorage.current = false;
    setImports(DEFAULT_IMPORTS);
    setStudentCode('');
    setImportsWarning('');
    setDraftSaveState('saved');
    lastSavedSnapshotRef.current = { imports: '', studentCode: '' };
  }, []);

  useEffect(() => {
    if (!studentId || !shouldIgnoreSavedDraft) return;
    dispatch(
      clearChallengeDraft({
        userId: studentId,
        key: storageKeyBase,
      })
    );
  }, [dispatch, shouldIgnoreSavedDraft, storageKeyBase, studentId]);

  useEffect(() => {
    if (!studentId || !matchId) return;
    const fromKey = `challenge-${challengeId}`;
    const toKey = `match-${matchId}`;
    dispatch(
      migrateChallengeKey({
        userId: studentId,
        fromKey,
        toKey,
      })
    );
  }, [dispatch, studentId, challengeId, matchId]);

  const storeLastCompiled = useCallback(() => {
    if (!studentId) return;
    if (!imports.trim() && !studentCode.trim()) return;
    dispatch(
      setLastCompiledCode({
        userId: studentId,
        key: storageKeyBase,
        imports,
        studentCode,
        signature: challengeSignature,
      })
    );
  }, [
    dispatch,
    storageKeyBase,
    studentId,
    imports,
    studentCode,
    challengeSignature,
  ]);

  useEffect(() => {
    hasLoadedFromStorage.current = false;
  }, [matchId, challengeId]);

  useEffect(() => {
    if (!matchData) return;
    if (hasLoadedFromStorage.current) return;

    let nextImports = defaultImports;
    let nextStudentCode = '';
    if (activeDraftEntry) {
      nextImports =
        typeof activeDraftEntry.imports === 'string'
          ? activeDraftEntry.imports
          : defaultImports;
      nextStudentCode =
        typeof activeDraftEntry.studentCode === 'string'
          ? activeDraftEntry.studentCode
          : '';
    }

    setImports(nextImports);
    setStudentCode(nextStudentCode);
    setImportsWarning('');

    if (savedLastSuccessSnapshot) {
      lastSuccessRef.current = assembleCode(
        savedLastSuccessSnapshot.imports || defaultImports,
        fixedPrefix,
        savedLastSuccessSnapshot.studentCode,
        fixedSuffix
      );
    } else {
      lastSuccessRef.current = null;
    }

    lastSavedSnapshotRef.current = {
      imports: nextImports,
      studentCode: nextStudentCode,
    };
    setDraftSaveState('saved');
    hasLoadedFromStorage.current = true;
  }, [
    matchData,
    activeDraftEntry,
    savedLastSuccessSnapshot,
    defaultImports,
    fixedPrefix,
    fixedSuffix,
  ]);

  useEffect(() => {
    if (!studentId || !matchData) return;
    if (!hasLoadedFromStorage.current) return;
    const nextSnapshot = {
      imports,
      studentCode,
    };
    const previousSnapshot = lastSavedSnapshotRef.current;
    const hasChanges =
      nextSnapshot.imports !== previousSnapshot.imports ||
      nextSnapshot.studentCode !== previousSnapshot.studentCode;
    if (!hasChanges) return;

    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    setDraftSaveState('saving');
    draftSaveTimerRef.current = setTimeout(() => {
      dispatch(
        setDraftCode({
          userId: studentId,
          key: storageKeyBase,
          imports: nextSnapshot.imports,
          studentCode: nextSnapshot.studentCode,
          signature: challengeSignature,
        })
      );
      lastSavedSnapshotRef.current = nextSnapshot;
      setDraftSaveState('saved');
    }, DRAFT_SAVE_DELAY_MS);
  }, [
    challengeSignature,
    dispatch,
    imports,
    matchData,
    studentCode,
    storageKeyBase,
    studentId,
  ]);

  // load StudentAssignedMatchSetting(Match)
  useEffect(() => {
    if (!challengeId || !studentId) return () => {};
    if (hasDurationContext && !isPhaseOneActive) {
      if (!isStatusKnown) {
        setLoading(true);
        return () => {};
      }
      if (isWaitingForStart) {
        setLoading(false);
        resetMatchStateForWaiting();
        return () => {};
      }
      setLoading(false);
      return () => {};
    }

    let cancelled = false;

    async function fetchMatch() {
      setMessage(null);
      setLoading(true);
      setError(null);
      setRunResult(null);
      setIsRunning(false);
      setIsSubmitting(false);
      setIsSubmittingActive(false);
      setTestResults([]);
      setCustomTests([]);
      setCustomRunResult(null);
      setCustomTestResults([]);
      setCustomRunOrder([]);
      setIsCustomRunning(false);
      setCanSubmit(false);
      setIsCompiled(null);
      setIsTimeUp(false);
      setMatchData(null);
      setMatchId(null);
      lastSuccessRef.current = null;
      autoSubmitTriggeredRef.current = false;
      hasLoadedFromStorage.current = false;
      setImports(DEFAULT_IMPORTS);
      setStudentCode('');
      setImportsWarning('');

      try {
        const res = await getStudentAssignedMatchSetting(
          challengeId,
          studentId
        );
        if (cancelled) return;

        if (res?.success === false) {
          if (!cancelled) {
            if (redirectOnError(res)) return;
            setError({
              message: getApiErrorMessage(
                res,
                'Unable to load your match for this challenge.'
              ),
              code: res.code,
            });
          }
          return;
        }

        const { data } = res;

        if (!cancelled) {
          setMatchData(data);
          try {
            const matchRes = await getStudentAssignedMatch(
              challengeId,
              studentId
            );
            if (matchRes?.success && matchRes.data?.id) {
              setMatchId(matchRes.data.id);
            } else {
              setMatchId(null);
            }
          } catch {
            setMatchId(null);
          }
        }
      } catch (_err) {
        if (!cancelled) {
          setError({
            message: 'Network error while loading your match. Try again.',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (challengeId && studentId) {
      fetchMatch();
    }

    return () => {
      cancelled = true;
    };
  }, [
    challengeId,
    studentId,
    getStudentAssignedMatchSetting,
    getStudentAssignedMatch,
    redirectOnError,
    hasDurationContext,
    isPhaseOneActive,
    isStatusKnown,
    isWaitingForStart,
    resetMatchStateForWaiting,
  ]);

  // handlers: run
  const handleRun = useCallback(async () => {
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
      // If runCode is unavailable (e.g., mocked), simulate a successful run
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
        setRunResult({
          type: 'error',
          message: errorMessage,
        });
        setIsCompiled(false);
        setCanSubmit(false);
        setIsSubmittingActive(false);
        return;
      }

      const compiled =
        res?.data?.isCompiled !== undefined ? res.data.isCompiled : true;
      // Only block submission if compilation actually failed.
      if (!compiled) {
        setRunResult({
          type: 'error',
          message: res?.data?.error || 'Compilation failed.',
        });
        setIsCompiled(false);
        setCanSubmit(false);
        setIsSubmittingActive(false);
        return;
      }

      const passed = res?.data?.isPassed;
      setRunResult({
        type: passed ? 'success' : 'info',
        message: passed
          ? 'All tests passed.'
          : 'Code compiled. Review public test results before submitting.',
      });
      setIsCompiled(true);
      setCanSubmit(true);
      setIsSubmittingActive(true);
      storeLastCompiled();
    } catch (err) {
      setRunResult({
        type: 'error',
        message: 'Network error while running the code.',
      });
      setIsCompiled(false);
      setCanSubmit(false);
    } finally {
      setIsRunning(false);
    }
  }, [
    challengeId,
    assembledCode,
    isTimeUp,
    matchData,
    runCode,
    storeLastCompiled,
  ]);

  const addCustomTest = useCallback(() => {
    setCustomTests((prev) => [
      ...prev,
      { id: createCustomTestId(), input: '', expectedOutput: '' },
    ]);
  }, []);

  const updateCustomTest = useCallback((id, field, value) => {
    setCustomTests((prev) =>
      prev.map((testCase) => {
        if (testCase.id !== id) return testCase;
        return { ...testCase, [field]: value };
      })
    );
  }, []);

  const removeCustomTest = useCallback((id) => {
    setCustomTests((prev) => prev.filter((testCase) => testCase.id !== id));
  }, []);

  const buildCustomTestsPayload = useCallback(() => {
    const payload = [];
    const order = [];

    customTests.forEach((testCase) => {
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
  }, [customTests]);

  const handleRunCustomTests = useCallback(async () => {
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

    const { payload, order } = buildCustomTestsPayload();
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
          message: getUserFacingErrorMessage(
            res,
            'Unable to run custom tests.'
          ),
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
    } catch (_err) {
      setCustomRunResult({
        type: 'error',
        message: 'Network error while running custom tests.',
      });
    } finally {
      setIsCustomRunning(false);
    }
  }, [
    assembledCode,
    buildCustomTestsPayload,
    challengeId,
    isTimeUp,
    runCustomTests,
    studentId,
  ]);

  // Manual submit handler
  const handleSubmit = useCallback(async () => {
    setMessage(null);
    setError(null);
    if (isTimeUp) {
      setError({ message: 'Time is up. You can no longer submit code.' });
      return false;
    }
    if (!canSubmit) {
      setError({ message: 'Run your code successfully before submitting.' });
      return false;
    }

    setIsSubmitting(true);

    try {
      const res = await getStudentAssignedMatch(challengeId, studentId);

      if (!res?.success || !res?.data?.id) {
        setError({ message: 'No match found for submission.' });
        return false;
      }

      const resolvedMatchId = res.data.id;
      setMatchId(resolvedMatchId);
      const persistKey = resolvedMatchId
        ? `match-${resolvedMatchId}`
        : storageKeyBase;

      if (!studentCode.trim()) {
        setError({ message: 'Empty code cannot be submitted.' });
        return false;
      }

      const submissionRes = await submitSubmission({
        matchId: resolvedMatchId,
        code: assembledCode,
      });

      if (submissionRes?.success) {
        const {
          publicSummary,
          privateSummary,
          publicTestResults,
          privateTestResults,
        } = submissionRes.data || {};

        // Determine message based on test results
        let submissionMessage = MESSAGE_SUBMISSION_SUCCESS;

        // Check test results directly for more reliable detection
        if (
          publicTestResults &&
          Array.isArray(publicTestResults) &&
          privateTestResults &&
          Array.isArray(privateTestResults)
        ) {
          // Check if all public tests passed
          const allPublicPassed = publicTestResults.every(
            (result) => result.passed === true
          );

          // Check if all private tests passed
          const allPrivatePassed = privateTestResults.every(
            (result) => result.passed === true
          );

          if (!allPublicPassed) {
            // Scenario A: Some or all public tests failed
            submissionMessage = MESSAGE_SUBMISSION_PUBLIC_FAIL;
          } else if (allPublicPassed && !allPrivatePassed) {
            // Scenario B: All public pass, but some private fail
            submissionMessage = MESSAGE_SUBMISSION_PRIVATE_FAIL;
          }
          // Scenario C: All public and private pass (default message)
        } else if (publicSummary && privateSummary) {
          // Fallback to summary if test results are not available
          const allPublicPassed =
            publicSummary.allPassed === true ||
            (publicSummary.passed === publicSummary.total &&
              publicSummary.total > 0);
          const allPrivatePassed =
            privateSummary.allPassed === true ||
            (privateSummary.passed === privateSummary.total &&
              privateSummary.total > 0);

          if (!allPublicPassed) {
            // Scenario A: Some or all public tests failed
            submissionMessage = MESSAGE_SUBMISSION_PUBLIC_FAIL;
          } else if (allPublicPassed && !allPrivatePassed) {
            // Scenario B: All public pass, but some private fail
            submissionMessage = MESSAGE_SUBMISSION_PRIVATE_FAIL;
          }
          // Scenario C: All public and private pass (default message)
        }

        setMessage(submissionMessage);
        lastSuccessRef.current = assembledCode;
        if (studentId) {
          dispatch(
            setLastSuccessfulCode({
              userId: studentId,
              key: persistKey,
              imports,
              studentCode,
              signature: challengeSignature,
            })
          );
        }
        return true;
      }

      // If the submission fails (often due to compilation), keep the last valid submission.
      // The backend should have retained it, but we fetch it to confirm and inform the user.
      try {
        const lastValid = await getLastSubmission(resolvedMatchId);
        const fallbackCode =
          lastValid?.data?.submission?.code || lastSuccessRef.current;
        if (fallbackCode && fallbackCode.trim()) {
          setMessage('New code failed. Kept your last valid submission.');
          lastSuccessRef.current = fallbackCode;
          return true;
        }
      } catch {
        // Ignore fallback failures and surface original submission error below.
      }

      const errorMessage = getUserFacingErrorMessage(
        submissionRes,
        'Submission failed.'
      );
      setError({ message: errorMessage });
      return false;
    } catch (err) {
      setError({ message: `Error: ${err.message}` });
      return false;
    } finally {
      setIsSubmitting(false);
      setIsSubmittingActive(false);
    }
  }, [
    isTimeUp,
    canSubmit,
    getStudentAssignedMatch,
    challengeId,
    studentId,
    storageKeyBase,
    studentCode,
    submitSubmission,
    assembledCode,
    dispatch,
    imports,
    challengeSignature,
    getLastSubmission,
  ]);

  // Automatic submission when timer finishes
  const handleTimerFinish = useCallback(async () => {
    setMessage(null);
    setError(null);
    setIsTimeUp(true);
    setCanSubmit(false);
    setIsSubmitting(true);
    setIsSubmittingActive(false);
    setIsRunning(false);
    setRunResult({
      type: 'error',
      message: 'Time is up. You can no longer run or submit code.',
    });

    const finishWithMessage = (nextMessage) => {
      setMessage(nextMessage);
      setIsChallengeFinished(true);
    };

    try {
      const res = await getStudentAssignedMatch(challengeId, studentId);

      if (!res?.success || !res?.data?.id) {
        finishWithMessage(MESSAGE_PHASE1_NO_SUBMISSION_INVALID);
        return false;
      }

      const resolvedMatchId = res.data.id;
      setMatchId(resolvedMatchId);
      const persistKey = resolvedMatchId
        ? `match-${resolvedMatchId}`
        : storageKeyBase;
      const matchSettingId =
        matchData?.id ||
        matchData?.matchSettingId ||
        matchData?.challengeMatchSettingId ||
        challengeId;

      const resolveLastSubmittedCode = async () => {
        const localCode = lastSuccessRef.current;
        if (normalizeCode(localCode)) return localCode;
        try {
          const lastRes = await getLastSubmission(resolvedMatchId);
          const lastCode = lastRes?.data?.submission?.code;
          if (normalizeCode(lastCode)) {
            lastSuccessRef.current = lastCode;
            return lastCode;
          }
        } catch {
          return null;
        }
        return null;
      };

      const lastSubmittedCode = await resolveLastSubmittedCode();
      const lastSubmittedNormalized = normalizeCode(lastSubmittedCode);
      const hasManualSubmission = Boolean(lastSubmittedNormalized);

      if (!studentCode.trim()) {
        if (hasManualSubmission) {
          finishWithMessage(MESSAGE_PHASE1_SUBMITTED);
          return true;
        }
        finishWithMessage(MESSAGE_PHASE1_NO_SUBMISSION_INVALID);
        return false;
      }

      let runOutcome;
      if (!runCode || !matchSettingId) {
        runOutcome = { success: false };
      } else {
        try {
          runOutcome = await runCode({
            matchSettingId,
            code: assembledCode,
            language: 'cpp',
          });
        } catch {
          runOutcome = { success: false };
        }
      }

      const runSuccess = runOutcome?.success === true;
      const runCompiled =
        runOutcome?.data?.isCompiled !== undefined
          ? runOutcome.data.isCompiled
          : runOutcome?.isCompiled;
      const runPassed =
        runOutcome?.data?.isPassed !== undefined
          ? runOutcome.data.isPassed
          : runOutcome?.isPassed;

      if (!runSuccess || runCompiled === false || !runPassed) {
        if (hasManualSubmission) {
          finishWithMessage(MESSAGE_PHASE1_SUBMITTED);
          return true;
        }
        finishWithMessage(MESSAGE_PHASE1_NO_SUBMISSION_INVALID);
        return false;
      }

      const submissionRes = await submitSubmission({
        matchId: resolvedMatchId,
        code: assembledCode,
        isAutomatic: true,
      });

      if (submissionRes?.success) {
        const isFinalSubmission =
          submissionRes?.data?.submission?.isFinal === true;
        if (hasManualSubmission) {
          finishWithMessage(
            isFinalSubmission
              ? MESSAGE_PHASE1_SUBMITTED_AUTO_BETTER
              : MESSAGE_PHASE1_SUBMITTED
          );
        } else {
          finishWithMessage(MESSAGE_PHASE1_NO_SUBMISSION_VALID);
        }
        lastSuccessRef.current = assembledCode;
        if (studentId) {
          dispatch(
            setLastSuccessfulCode({
              userId: studentId,
              key: persistKey,
              imports,
              studentCode,
              signature: challengeSignature,
            })
          );
        }
        return true;
      }

      if (hasManualSubmission) {
        finishWithMessage(MESSAGE_PHASE1_SUBMITTED);
        return true;
      }

      finishWithMessage(MESSAGE_PHASE1_NO_SUBMISSION_INVALID);
      return false;
    } catch (err) {
      finishWithMessage(MESSAGE_PHASE1_NO_SUBMISSION_INVALID);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    getStudentAssignedMatch,
    challengeId,
    studentId,
    storageKeyBase,
    studentCode,
    assembledCode,
    getLastSubmission,
    matchData,
    runCode,
    submitSubmission,
    dispatch,
    imports,
    challengeSignature,
  ]);

  useEffect(() => {
    if (!isPhaseOneOver) return;
    if (autoSubmitTriggeredRef.current) return;
    if (isTimeUp || isChallengeFinished || isSubmitting) return;
    autoSubmitTriggeredRef.current = true;
    handleTimerFinish();
  }, [
    autoSubmitTriggeredRef,
    handleTimerFinish,
    isChallengeFinished,
    isPhaseOneOver,
    isSubmitting,
    isTimeUp,
  ]);

  const handleTryAgain = useCallback(() => {
    setMessage(null);
    setError(null);
    setIsSubmittingActive(false);
    setRunResult(null);
    setTestResults([]);
  }, []);

  const handleImportsChange = useCallback((value) => {
    setImports(value);
    setImportsWarning('');
  }, []);

  const handleImportsBlur = useCallback(
    (event) => {
      const { invalidLines } = analyzeImports(event.target.value);
      if (invalidLines.length > 0) {
        const suffix = invalidLines.length === 1 ? '' : 's';
        setImportsWarning(
          `Found ${invalidLines.length} non-#include line${suffix}.`
        );
      } else {
        setImportsWarning('');
      }
    },
    [setImportsWarning]
  );

  const handleClean = useCallback(() => {
    setImports(defaultImports);
    setStudentCode('');
    setImportsWarning('');
    setRunResult(null);
    setTestResults([]);
    setIsCompiled(null);
    setCanSubmit(false);
    setIsSubmittingActive(false);
    setMessage(null);
    setError(null);
  }, [defaultImports]);

  const handleRestore = useCallback(() => {
    if (!savedLastCompiledSnapshot) return;
    const restoredImports = savedLastCompiledSnapshot.imports || defaultImports;
    const restoredStudentCode = savedLastCompiledSnapshot.studentCode || '';
    if (!restoredImports.trim() && !restoredStudentCode.trim()) return;
    setImports(restoredImports);
    setStudentCode(restoredStudentCode);
    setImportsWarning('');
    setRunResult(null);
    setTestResults([]);
    setIsCompiled(null);
    setCanSubmit(false);
    setIsSubmittingActive(false);
    setMessage(null);
    setError(null);
  }, [savedLastCompiledSnapshot, defaultImports]);

  const hasRestorableCode = Boolean(
    savedLastCompiledSnapshot?.imports?.trim() ||
    savedLastCompiledSnapshot?.studentCode?.trim()
  );
  const showDraftSaveState = matchData ? draftSaveState : null;

  return (
    <MatchView
      loading={loading}
      error={error}
      message={message}
      challengeId={challengeId}
      isWaitingForStart={isWaitingForStart}
      matchData={matchData}
      imports={imports}
      onImportsChange={handleImportsChange}
      onImportsBlur={handleImportsBlur}
      importsWarning={importsWarning}
      studentCode={studentCode}
      onStudentCodeChange={setStudentCode}
      fixedPrefix={fixedPrefix}
      fixedSuffix={fixedSuffix}
      finalCode={assembledCode}
      isRunning={isRunning}
      isSubmitting={isSubmitting}
      isSubmittingActive={isSubmittingActive}
      peerReviewNotice={matchData?.peerReviewBlockedMessage || null}
      peerReviewPendingMessage={peerReviewPendingMessage}
      runResult={runResult}
      onRun={handleRun}
      onSubmit={handleSubmit}
      customTests={customTests}
      customTestResults={customTestResults}
      customRunResult={customRunResult}
      isCustomRunning={isCustomRunning}
      customRunOrder={customRunOrder}
      onCustomTestAdd={addCustomTest}
      onCustomTestChange={updateCustomTest}
      onCustomTestRemove={removeCustomTest}
      onRunCustomTests={handleRunCustomTests}
      isTimeUp={isTimeUp}
      onTimerFinish={handleTimerFinish}
      testResults={testResults}
      canSubmit={canSubmit}
      isCompiled={isCompiled}
      isChallengeFinished={isChallengeFinished}
      draftSaveState={showDraftSaveState}
      onTryAgain={handleTryAgain}
      onClean={handleClean}
      onRestore={handleRestore}
      hasRestorableCode={hasRestorableCode}
    />
  );
}
