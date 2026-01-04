import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ChallengeList from '#modules/challenge/list';

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

// Create stable mock functions outside the mock factory
const mockGetChallenges = vi.fn(async () => [
  {
    id: 1,
    title: 'Demo challenge',
    duration: 30,
    startDatetime: '2025-01-01T10:00:00.000Z',
    status: 'draft',
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
        status: 'draft',
      },
    ]);
    mockGetChallengeParticipants.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  it('renders challenges coming from useChallenge', async () => {
    render(<ChallengeList />);

    expect(
      await screen.findByText(/Demo challenge/i, {}, { timeout: 5000 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Duration/i)).toBeInTheDocument();
  }, 10000);
});
