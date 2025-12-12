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

  // runResult ora è una stringa
  const [runResult, setRunResult] = useState(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);

  const [isChallengeFinished] = useState(false);

  // Load match
  useEffect(() => {
    let cancelled = false;

    async function fetchMatch() {
      setMessage(null);
      setError(null);
      setRunResult(null);
      setIsRunning(false);
      setIsSubmitting(false);
      setIsSubmittingActive(false);
      setLoading(true);
      setMatchData(null);

      try {
        const res = await getStudentAssignedMatchSetting(
          challengeId,
          studentId
        );
        if (cancelled) return;

        if (res?.success === false) {
          setError({
            message:
              res.message || 'Unable to load your match for this challenge.',
            code: res.code,
          });
          return;
        }

        const { data } = res;
        setMatchData(data);

        const starter = data?.starterCode?.trim()
          ? data.starterCode
          : CppCodeTemplate;

        setCode(starter);
      } catch {
        if (!cancelled)
          setError({
            message: 'Network error while loading your match. Try again.',
          });
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

  // Run handler (runResult diventa stringa)
  const handleRun = useCallback(() => {
    setMessage(null);
    setRunResult(null);
    setError(null);
    setIsRunning(true);

    setTimeout(() => {
      setRunResult('Run completed (mock).'); // <-- Fix
      setIsRunning(false);
      setIsSubmittingActive(true);
    }, 300);
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setMessage(null);
    setError(null);
    setIsSubmitting(true);
    setIsSubmittingActive(true);

    try {
      const res = await getStudentAssignedMatch(challengeId, studentId);

      if (!res?.success || !res?.data?.id) {
        setError({ message: 'No match found for submission.' });
        return;
      }

      const matchId = res.data.id;

      if (!code.trim()) {
        setError({ message: 'Empty code cannot be submitted.' });
        return;
      }

      const submissionRes = await submitSubmission({ matchId, code });

      if (submissionRes?.success) {
        setMessage('Submission successful!');
      } else {
        setError({
          message: submissionRes?.error?.message || 'Submission failed.',
        });
      }
    } catch (err) {
      setError({ message: `Error: ${err.message}` });
    } finally {
      setIsSubmitting(false);
      setIsSubmittingActive(false);
    }
  }, [challengeId, studentId, code, getStudentAssignedMatch, submitSubmission]);

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
      isChallengeFinished={isChallengeFinished}
      challengeId={challengeId}
    />
  );
}
