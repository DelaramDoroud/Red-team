import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChallengeDetailPage from '../app/challenges/[id]/page';

const mockGetChallengeMatches = vi.fn();
const mockAssignChallenge = vi.fn();
const mockGetChallengeParticipants = vi.fn();
const mockStartChallenge = vi.fn();
const mockAssignPeerReviews = vi.fn();
const mockUpdateExpectedReviews = vi.fn();
const mockStartPeerReview = vi.fn();
const mockDispatch = vi.fn(() => Promise.resolve());

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getChallengeMatches: mockGetChallengeMatches,
    assignChallenge: mockAssignChallenge,
    getChallengeParticipants: mockGetChallengeParticipants,
    startChallenge: mockStartChallenge,
    assignPeerReviews: mockAssignPeerReviews,
    updateExpectedReviews: mockUpdateExpectedReviews,
    startPeerReview: mockStartPeerReview,
  }),
}));

vi.mock('#js/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector) =>
    selector({
      auth: {
        user: { id: 1, role: 'teacher' },
        isLoggedIn: true,
        loading: false,
      },
    }),
  useAppStore: () => ({}),
}));

vi.mock('#js/store/slices/auth', () => ({
  fetchUserInfo: () => async () => ({}),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '123' }),
  usePathname: () => '/challenges/123',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('ChallengeDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChallengeMatches.mockResolvedValue({
      success: true,
      challenge: {
        id: 123,
        title: 'Sample Challenge',
        status: 'public',
        startDatetime: new Date(Date.now() - 1000).toISOString(),
        duration: 30,
        durationPeerReview: 15,
        allowedNumberOfReview: 2,
        peerReviewReady: false,
      },
      assignments: [],
    });
    mockAssignChallenge.mockResolvedValue({ success: true });
    mockGetChallengeParticipants.mockResolvedValue({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
    });
    mockStartChallenge.mockResolvedValue({ success: true });
    mockAssignPeerReviews.mockResolvedValue({ success: true, results: [] });
    mockUpdateExpectedReviews.mockResolvedValue({ success: true });
    mockStartPeerReview.mockResolvedValue({ success: true });
  });

  it('renders Assign students button and triggers assignment + reload', async () => {
    render(<ChallengeDetailPage />);

    await waitFor(() => expect(mockGetChallengeMatches).toHaveBeenCalled());

    const assignBtn = screen.getByRole('button', {
      name: /assign students/i,
    });
    expect(assignBtn).toBeInTheDocument();

    fireEvent.click(assignBtn);

    await waitFor(() =>
      expect(mockAssignChallenge).toHaveBeenCalledWith('123')
    );
    await waitFor(() =>
      expect(mockGetChallengeMatches.mock.calls.length).toBeGreaterThan(1)
    );
  });

  it('hides assign button when challenge is not public', async () => {
    mockGetChallengeMatches.mockResolvedValue({
      success: true,
      challenge: {
        id: 123,
        title: 'Sample Challenge',
        status: 'assigned',
        startDatetime: new Date().toISOString(),
        duration: 30,
        durationPeerReview: 15,
        allowedNumberOfReview: 2,
        peerReviewReady: false,
      },
      assignments: [],
    });
    render(<ChallengeDetailPage />);

    await waitFor(() => expect(mockGetChallengeMatches).toHaveBeenCalled());

    const assignButtons = screen.queryAllByRole('button', {
      name: /assign students/i,
    });
    expect(assignButtons.length).toBe(0);
  });

  it('shows validation error when expected reviews is invalid', async () => {
    mockGetChallengeMatches.mockResolvedValue({
      success: true,
      challenge: {
        id: 123,
        title: 'Sample Challenge',
        status: 'ended_phase_one',
        startDatetime: new Date().toISOString(),
        duration: 30,
        durationPeerReview: 15,
        allowedNumberOfReview: 1,
        peerReviewReady: false,
      },
      assignments: [],
    });

    render(<ChallengeDetailPage />);

    await waitFor(() => expect(mockGetChallengeMatches).toHaveBeenCalled());

    const assignBtn = screen.getByRole('button', { name: /assign/i });
    fireEvent.click(assignBtn);

    expect(
      screen.getByText(/whole number greater than or equal to 2/i)
    ).toBeInTheDocument();
    expect(mockAssignPeerReviews).not.toHaveBeenCalled();
  });

  it('shows Start Peer Review button when assignments are ready', async () => {
    mockGetChallengeMatches.mockResolvedValue({
      success: true,
      challenge: {
        id: 123,
        title: 'Sample Challenge',
        status: 'ended_phase_one',
        startDatetime: new Date().toISOString(),
        duration: 30,
        durationPeerReview: 15,
        allowedNumberOfReview: 2,
        peerReviewReady: true,
      },
      assignments: [],
    });

    render(<ChallengeDetailPage />);

    await waitFor(() => expect(mockGetChallengeMatches).toHaveBeenCalled());

    expect(
      screen.getByRole('button', { name: /start peer review/i })
    ).toBeInTheDocument();
  });

  it('starts peer review when Start Peer Review is clicked', async () => {
    mockGetChallengeMatches.mockResolvedValue({
      success: true,
      challenge: {
        id: 123,
        title: 'Sample Challenge',
        status: 'ended_phase_one',
        startDatetime: new Date().toISOString(),
        duration: 30,
        durationPeerReview: 15,
        allowedNumberOfReview: 2,
        peerReviewReady: true,
      },
      assignments: [],
    });

    render(<ChallengeDetailPage />);

    await waitFor(() => expect(mockGetChallengeMatches).toHaveBeenCalled());

    const startButton = screen.getByRole('button', {
      name: /start peer review/i,
    });
    fireEvent.click(startButton);

    await waitFor(() =>
      expect(mockStartPeerReview).toHaveBeenCalledWith('123')
    );
  });
});
