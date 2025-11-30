'use client';

import { useCallback } from 'react';
import useFetchData from '#js/useFetchData';
import * as Constants from '#js/constants';

const API_BASE = Constants.API_BACKEND;

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
