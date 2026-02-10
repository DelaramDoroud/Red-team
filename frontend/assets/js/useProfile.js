'use client';

import { useCallback, useMemo } from 'react';
import { API_REST_BASE } from '#js/constants';
import useFetchData from '#js/useFetchData';

export default function useProfile() {
  const { fetchData, loading } = useFetchData();
  const getProfile = useCallback(async () => {
    const url = `${API_REST_BASE}/students/me/profile`;
    return fetchData(url);
  }, [fetchData]);

  return useMemo(
    () => ({
      loading,
      getProfile,
    }),
    [loading, getProfile]
  );
}
