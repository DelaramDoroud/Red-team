import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ChallengeStatus } from '#js/constants';
import ChallengeResultPage from '../app/student/challenges/[challengeId]/result/page';
import { DurationProvider } from '../app/student/challenges/[challengeId]/(context)/DurationContext';
import { renderWithProviders } from './test-utils';

const mockGetChallengeResults = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getChallengeResults: mockGetChallengeResults,
  }),
}));

vi.mock('#js/useApiErrorRedirect', () => ({
  __esModule: true,
  default: () => () => false,
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
  useParams: () => ({ challengeId: '42' }),
  useRouter: () => mockRouter,
}));

describe('ChallengeResultPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = ({ durationValue, preloadedState } = {}) => {
    const baseState = {
      auth: {
        user: { id: 1, role: 'student' },
        isLoggedIn: true,
        loading: false,
        roles: ['student'],
        error: null,
        loginRedirectPath: null,
        permissions: null,
      },
      ui: {
        theme: null,
        challengeDrafts: {},
        challengeTimers: {},
        challengeCountdowns: {},
        peerReviewExits: {},
        solutionFeedbackVisibility: {},
      },
    };
    const mergedState = {
      ...baseState,
      ...preloadedState,
      auth: {
        ...baseState.auth,
        ...(preloadedState?.auth || {}),
      },
      ui: {
        ...baseState.ui,
        ...(preloadedState?.ui || {}),
      },
    };

    renderWithProviders(
      durationValue ? (
        <DurationProvider value={durationValue}>
          <ChallengeResultPage />
        </DurationProvider>
      ) : (
        <ChallengeResultPage />
      ),
      {
        preloadedState: mergedState,
      }
    );
  };

  it('renders ended challenge details with private tests and peer review feedback', async () => {
    const user = userEvent.setup();
    mockGetChallengeResults.mockResolvedValue({
      success: true,
      data: {
        challenge: {
          id: 42,
          title: 'Sorting Challenge',
          status: 'ended_phase_two',
          endPhaseTwoDateTime: new Date(Date.now() - 60 * 1000).toISOString(),
        },
        matchSetting: { id: 5, problemTitle: 'Sort an array' },
        studentSubmission: {
          id: 99,
          code: 'int main() { return 0; }',
          createdAt: new Date('2025-12-01T10:00:00Z').toISOString(),
          publicTestResults: [
            {
              testIndex: 0,
              passed: true,
              expectedOutput: '1 2',
              actualOutput: '1 2',
            },
          ],
          privateTestResults: [
            {
              testIndex: 0,
              passed: true,
              expectedOutput: '1 2',
              actualOutput: '1 2',
            },
          ],
        },
        otherSubmissions: [
          {
            id: 101,
            code: 'int main() { return 1; }',
            createdAt: new Date('2025-12-01T10:05:00Z').toISOString(),
            student: { id: 2, username: 'peer' },
          },
        ],
        peerReviewTests: [
          {
            id: 201,
            reviewer: { id: 2, username: 'peer' },
            tests: [
              { input: '2 1', expectedOutput: '1 2', notes: 'Check ordering' },
            ],
          },
        ],
      },
    });

    renderPage({
      durationValue: {
        status: ChallengeStatus.ENDED_PHASE_TWO,
      },
    });

    expect(await screen.findByText('Sorting Challenge')).toBeInTheDocument();
    expect(
      await screen.findByText(/Problem: Sort an array/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/Your (submission|solution)/i)
    ).toBeInTheDocument();

    const toggleButton = screen.getByRole('button', {
      name: /View Your Solution & Feedback/i,
    });
    expect(toggleButton).toBeInTheDocument();

    expect(
      screen.queryByText(/int main\(\) { return 0; }/i)
    ).not.toBeInTheDocument();

    await user.click(toggleButton);

    expect(
      await screen.findByRole('button', {
        name: /Hide Your Solution & Feedback/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/int main\(\) { return 0; }/i)).toBeInTheDocument();
    expect(screen.getByText(/Public test results/i)).toBeInTheDocument();
    expect(screen.getByText(/Private test results/i)).toBeInTheDocument();
    expect(screen.getAllByText('1 2').length).toBeGreaterThan(0);
    expect(screen.getByText(/Received Peer Tests/i)).toBeInTheDocument();
    expect(screen.getByText(/Reviewer:\s*peer/i)).toBeInTheDocument();
    expect(screen.getByText(/2 1/)).toBeInTheDocument();

    expect(
      screen.getByText(/Other participant solutions/i)
    ).toBeInTheDocument();

    expect(screen.getAllByText('peer').length).toBeGreaterThan(0);
  });
  it('respects persisted solution feedback visibility', async () => {
    mockGetChallengeResults.mockResolvedValue({
      success: true,
      data: {
        challenge: {
          id: 42,
          title: 'Sorting Challenge',
          status: 'ended_phase_two',
          endPhaseTwoDateTime: new Date(Date.now() - 60 * 1000).toISOString(),
        },
        matchSetting: { id: 5, problemTitle: 'Sort an array' },
        studentSubmission: {
          id: 99,
          code: 'int main() { return 0; }',
          createdAt: new Date('2025-12-01T10:00:00Z').toISOString(),
          publicTestResults: [
            {
              testIndex: 0,
              passed: true,
              expectedOutput: '1 2',
              actualOutput: '1 2',
            },
          ],
          privateTestResults: [
            {
              testIndex: 0,
              passed: false,
              expectedOutput: '1 2',
              actualOutput: '2 1',
              stderr: 'Wrong order',
            },
          ],
        },
      },
    });

    renderPage({
      durationValue: {
        status: ChallengeStatus.ENDED_PHASE_TWO,
      },
      preloadedState: {
        ui: {
          solutionFeedbackVisibility: {
            1: {
              42: true,
            },
          },
        },
      },
    });

    expect(
      await screen.findByRole('button', {
        name: /Hide Your Solution & Feedback/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/int main\(\) { return 0; }/i)).toBeInTheDocument();
    expect(screen.getByText(/Private test results/i)).toBeInTheDocument();
    expect(screen.getByText(/Wrong order/i)).toBeInTheDocument();
  });

  it('shows an error message when the API fails', async () => {
    mockGetChallengeResults.mockResolvedValue({
      success: false,
      error: { message: 'Something went wrong.' },
    });

    renderPage({
      durationValue: {
        status: ChallengeStatus.ENDED_PHASE_TWO,
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  it('shows a waiting screen while peer review is active', async () => {
    renderPage({
      durationValue: {
        status: ChallengeStatus.STARTED_PHASE_TWO,
      },
    });

    expect(
      await screen.findByText(/Peer review in progress/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Snake break/i)).toBeInTheDocument();
  });

  it('shows a processing screen when results are not ready', async () => {
    mockGetChallengeResults.mockResolvedValue({
      success: true,
      data: {
        challenge: {
          id: 42,
          title: 'Sorting Challenge',
          status: 'ended_phase_two',
          endPhaseTwoDateTime: new Date(Date.now() - 60 * 1000).toISOString(),
        },
        finalization: {
          totalMatches: 4,
          finalSubmissionCount: 2,
          pendingFinalCount: 2,
          resultsReady: false,
        },
      },
    });

    renderPage({
      durationValue: {
        status: ChallengeStatus.ENDED_PHASE_TWO,
      },
    });

    expect(
      await screen.findByText(/Preparing your results/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Snake break/i)).toBeInTheDocument();
    expect(screen.getByText(/Finalized submissions/i)).toBeInTheDocument();
  });
});
