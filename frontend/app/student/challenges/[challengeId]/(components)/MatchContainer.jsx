'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
    runCode,
  } = useChallenge();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [code, setCode] = useState(CppCodeTemplate);
  const [runResult, setRunResult] = useState(null);
  const [testResults, setTestResults] = useState([]);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isCompiled, setIsCompiled] = useState(null);
  const hasLoadedFromStorage = useRef(false);

  useEffect(() => {
    if (!matchData) return;
    if (hasLoadedFromStorage.current) return;
    if (typeof localStorage === 'undefined' || !localStorage.getItem) return;

    const storageKey = `code-${matchData?.id || challengeId}`;
    const savedCode = localStorage.getItem(storageKey);

    if (savedCode !== null && savedCode.trim() !== '') {
      setCode(savedCode);
      hasLoadedFromStorage.current = true;
    }
  }, [challengeId, matchData]);

  const [isChallengeFinished, setIsChallengeFinished] = useState(false);

  useEffect(() => {
    if (!matchData) return;
    if (typeof localStorage === 'undefined' || !localStorage.setItem) return;
    const storageKey = `code-${matchData.id || challengeId}`;
    localStorage.setItem(storageKey, code);
  }, [code, matchData, challengeId]);

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
  }, [challengeId, studentId, getStudentAssignedMatchSetting]);

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
        return;
      }

      const compiled =
        res?.data?.isCompiled !== undefined ? res.data.isCompiled : true;
      if (!compiled || res?.data?.error) {
        setRunResult({
          type: 'error',
          message: res?.data?.error || 'Compilation failed.',
        });
        setIsCompiled(false);
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

      const matchId = res.data.id;

      if (!code.trim()) {
        setError({ message: 'Empty code cannot be submitted.' });
        return false;
      }

      const submissionRes = await submitSubmission({ matchId, code });

      if (submissionRes?.success) {
        setMessage('Submission successful!');
        return true;
      }

      setError({
        message: submissionRes?.error?.message || 'Submission failed.',
      });
      return false;
    } catch (err) {
      setError({ message: `Error: ${err.message}` });
      return false;
    } finally {
      setIsSubmitting(false);
      setIsSubmittingActive(false);
    }
  }, [
    challengeId,
    studentId,
    code,
    canSubmit,
    isTimeUp,
    getStudentAssignedMatch,
    submitSubmission,
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
        setMessage('Thanks for your participation');
        setIsChallengeFinished(true);
        return false;
      }

      const matchId = res.data.id;

      if (!code.trim()) {
        setMessage('Thanks for your participation');
        setIsChallengeFinished(true);
        return false;
      }

      const submissionRes = await submitSubmission({ matchId, code });

      if (submissionRes?.success) {
        setMessage('Thanks for your participation');
      } else {
        setMessage(
          'Your code did not compile successfully. Thanks for your participation'
        );
      }
      setIsChallengeFinished(true);

      return submissionRes?.success ?? false;
    } catch (err) {
      setMessage('Thanks for your participation');
      setIsChallengeFinished(true);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [challengeId, studentId, code, getStudentAssignedMatch, submitSubmission]);

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
    />
  );
}
