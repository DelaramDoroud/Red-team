import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChallengeDetailPage from '../app/challenges/[id]/page';

const mockGetChallengeMatches = vi.fn();
const mockAssignChallenge = vi.fn();
const mockGetChallengeParticipants = vi.fn();
const mockDispatch = vi.fn(() => Promise.resolve());

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getChallengeMatches: mockGetChallengeMatches,
    assignChallenge: mockAssignChallenge,
    getChallengeParticipants: mockGetChallengeParticipants,
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
      },
      assignments: [],
    });
    mockAssignChallenge.mockResolvedValue({ success: true });
    mockGetChallengeParticipants.mockResolvedValue({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
    });
  });

  it('renders Assign students button and triggers assignment + reload', async () => {
    render(<ChallengeDetailPage />);

    await waitFor(() =>
      expect(mockGetChallengeMatches).toHaveBeenCalledTimes(1)
    );

    const assignBtn = screen.getByRole('button', {
      name: /assign students/i,
    });
    expect(assignBtn).toBeInTheDocument();

    fireEvent.click(assignBtn);

    await waitFor(() =>
      expect(mockAssignChallenge).toHaveBeenCalledWith('123')
    );
    await waitFor(() =>
      expect(mockGetChallengeMatches).toHaveBeenCalledTimes(2)
    );
  });

  it('hides assign button when challenge is not public', async () => {
    mockGetChallengeMatches.mockResolvedValueOnce({
      success: true,
      challenge: {
        id: 123,
        title: 'Sample Challenge',
        status: 'assigned',
        startDatetime: new Date().toISOString(),
        duration: 30,
      },
      assignments: [],
    });
    render(<ChallengeDetailPage />);

    await waitFor(() =>
      expect(mockGetChallengeMatches).toHaveBeenCalledTimes(1)
    );

    const assignButtons = screen.queryAllByRole('button', {
      name: /assign students/i,
    });
    expect(assignButtons.length).toBe(0);
  });
});
