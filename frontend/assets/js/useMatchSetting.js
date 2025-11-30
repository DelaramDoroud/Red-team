'use client';

import { useCallback } from 'react';
import useFetchData from '#js/useFetchData';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api/rest';

export default function useMatchSettings() {
  const { fetchData, loading } = useFetchData();

  const getMatchSettingsReady = useCallback(async () => {
    const url = `${API_BASE}/matchSettingsReady`;
    return fetchData(url);
  }, [fetchData]);

  return {
    loading,
    getMatchSettingsReady,
  };
}
