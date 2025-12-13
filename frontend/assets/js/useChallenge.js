'use client';

import { useCallback } from 'react';
import useFetchData from '#js/useFetchData';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/rest';

export default function useChallenge() {
  const { fetchData, loading } = useFetchData();

  const getChallenges = useCallback(async () => {
    const url = `${API_BASE}/challenges`;
    return fetchData(url);
  }, [fetchData]);

  const getChallengeMatches = useCallback(
    async (challengeId) => {
      const url = `${API_BASE}/challenges/${challengeId}/matches`;
      return fetchData(url);
    },
    [fetchData]
  );

  const getChallengeParticipants = useCallback(
    async (challengeId) => {
      const url = `${API_BASE}/challenges/${challengeId}/participants`;
      return fetchData(url);
    },
    [fetchData]
  );

  const joinChallenge = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_BASE}/challenges/${challengeId}/join`;
      return fetchData(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
    },
    [fetchData]
  );

  const createChallenge = useCallback(
    async (payload) => {
      const url = `${API_BASE}/challenges`;
      return fetchData(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },
    [fetchData]
  );

  const publishChallenge = useCallback(
    async (id) => {
      const url = `${API_BASE}/challenges/${id}/publish`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );

  const assignChallenge = useCallback(
    async (challengeId, overwrite = false) => {
      const searchParams = overwrite ? '?overwrite=true' : '';
      const url = `${API_BASE}/challenges/${challengeId}/assign${searchParams}`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );

  const startChallenge = useCallback(
    async (challengeId) => {
      const url = `${API_BASE}/challenges/${challengeId}/start`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );
  const getChallengeForJoinedStudent = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_BASE}/challenges/${challengeId}/for-student?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const getStudentAssignedMatchSetting = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_BASE}/challenges/${challengeId}/matchSetting?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const unpublishChallenge = useCallback(
    async (id) => {
      const url = `${API_BASE}/challenges/${id}/unpublish`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );

  const runCode = useCallback(
    async ({ matchSettingId, code, language }) => {
      console.log("dffffff");
      
      const url = `${API_BASE}/run`;
      return fetchData(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchSettingId,
          code,
          language,
        }),
      });
    },
    [fetchData]
  );

  return {
    loading,
    getChallenges,
    getChallengeMatches,
    getChallengeParticipants,
    joinChallenge,
    createChallenge,
    publishChallenge,
    assignChallenge,
    unpublishChallenge,
    startChallenge,
    getChallengeForJoinedStudent,
    getStudentAssignedMatchSetting,
    runCode,
  };
}
