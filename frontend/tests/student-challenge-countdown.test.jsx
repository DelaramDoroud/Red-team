import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ChallengeStatus } from '#js/constants';
import StudentChallengesPage from '../app/student/challenges/page';

const mockGetChallenges = vi.fn();
const mockGetChallengeForJoinedStudent = vi.fn();
const mockJoinChallenge = vi.fn();

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

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
    getChallenges: mockGetChallenges,
    joinChallenge: mockJoinChallenge,
    getChallengeForJoinedStudent: mockGetChallengeForJoinedStudent,
  }),
}));

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advance(ms) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flushMicrotasks();
}

describe('Student countdown + navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    push.mockClear();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-12T01:10:42Z'));

    mockGetChallenges.mockResolvedValue({
      success: true,
      data: [
        {
          id: 2,
          title: 'Current challenge',
          duration: 30,
          startDatetime: new Date(Date.now() - 60_000).toISOString(),
          status: ChallengeStatus.ASSIGNED,
        },
      ],
    });

    // 1) checkJoined: student already joined
    mockGetChallengeForJoinedStudent.mockResolvedValueOnce({
      success: true,
      data: { id: 2 },
    });

    // 2) polling: challenge is STARTED -> remaining starts at 3
    const startedAt = new Date(Date.now()).toISOString();
    mockGetChallengeForJoinedStudent.mockResolvedValue({
      success: true,
      data: { status: ChallengeStatus.STARTED, startedAt },
    });
  });

  it('shows 3-second countdown then navigates to match', async () => {
    render(<StudentChallengesPage />);

    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(screen.getByText(/Get ready/i)).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);

    // After 1 second -> 2
    await advance(1000);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    // After 2 seconds -> navigate
    await advance(2000);
    expect(push).toHaveBeenCalledWith('/student/challenges/2/match');
  });
});
