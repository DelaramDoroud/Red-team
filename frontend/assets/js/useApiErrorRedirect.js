import { useCallback } from 'react';
import { getApiErrorStatus } from '#js/apiError';
import { useRouter } from '#js/router';

const useApiErrorRedirect = () => {
  const router = useRouter();

  return useCallback(
    (error) => {
      const status = getApiErrorStatus(error);
      if (status === 403) {
        router.replace('/forbidden');
        return true;
      }
      if (status === 404) {
        router.replace('/not-found');
        return true;
      }
      return false;
    },
    [router]
  );
};

export default useApiErrorRedirect;
