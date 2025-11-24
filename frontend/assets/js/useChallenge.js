'use client';

import { useCallback } from 'react';
import useFetchData from '#js/useFetchData';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/rest';

/**
 * Small wrapper around useFetchData that knows about the Challenge API.
 * This is the only domain-specific hook we expose from #js in this demo.
 */
export default function useChallenge() {
  const { fetchData, loading } = useFetchData();

  const getChallenges = useCallback(async () => {
    const url = `${API_BASE}/challenges`;
    return fetchData(url);
  }, [fetchData]);

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

  const unpublishChallenge = useCallback(
    async (id) => {
      const url = `${API_BASE}/challenges/${id}/unpublish`;
      return fetchData(url, { method: 'POST' });
    },
    [fetchData]
  );

  return {
    loading,
    getChallenges,
    createChallenge,
    publishChallenge,
    unpublishChallenge,
  };
}
