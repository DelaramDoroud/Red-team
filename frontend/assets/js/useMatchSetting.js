'use client';

import { useCallback, useMemo } from 'react';
import useFetchData from '#js/useFetchData';
import { API_REST_BASE } from '#js/constants';

export default function useMatchSettings() {
  const { fetchData, loading } = useFetchData();

  const getMatchSettingsReady = useCallback(async () => {
    const url = `${API_REST_BASE}/matchSettingsReady`;
    return fetchData(url);
  }, [fetchData]);

  return useMemo(
    () => ({
      loading,
      getMatchSettingsReady,
    }),
    [loading, getMatchSettingsReady]
  );
}
