import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ChallengeList from '#modules/challenge/list';

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
  it('renders challenges coming from useChallenge', async () => {
    render(<ChallengeList />);

    expect(await screen.findByText(/Demo challenge/i)).toBeInTheDocument();
    expect(screen.getByText(/Duration/i)).toBeInTheDocument();
  });
});
