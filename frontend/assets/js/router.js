import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams as useRouteParams,
} from 'react-router-dom';

export const useParams = () => useRouteParams();

export const usePathname = () => useLocation().pathname;

export const useRouter = () => {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      push: (to) => navigate(to),
      replace: (to) => navigate(to, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => window.location.reload(),
      prefetch: () => Promise.resolve(),
    }),
    [navigate]
  );
};
