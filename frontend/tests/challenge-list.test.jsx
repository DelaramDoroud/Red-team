import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ChallengeList from '#modules/challenge/list';

const mockDispatch = vi.fn();

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

vi.mock('#js/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector) =>
    selector({
      auth: { user: { id: 1, role: 'teacher' } },
      ui: { challengeCountdowns: {} },
    }),
  useAppStore: () => ({}),
}));

// Create stable mock functions outside the mock factory
const mockGetChallenges = vi.fn(async () => [
  {
    id: 1,
    title: 'Demo challenge',
    duration: 30,
    startDatetime: '2025-01-01T10:00:00.000Z',
    status: 'public',
  },
]);

const mockGetChallengeParticipants = vi.fn(async () => ({
  success: true,
  data: [],
}));

const mockAssignChallenge = vi.fn();
const mockAssignPeerReviews = vi.fn();
const mockStartPeerReview = vi.fn();

// Mock useFetchData to avoid Redux dependency
vi.mock('#js/useFetchData', () => ({
  default: () => ({
    fetchData: vi.fn(),
    loading: false,
  }),
}));

// We mock the hook so the test does not depend on a real backend.
vi.mock('#js/useChallenge', () => ({
  default: () => ({
    loading: false,
    getChallenges: mockGetChallenges,
    getChallengeParticipants: mockGetChallengeParticipants,
    assignChallenge: mockAssignChallenge,
    assignPeerReviews: mockAssignPeerReviews,
    startPeerReview: mockStartPeerReview,
    startChallenge: vi.fn(),
  }),
}));

describe('ChallengeList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChallenges.mockResolvedValue([
      {
        id: 1,
        title: 'Demo challenge',
        duration: 30,
        startDatetime: '2025-01-01T10:00:00.000Z',
        status: 'public',
      },
    ]);
    mockGetChallengeParticipants.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it('renders non-private challenges by default', async () => {
    render(<ChallengeList />);

    expect(
      await screen.findByText(/Demo challenge/i, {}, { timeout: 5000 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Duration/i)).toBeInTheDocument();
  }, 10000);

  it('renders private challenges in the private view', async () => {
    mockGetChallenges.mockResolvedValueOnce([
      {
        id: 2,
        title: 'Private challenge',
        duration: 45,
        startDatetime: '2025-02-01T10:00:00.000Z',
        status: 'private',
      },
    ]);

    render(<ChallengeList scope='private' />);

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Private challenge' },
        { timeout: 5000 }
      )
    ).toBeInTheDocument();
  }, 10000);
});
