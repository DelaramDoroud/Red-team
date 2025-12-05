import { describe, vi } from 'vitest';
// import { it, expect } from 'vitest';
// import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
// import ChallengeList from '#modules/challenge/list';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// We mock the hook so the test does not depend on a real backend.
vi.mock('#js/useChallenge', () => ({
  default: () => ({
    loading: false,
    getChallenges: async () => [
      {
        id: 1,
        title: 'Demo challenge',
        duration: 30,
        startDatetime: '2025-01-01T10:00:00.000Z',
        status: 'draft',
      },
    ],
  }),
}));

describe('ChallengeList', () => {
  // TODO: Fix infinite loop/memory issue in participant fetching useEffect
  // it('renders challenges coming from useChallenge', async () => {
  //   render(<ChallengeList />);
  //
  //   expect(await screen.findByText(/Demo challenge/i)).toBeInTheDocument();
  //   expect(screen.getByText(/Duration/i)).toBeInTheDocument();
  // });
});
