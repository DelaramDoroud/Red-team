'use client';

import { useEffect, useState, useCallback } from 'react';
import useChallenge from '#js/useChallenge';
import MatchView from './MatchView';

export default function MatchContainer({ challengeId, studentId }) {
  const { getStudentAssignedMatchSetting, runCode } = useChallenge();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [error, setError] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [code, setCode] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isCompiled, setIsCompiled] = useState(null);

  useEffect(() => {
    if (!matchData?.id) return;

    const savedCode = localStorage.getItem(`code-${matchData.id}`);
    if (savedCode !== null) {
      setCode(savedCode);
    }
  }, [matchData?.id]);
  useEffect(() => {
    if (!matchData?.id) return;

    localStorage.setItem(`code-${matchData.id}`, code);
  }, [code, matchData?.id]);

  // load StudentAssignedMatchSetting(Mtach)
  useEffect(() => {
    if (!challengeId || !studentId) return () => {};

    let cancelled = false;

    async function fetchMatch() {
      setLoading(true);
      setError(null);
      setMatchData(null);

      try {
        const res = await getStudentAssignedMatchSetting(
          challengeId,
          studentId
        );
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

          const starter =
            data?.starterCode && data.starterCode.trim().length > 0
              ? data.starterCode
              : CppCodeTemplate;

          setCode(starter);
        }
      } catch (_err) {
        if (!cancelled) {
          setError({
            message: 'Network error while loading your match.try again.',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMatch();

    return () => {
      cancelled = true;
    };
  }, [challengeId, studentId, getStudentAssignedMatchSetting]);

  // handlers: run
  const handleRun = useCallback(async () => {
    setRunResult({ type: 'info', message: 'Running your code...' });
    setIsRunning(true);
    setCanSubmit(false);
    setIsCompiled(null);
    try {
      const payload = {
        matchSettingId: matchData.id,
        code,
        language: 'cpp',
      };
      const res = await runCode(payload);
      setTestResults(res.results || []);
      if (res.data.error) {
        setRunResult({
          type: 'error',
          message: res.data.error,
        });
        setIsCompiled(false);
        setCanSubmit(false);
        return;
      }
      setRunResult({
        type: 'success',
        message: 'Your code compiled successfully.',
      });
      setIsCompiled(true);
      setCanSubmit(true);
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
  }, [code, matchData, runCode]);

  const handleSubmit = useCallback(() => {
    setIsSubmitting(false);
  }, []);

  // onRunClick wrapper to check code presence
  const onRunClick = useCallback(() => {
    if (!code || code.trim() === '') {
      setRunResult({
        type: 'error',
        message: 'There is no code to run.',
      });
      return;
    }
    handleRun();
  }, [code, handleRun]);

  const handleTimerFinish = useCallback(() => {
    setIsTimeUp(true);
    setCanSubmit(false);
    setIsRunning(false);
    setIsSubmitting(false);
    setRunResult({
      type: 'error',
      message: 'Time is up. You can no longer run or submit code.',
    });
  }, []);
  return (
    <MatchView
      loading={loading}
      error={error}
      challengeId={challengeId}
      matchData={matchData}
      code={code}
      setCode={setCode}
      isRunning={isRunning}
      isSubmitting={isSubmitting}
      runResult={runResult}
      onRun={onRunClick}
      onSubmit={handleSubmit}
      isTimeUp={isTimeUp}
      onTimerFinish={handleTimerFinish}
      testResults={testResults}
      canSubmit={canSubmit}
      isCompiled={isCompiled}
    />
  );
}
