'use client';

import { useCallback, useMemo } from 'react';
import { API_REST_BASE } from '#js/constants';
import useFetchData from '#js/useFetchData';

export default function useRewards() {
  const { fetchData, loading } = useFetchData();
  const getRules = useCallback(async () => {
    const url = `${API_REST_BASE}/rules`;
    return fetchData(url);
  }, [fetchData]);

  return useMemo(
    () => ({
      loading,
      getRules,
    }),
    [loading, getRules]
  );
}
