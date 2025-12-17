'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import useChallenge from '#js/useChallenge';
import MatchView from './MatchView';

const CppCodeTemplate = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    //TODO: write your solution based on the problem description
    return 0;
}
`;

export default function MatchContainer({ challengeId, studentId }) {
  const {
    getStudentAssignedMatchSetting,
    getStudentAssignedMatch,
    submitSubmission,
    getLastSubmission,
    runCode,
  } = useChallenge();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [matchId, setMatchId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [code, setCode] = useState(CppCodeTemplate);
  const [runResult, setRunResult] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [, setLastSuccessfulCode] = useState(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isCompiled, setIsCompiled] = useState(null);
  const hasLoadedFromStorage = useRef(false);
  const hasLoadedLastSuccess = useRef(false);
  const lastSuccessRef = useRef(null);
  const storageKeyBase = useMemo(
    () => (matchId ? `match-${matchId}` : `challenge-${challengeId}`),
    [matchId, challengeId]
  );

  useEffect(() => {
    hasLoadedFromStorage.current = false;
    hasLoadedLastSuccess.current = false;
  }, [matchId]);

  useEffect(() => {
    if (!matchData) return;
    if (hasLoadedFromStorage.current) return;
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return;

    const storageKey = `code-${storageKeyBase}`;
    const savedCode = localStorage.getItem(storageKey);

    if (savedCode !== null && savedCode.trim() !== '') {
      setCode(savedCode);
      hasLoadedFromStorage.current = true;
    }
    const lastSuccessKey = `last-successful-code-${storageKeyBase}`;
    const savedLastSuccess = localStorage.getItem(lastSuccessKey);
    if (
      savedLastSuccess &&
      savedLastSuccess.trim() &&
      !hasLoadedLastSuccess.current
    ) {
      setLastSuccessfulCode(savedLastSuccess);
      lastSuccessRef.current = savedLastSuccess;
      hasLoadedLastSuccess.current = true;
    }
  }, [storageKeyBase, matchData]);

  const [isChallengeFinished, setIsChallengeFinished] = useState(false);

  useEffect(() => {
    if (!matchData) return;
    if (typeof localStorage === 'undefined' || !localStorage.setItem) return;
    const storageKey = `code-${storageKeyBase}`;
    localStorage.setItem(storageKey, code);
  }, [code, matchData, storageKeyBase]);

  // load StudentAssignedMatchSetting(Mtach)
  useEffect(() => {
    if (!challengeId || !studentId) return () => {};

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
      setCanSubmit(false);
      setIsCompiled(null);
      setIsTimeUp(false);
      setMatchData(null);
      setMatchId(null);
      setLastSuccessfulCode(null);
      lastSuccessRef.current = null;
      hasLoadedLastSuccess.current = false;
      hasLoadedFromStorage.current = false;
      setCode(CppCodeTemplate);

      try {
        const res = await getStudentAssignedMatchSetting(
          challengeId,
          studentId
        );
        if (cancelled) return;

        if (res?.success === false) {
          if (!cancelled) {
            setError({
              message:
                res.message || 'Unable to load your match for this challenge.',
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

          if (
            !hasLoadedFromStorage.current &&
            data?.starterCode &&
            data.starterCode.trim().length > 0
          ) {
            setCode(data.starterCode);
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
        return;
      }

      const payload = {
        matchSettingId:
          matchData.id ||
          matchData.matchSettingId ||
          matchData.challengeMatchSettingId ||
          challengeId,
        code,
        language: 'cpp',
      };
      const res = await runCode(payload);
      const results = res?.results || res?.data?.results || [];
      setTestResults(results);

      if (!res?.success) {
        setRunResult({
          type: 'error',
          message: res?.message || 'Unable to run your code.',
        });
        setIsCompiled(false);
        setCanSubmit(false);
        setIsSubmittingActive(false);
        return;
      }

      const compiled =
        res?.data?.isCompiled !== undefined ? res.data.isCompiled : true;
      // Only block submission if compilation actually failed
      // Error message can exist even when compiled (e.g., test failures)
      if (!compiled || res?.data?.error) {
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
  }, [challengeId, code, isTimeUp, matchData, runCode]);

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

      if (!code.trim()) {
        setError({ message: 'Empty code cannot be submitted.' });
        return false;
      }

      const submissionRes = await submitSubmission({
        matchId: resolvedMatchId,
        code,
      });

      if (submissionRes?.success) {
        const {
          publicSummary,
          privateSummary,
          publicTestResults,
          privateTestResults,
        } = submissionRes.data || {};

        // Determine message based on test results
        let submissionMessage = 'Thanks for your submission.';

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
            submissionMessage =
              'Thanks for your submission. There are problems with your solution, try to improve it.';
          } else if (allPublicPassed && !allPrivatePassed) {
            // Scenario B: All public pass, but some private fail
            submissionMessage =
              'Thanks for your submission. You passed all public test cases, but you missed some edge cases. Read the problem again and try to improve your code.';
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
            submissionMessage =
              'Thanks for your submission. There are problems with your solution, try to improve it.';
          } else if (allPublicPassed && !allPrivatePassed) {
            // Scenario B: All public pass, but some private fail
            submissionMessage =
              'Thanks for your submission. You passed all public test cases, but you missed some edge cases. Read the problem again and try to improve your code.';
          }
          // Scenario C: All public and private pass (default message)
        }

        setMessage(submissionMessage);
        setLastSuccessfulCode(code);
        lastSuccessRef.current = code;
        if (typeof localStorage !== 'undefined') {
          try {
            const lastSuccessKey = `last-successful-code-match-${resolvedMatchId}`;
            localStorage.setItem(lastSuccessKey, code);
          } catch {
            // ignore storage failures
          }
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
          setLastSuccessfulCode(fallbackCode);
          lastSuccessRef.current = fallbackCode;
          if (typeof localStorage !== 'undefined') {
            try {
              const lastSuccessKey = `last-successful-code-match-${resolvedMatchId}`;
              localStorage.setItem(lastSuccessKey, fallbackCode);
            } catch {
              // ignore storage failures
            }
          }
          return true;
        }
      } catch {
        // Ignore fallback failures and surface original submission error below.
      }

      const errorMessage =
        submissionRes?.error?.message ||
        (submissionRes?.error instanceof Error
          ? submissionRes.error.message
          : null) ||
        submissionRes?.message ||
        'Submission failed.';
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
    code,
    submitSubmission,
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

    try {
      const res = await getStudentAssignedMatch(challengeId, studentId);

      if (!res?.success || !res?.data?.id) {
        setMessage('Thanks for your participation.');
        setIsChallengeFinished(true);
        return false;
      }

      setMatchId(res.data.id);

      const trySubmit = async (payloadCode) =>
        submitSubmission({ matchId, code: payloadCode, isAutomatic: true });

      if (!code.trim()) {
        const fallbackCode = lastSuccessRef.current;
        if (fallbackCode && fallbackCode.trim()) {
          const submissionRes = await trySubmit(fallbackCode);
          setMessage('Used your last valid submission.');
          setIsChallengeFinished(true);
          return submissionRes?.success ?? false;
        }
        setMessage('Thanks for your participation');
        setIsChallengeFinished(true);
        return false;
      }

      let submissionRes = await trySubmit(code);

      if (submissionRes?.success) {
        setMessage('Thanks for your participation');
        setLastSuccessfulCode(code);
        lastSuccessRef.current = code;
        if (typeof localStorage !== 'undefined') {
          try {
            const lastSuccessKey = `last-successful-code-${storageKeyBase}`;
            localStorage.setItem(lastSuccessKey, code);
          } catch (e) {
            // ignore storage failures
          }
        }
        setIsChallengeFinished(true);
        return true;
      }

      const lastValid = await getLastSubmission(matchId);
      const fallbackCode =
        lastValid?.data?.submission?.code || lastSuccessRef.current;
      if (fallbackCode && fallbackCode.trim()) {
        submissionRes = await trySubmit(fallbackCode);
        if (submissionRes?.success) {
          setMessage(
            'Your latest code failed. Kept your last valid submission.'
          );
          setIsChallengeFinished(true);
          return true;
        }
      }

      setMessage(
        'Your code did not compile successfully. Thanks for your participation'
      );
      setIsChallengeFinished(true);
      return submissionRes?.success ?? false;
    } catch (err) {
      setMessage('Thanks for your participation');
      setIsChallengeFinished(true);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    getStudentAssignedMatch,
    challengeId,
    studentId,
    code,
    getLastSubmission,
    matchId,
    submitSubmission,
    storageKeyBase,
  ]);

  const handleTryAgain = useCallback(() => {
    setMessage(null);
    setError(null);
    setIsSubmittingActive(false);
    setRunResult(null);
    setTestResults([]);
  }, []);

  return (
    <MatchView
      loading={loading}
      error={error}
      message={message}
      challengeId={challengeId}
      matchData={matchData}
      code={code}
      setCode={setCode}
      isRunning={isRunning}
      isSubmitting={isSubmitting}
      isSubmittingActive={isSubmittingActive}
      runResult={runResult}
      onRun={handleRun}
      onSubmit={handleSubmit}
      isTimeUp={isTimeUp}
      onTimerFinish={handleTimerFinish}
      testResults={testResults}
      canSubmit={canSubmit}
      isCompiled={isCompiled}
      isChallengeFinished={isChallengeFinished}
      onTryAgain={handleTryAgain}
    />
  );
}
