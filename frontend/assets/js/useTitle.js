import { useCallback, useMemo } from 'react';
import { API_REST_BASE } from '#js/constants';
import useFetchData from '#js/useFetchData';

export default function useTitle() {
  const { fetchData, loading } = useFetchData();

  const evaluateTitle = useCallback(async () => {
    const url = `${API_REST_BASE}/rewards/evaluate-title`;
    return fetchData(url, { method: 'POST' });
  }, [fetchData]);

  return useMemo(
    () => ({
      loading,
      evaluateTitle,
    }),
    [loading, evaluateTitle]
  );
}
