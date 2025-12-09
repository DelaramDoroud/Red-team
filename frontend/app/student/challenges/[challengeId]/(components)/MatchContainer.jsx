'use client';

import { useEffect, useState, useCallback } from 'react';
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
  } = useChallenge();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [code, setCode] = useState(CppCodeTemplate);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [isChallengeFinished] = useState(false); // setIsChallengeFinished

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
        // console.log(res);
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

  // handlers: run + submit
  const handleRun = useCallback(() => {
    setRunResult();
    setMessage(null);
    setIsRunning(true);
    setIsSubmittingActive(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setIsRunning(false);

    try {
      const res = await getStudentAssignedMatch(challengeId, studentId);

      if (res?.success && res?.data?.id) {
        const matchId = res.data.id;

        if (!code || code.trim() === '') {
          setError({ message: 'Empty code cannot be submitted.' });
          return;
        }

        const submissionRes = await submitSubmission({
          matchId,
          code,
        });

        if (submissionRes?.success) {
          setMessage('Submission successful!');
        } else {
          setError({
            message: submissionRes?.error?.message || 'Submission failed.',
          });
        }
      } else {
        setError({ message: 'No match found for submission.' });
      }
    } catch (_err) {
      setError({ message: `Error: ${_err.message}` });
    } finally {
      setIsSubmitting(false);
      setIsSubmittingActive(false);
    }
  }, [challengeId, studentId, code, getStudentAssignedMatch, submitSubmission]);

  const handleTimerFinish = useCallback(async () => {
    // setIsChallengeFinished(true);

    try {
      await handleSubmit();
    } catch (err) {
      setError({ message: `Error during auto-submit: ${err.message}` });
    }
  }, [handleSubmit]);

  return (
    <MatchView
      loading={loading}
      error={error}
      message={message}
      matchData={matchData}
      code={code}
      setCode={setCode}
      isRunning={isRunning}
      isSubmitting={isSubmitting}
      isSubmittingActive={isSubmittingActive}
      runResult={runResult}
      onRun={handleRun}
      onSubmit={handleSubmit}
      onTimerFinish={handleTimerFinish}
      isChallengeFinished={isChallengeFinished}
    />
  );
}
