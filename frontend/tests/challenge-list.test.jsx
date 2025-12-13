import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ChallengeList from '#modules/challenge/list';
import userEvent from '@testing-library/user-event';

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
const mockStartChallenge = vi.fn();

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
    startChallenge: mockStartChallenge,
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

describe('ChallengeList – start challenge flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetChallenges.mockResolvedValue([
      {
        id: 1,
        title: 'Demo challenge',
        duration: 30,
        startDatetime: '2025-01-01T10:00:00.000Z',
        status: 'assigned',
      },
    ]);

    mockGetChallengeParticipants.mockResolvedValue({
      success: true,
      data: [{ id: 99, name: 'Delaram' }], // student joined
    });

    mockStartChallenge.mockResolvedValue({
      success: true,
      status: 'started',
    });
  });

  it('starts a challenge and updates UI accordingly', async () => {
    render(<ChallengeList />);

    // Challenge should be visible
    expect(await screen.findByText(/demo challenge/i)).toBeInTheDocument();

    // Start button should be available
    const startButton = await screen.findByRole('button', { name: /start/i });
    expect(startButton).toBeInTheDocument();

    // Teacher clicks Start
    await userEvent.click(startButton);

    // Backend mock should be called
    expect(mockStartChallenge).toHaveBeenCalledWith(1);

    // Start button should disappear
    expect(
      screen.queryByRole('button', { name: /start/i })
    ).not.toBeInTheDocument();

    // UI must show “challenge is in progress”
    expect(screen.getByText(/challenge is in progress/i)).toBeInTheDocument();
  });
});
