import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { ChallengeStatus } from '#js/constants';

import StudentChallengesPage from '../app/student/challenges/page';
import { given, when, andThen as then } from './bdd';

const mockDispatch = vi.fn(() => Promise.resolve());

const mockAuthState = {
  user: { id: 1, role: 'student' },
  isLoggedIn: true,
  loading: false,
};

vi.mock('#js/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector) =>
    selector({
      auth: mockAuthState,
    }),
  useAppStore: () => ({}),
}));

vi.mock('#js/store/slices/auth', () => ({
  fetchUserInfo: () => async () => ({}),
}));

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/student/challenges',
}));

const mockGetChallengesForStudent = vi.fn();
const mockJoinChallenge = vi.fn();
const mockAssignChallenge = vi.fn();

vi.mock('#components/common/Button', () => {
  function Button({ children, ...props }) {
    return (
      <button type='button' {...props}>
        {children}
      </button>
    );
  }
  return { Button };
});

vi.mock('#components/common/card', () => {
  function Card({ children }) {
    return <div>{children}</div>;
  }
  function CardHeader({ children }) {
    return <div>{children}</div>;
  }
  function CardTitle({ children }) {
    return <h2>{children}</h2>;
  }
  function CardContent({ children }) {
    return <div>{children}</div>;
  }
  function CardDescription({ children }) {
    return <p>{children}</p>;
  }
  return { Card, CardHeader, CardTitle, CardContent, CardDescription };
});

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    loading: false,
    getChallengesForStudent: mockGetChallengesForStudent,
    joinChallenge: mockJoinChallenge,
    assignChallenge: mockAssignChallenge,
    createChallenge: vi.fn(),
    publishChallenge: vi.fn(),
    unpublishChallenge: vi.fn(),
  }),
}));

describe('Student joins challenge page – Acceptance criteria', () => {
  const duration = 30;
  const visibleStart = '2025-11-30T00:00:00Z'; // past
  const future1 = '2999-01-01T10:30:00Z'; //   future
  const sampleChallenges = [
    {
      id: 1,
      title: 'Future challenge',
      duration,
      startDatetime: future1,
      status: 'public',
    },
    {
      id: 2,
      title: 'Current challenge',
      duration,
      startDatetime: visibleStart,
      status: 'public',
    },
    {
      id: 3,
      title: 'Started challenge',
      duration,
      startDatetime: visibleStart,
      status: ChallengeStatus.STARTED_PHASE_ONE,
    },
    {
      id: 4,
      title: 'Peer review challenge',
      duration,
      startDatetime: visibleStart,
      status: ChallengeStatus.STARTED_PHASE_TWO,
    },
    {
      id: 5,
      title: 'Completed challenge',
      duration,
      startDatetime: visibleStart,
      status: ChallengeStatus.ENDED_PHASE_TWO,
      joined: true,
    },
  ];
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetChallengesForStudent.mockReset();
    mockJoinChallenge.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it('shows status labels for upcoming, coding, peer review, and completed challenges', async () => {
    mockGetChallengesForStudent.mockResolvedValue({
      success: true,
      data: sampleChallenges,
    });

    await given(() => {
      render(<StudentChallengesPage />);
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByText('Future challenge')).toBeInTheDocument();
      });
      expect(
        screen.getByText('Upcoming', { selector: 'p' })
      ).toBeInTheDocument();
      expect(screen.getByText('Coding', { selector: 'p' })).toBeInTheDocument();
      expect(
        screen.getByText('Peer review', { selector: 'p' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Completed', { selector: 'p' })
      ).toBeInTheDocument();
    });
  });

  it('shows a Join button when a visible challenge has not started', async () => {
    mockGetChallengesForStudent.mockResolvedValue({
      success: true,
      data: [sampleChallenges[1]],
    });

    await given(() => {
      render(<StudentChallengesPage />);
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByText('Current challenge')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
    });
  });

  it('calls joinChallenge when Join is clicked', async () => {
    mockGetChallengesForStudent.mockResolvedValue({
      success: true,
      data: [sampleChallenges[1]],
    });
    mockJoinChallenge.mockResolvedValue({ success: true });

    await given(() => {
      render(<StudentChallengesPage />);
    });

    const joinButton = await screen.findByRole('button', { name: /join/i });
    const user = userEvent.setup();
    await user.click(joinButton);

    expect(mockJoinChallenge).toHaveBeenCalledWith(2, 1);
  });

  it('shows an empty state when no challenges are available', async () => {
    mockGetChallengesForStudent.mockResolvedValue({
      success: true,
      data: [],
    });

    await given(() => {
      render(<StudentChallengesPage />);
    });

    await then(async () => {
      await waitFor(() => {
        expect(
          screen.getByText(/There are no challenges available yet./i)
        ).toBeInTheDocument();
      });
    });
  });
  // AC4:When the student clicks Join, the system records the student as joined.
  // AC5:After joining, the student sees the message: “Wait for the teacher to start the challenge.”
  it('shows "Wait for the teacher to start the challenge." after clicking Join', async () => {
    const user = userEvent.setup();

    mockGetChallengesForStudent.mockResolvedValue({
      success: true,
      data: [sampleChallenges[1]],
    });

    mockJoinChallenge.mockResolvedValue({ success: true });

    await given(() => {
      render(<StudentChallengesPage />);
    });

    await when(async () => {
      const joinButton = await screen.findByRole('button', {
        name: /join/i,
      });
      await user.click(joinButton);
    });

    await then(async () => {
      expect(mockJoinChallenge).toHaveBeenCalledWith(2, 1);
      await waitFor(() => {
        expect(
          screen.getByText('Wait for the teacher to start the challenge.')
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: /join/i })
      ).not.toBeInTheDocument();
    });
  });
  // AC6:If the challenge has started and the student has not joined beforehand, the Join button is replaced with the message:“The challenge is in progress.”
  it('shows "The challenge is in progress." and student cannot join ', async () => {
    mockGetChallengesForStudent.mockResolvedValue({
      success: true,
      data: [sampleChallenges[2]],
    });

    mockJoinChallenge.mockResolvedValue({ success: true });

    await given(() => {
      render(<StudentChallengesPage />);
    });
    await then(async () => {
      await waitFor(() => {
        expect(
          screen.getByText(/the challenge is already in progress\./i)
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('button', { name: /join/i })
      ).not.toBeInTheDocument();
      expect(mockJoinChallenge).not.toHaveBeenCalled();
    });
  });
});
