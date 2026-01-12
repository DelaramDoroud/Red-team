import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { ChallengeStatus } from '#js/constants';
import PeerReviewPage from '../app/student/challenges/[challengeId]/peer-review/page';

const mockPush = vi.fn();

// Mock di next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ challengeId: '123' }),
}));

// Mock di useRoleGuard
const mockUseRoleGuard = vi.fn();
vi.mock('#js/useRoleGuard', () => ({
  __esModule: true,
  default: () => mockUseRoleGuard(),
}));

// Mock di useChallenge
const mockGetStudentPeerReviewAssignments = vi.fn();
vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getStudentPeerReviewAssignments: mockGetStudentPeerReviewAssignments,
  }),
}));

// Mock di useApiErrorRedirect
vi.mock('#js/useApiErrorRedirect', () => ({
  __esModule: true,
  default: () => vi.fn(),
}));

// Mock componenti comuni
vi.mock('#components/common/Button', () => ({
  Button: ({ children, ...props }) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
}));

vi.mock('#components/common/card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardHeader: ({ children }) => <div>{children}</div>,
  CardTitle: ({ children }) => <h2>{children}</h2>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardDescription: ({ children }) => <p>{children}</p>,
}));

// Dati di base
const baseChallenge = {
  id: 123,
  status: ChallengeStatus.STARTED_PHASE_TWO,
  startPhaseTwoDateTime: new Date(Date.now() - 1000 * 60).toISOString(),
  durationPeerReview: 30,
};

const assignmentsMock = [
  { id: 1, submissionId: 11, code: 'console.log("solution 1");' },
  { id: 2, submissionId: 22, code: 'console.log("solution 2");' },
];

describe('Peer Review – Student side acceptance criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRoleGuard.mockReturnValue({
      user: { id: 1, role: 'student' },
      isAuthorized: true,
    });
  });

  it('shows waiting message before peer review starts', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: [],
      challenge: {
        ...baseChallenge,
        status: ChallengeStatus.STARTED_PHASE_ONE,
      },
    }));

    render(<PeerReviewPage />);

    expect(
      await screen.findByText(
        /Wait for your teacher to start the peer review phase/i
      )
    ).toBeInTheDocument();
  });

  it('automatically loads peer review content when phase is active', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    expect(
      await screen.findByText(/Review solutions and submit your assessment/i)
    ).toBeInTheDocument();
  });

  it('shows a countdown timer', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    const timer = await screen.findByText(/\d\d:\d\d:\d\d/);
    expect(timer).toBeInTheDocument();
  });

  it('displays assigned solutions in the sidebar', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    expect(await screen.findByText('Solution 1')).toBeInTheDocument();
    expect(await screen.findByText('Solution 2')).toBeInTheDocument();
  });

  it('selects the first solution by default', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    expect(await screen.findByText(/Solution 1/)).toBeInTheDocument();
    expect(
      await screen.findByText('console.log("solution 1");')
    ).toBeInTheDocument();
  });

  it('displays solution code in read-only mode', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    const codeBlock = await screen.findByText('console.log("solution 1");');
    expect(codeBlock.tagName.toLowerCase()).toBe('pre');
  });

  it('has Abstain selected by default', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    const abstainRadio = await screen.findByRole('radio', { name: /abstain/i });
    expect(abstainRadio).toBeChecked();
  });

  it('shows progress bar at 0% initially', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    expect(await screen.findByText(/0% completed/i)).toBeInTheDocument();
  });

  it('shows Exit button', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    expect(
      await screen.findByRole('button', { name: /exit/i })
    ).toBeInTheDocument();
  });

  it('shows Summary button', async () => {
    mockGetStudentPeerReviewAssignments.mockImplementation(async () => ({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    }));

    render(<PeerReviewPage />);

    expect(
      await screen.findByRole('button', { name: /summary/i })
    ).toBeInTheDocument();
  });
});
