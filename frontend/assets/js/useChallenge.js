'use client';

import { useCallback, useMemo } from 'react';
import useFetchData from '#js/useFetchData';
import { API_REST_BASE } from '#js/constants';

export default function useChallenge() {
  const { fetchData, loading } = useFetchData();

  const getChallenges = useCallback(async () => {
    const url = `${API_REST_BASE}/challenges`;
    return fetchData(url);
  }, [fetchData]);

  const getChallengeMatches = useCallback(
    async (challengeId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/matches`;
      return fetchData(url);
    },
    [fetchData]
  );

  const getChallengeParticipants = useCallback(
    async (challengeId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/participants`;
      return fetchData(url);
    },
    [fetchData]
  );

  const joinChallenge = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/join`;
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
      const url = `${API_REST_BASE}/challenges`;
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
      const url = `${API_REST_BASE}/challenges/${id}/publish`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );

  const assignChallenge = useCallback(
    async (challengeId, overwrite = false) => {
      const searchParams = overwrite ? '?overwrite=true' : '';
      const url = `${API_REST_BASE}/challenges/${challengeId}/assign${searchParams}`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );

  const startChallenge = useCallback(
    async (challengeId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/start`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );
  const assignPeerReviews = useCallback(
    async (challengeId, expectedReviewsPerSubmission) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/peer-reviews/assign`;
      return fetchData(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedReviewsPerSubmission }),
      });
    },
    [fetchData]
  );
  const updateExpectedReviews = useCallback(
    async (challengeId, expectedReviewsPerSubmission) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/expected-reviews`;
      return fetchData(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedReviewsPerSubmission }),
      });
    },
    [fetchData]
  );
  const startPeerReview = useCallback(
    async (challengeId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/peer-reviews/start`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );
  const getStudentPeerReviewAssignments = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/peer-reviews/for-student?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const getPeerReviewSummary = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/peer-reviews/summary?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const getChallengeForJoinedStudent = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/for-student?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const getStudentAssignedMatchSetting = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/matchSetting?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const getStudentAssignedMatch = useCallback(
    async (challengeId, studentId) => {
      const url = `${API_REST_BASE}/challenges/${challengeId}/match?studentId=${studentId}`;
      return fetchData(url);
    },
    [fetchData]
  );
  const unpublishChallenge = useCallback(
    async (id) => {
      const url = `${API_REST_BASE}/challenges/${id}/unpublish`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );
  const submitSubmission = useCallback(
    async ({ matchId, code, isAutomatic = false, language = 'cpp' }) => {
      const url = `${API_REST_BASE}/submissions`;
      return fetchData(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          code,
          isAutomatic,
          is_automatic_submission: isAutomatic,
          language,
        }),
      });
    },
    [fetchData]
  );
  const getLastSubmission = useCallback(
    async (matchId) => {
      const url = `${API_REST_BASE}/submissions/last?matchId=${matchId}`;
      return fetchData(url);
    },
    [fetchData]
  );

  const runCode = useCallback(
    async ({ matchSettingId, code, language }) => {
      const url = `${API_REST_BASE}/run`;
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

  return useMemo(
    () => ({
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
      assignPeerReviews,
      updateExpectedReviews,
      startPeerReview,
      getStudentPeerReviewAssignments,
      getChallengeForJoinedStudent,
      getStudentAssignedMatchSetting,
      getStudentAssignedMatch,
      submitSubmission,
      getLastSubmission,
      runCode,
      getPeerReviewSummary,
    }),
    [
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
      assignPeerReviews,
      updateExpectedReviews,
      startPeerReview,
      getStudentPeerReviewAssignments,
      getChallengeForJoinedStudent,
      getStudentAssignedMatchSetting,
      getStudentAssignedMatch,
      submitSubmission,
      getLastSubmission,
      runCode,
      getPeerReviewSummary,
    ]
  );
}
