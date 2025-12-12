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
  const { getStudentAssignedMatchSetting } = useChallenge();

  const [loading, setLoading] = useState(true);
  const [matchData, setMatchData] = useState(null);
  const [error, setError] = useState(null);

  const [code, setCode] = useState(CppCodeTemplate);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResult, setRunResult] = useState(null);

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
    setIsRunning();
  }, []);

  const handleSubmit = useCallback(() => {
    setIsSubmitting();
  }, []);
  const handleTimerFinish = useCallback(() => {
    // console.log('timer reaches zero');
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
      onRun={handleRun}
      onSubmit={handleSubmit}
      onTimerFinish={handleTimerFinish}
    />
  );
}
