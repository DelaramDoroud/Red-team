'use client';

import { useCallback } from 'react';
import useFetchData from '#js/useFetchData';
import * as Constants from '#constants/Constants.js';

const API_BASE = Constants.API_BACKEND;

export default function useChallenge() {
  const { fetchData, loading } = useFetchData();

  const getChallenges = useCallback(async () => {
    const url = `${API_BASE}/challenges`;
    return fetchData(url);
  }, [fetchData]);

  const createChallenge = useCallback(
    async (payload) => {
      const url = `${API_BASE}/challenge`;
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
