import { useAppDispatch } from '#js/store/hooks';
import { clearUser } from '#js/store/slices/auth';
import { useCallback, useState } from 'react';

const useFetchData = () => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);

  const handleResponse = useCallback(
    async (response) => {
      if (response.status === 401) {
        dispatch(clearUser());
        window.location = '/login';
        return { error: 'User not logged in' };
      }
      if (response.status >= 400) {
        const error = await response.text();
        throw new Error(`Network response was not ok: ${error}`);
      }
      return response.json();
    },
    // dispatch is stable from Redux and doesn't need to be in dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const fetchData = useCallback(
    async (url, options = {}) => {
      setLoading(true);
      try {
        const response = await fetch(url, {
          credentials: 'include',
          ...options,
        });
        const data = await handleResponse(response);
        setLoading(false);
        return data;
      } catch (err) {
        setLoading(false);
        if (err.name === 'AbortError') throw err;
        return {
          success: false,
          message: err.message || 'Request failed',
          error: err,
        };
      }
    },
    [handleResponse]
  );

  return { fetchData, loading };
};

export default useFetchData;
