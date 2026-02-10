import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChallengeStatus } from '#js/constants';
import { DurationProvider } from '../app/student/challenges/[challengeId]/(context)/DurationContext';
import ChallengeResultPage from '../app/student/challenges/[challengeId]/result/page';
import { getMockedStore } from './test-redux-provider';

const mockGetChallengeResults = vi.fn();
const mockGetStudentVotes = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getChallengeResults: mockGetChallengeResults,
    getStudentVotes: mockGetStudentVotes,
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

vi.mock('#js/router', () => ({
  useParams: () => ({ challengeId: '42' }),
  useRouter: () => mockRouter,
}));

const pastDateIso = new Date(Date.now() - 60 * 1000).toISOString();

const baseState = {
  auth: {
    user: { id: 1, role: 'student' },
    isLoggedIn: true,
    loading: false,
    roles: ['student'],
    error: null,
    loginRedirectPath: null,
    permissions: null,
    badgeSeen: {},
  },
  ui: {
    theme: null,
    challengeDrafts: {},
    challengeTimers: {},
    challengeCountdowns: {},
    peerReviewExits: {},
    solutionFeedbackVisibility: {},
    codeReviewVotesVisibility: {},
  },
};

const buildResultResponse = (newlyUnlocked) => ({
  success: true,
  data: {
    challenge: {
      id: 42,
      title: 'Milestone Challenge',
      status: ChallengeStatus.ENDED_PEER_REVIEW,
      scoringStatus: 'completed',
      endPeerReviewDateTime: pastDateIso,
    },
    matchSetting: {
      id: 11,
      problemTitle: 'Sort an array',
    },
    studentSubmission: {
      id: 10,
      code: 'int main() { return 0; }',
      createdAt: new Date('2026-01-01T10:00:00.000Z').toISOString(),
      publicTestResults: [],
      privateTestResults: [],
    },
    scoreBreakdown: {
      totalScore: 90,
      implementationScore: 45,
      codeReviewScore: 45,
    },
    otherSubmissions: [],
    peerReviewTests: [],
    badges: {
      completedChallenges: 3,
      newlyUnlocked,
    },
  },
});

const renderResultPage = (store) =>
  render(
    <Provider store={store}>
      <DurationProvider value={{ status: ChallengeStatus.ENDED_PEER_REVIEW }}>
        <ChallengeResultPage />
      </DurationProvider>
    </Provider>
  );

describe('ChallengeResultPage badge flow (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows newly unlocked milestone badges immediately and marks each badge as seen on close', async () => {
    const user = userEvent.setup();
    const unlockedBadges = [
      {
        id: 301,
        key: 'challenge_3',
        name: 'Challenge 3',
        description: 'Complete 3 challenges',
        iconKey: 'challenge-3',
        threshold: 3,
        metric: 'challenges_completed',
      },
      {
        id: 305,
        key: 'challenge_5',
        name: 'Challenge 5',
        description: 'Complete 5 challenges',
        iconKey: 'challenge-5',
        threshold: 5,
        metric: 'challenges_completed',
      },
    ];

    mockGetChallengeResults.mockResolvedValue(
      buildResultResponse(unlockedBadges)
    );

    const store = getMockedStore(baseState);
    renderResultPage(store);

    expect(await screen.findByText('Badge Unlocked!')).toBeInTheDocument();
    expect(screen.getByText('Challenge 3')).toBeInTheDocument();
    expect(
      screen.getByText("You've completed 3 challenges completed!")
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(await screen.findByText('Challenge 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByText('Badge Unlocked!')).not.toBeInTheDocument();
    });

    const { badgeSeen } = store.getState().auth;
    expect(badgeSeen[1][301]).toBe(true);
    expect(badgeSeen[1][305]).toBe(true);
  });

  it('does not reopen badges already marked as seen after remounting', async () => {
    const user = userEvent.setup();
    const unlockedBadges = [
      {
        id: 301,
        key: 'challenge_3',
        name: 'Challenge 3',
        description: 'Complete 3 challenges',
        iconKey: 'challenge-3',
        threshold: 3,
        metric: 'challenges_completed',
      },
    ];

    mockGetChallengeResults.mockResolvedValue(
      buildResultResponse(unlockedBadges)
    );

    const store = getMockedStore(baseState);
    const firstMount = renderResultPage(store);

    expect(await screen.findByText('Challenge 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(store.getState().auth.badgeSeen[1][301]).toBe(true);
    });

    firstMount.unmount();
    renderResultPage(store);

    await screen.findByText('Milestone Challenge');
    expect(screen.queryByText('Badge Unlocked!')).not.toBeInTheDocument();
    expect(screen.queryByText('Challenge 3')).not.toBeInTheDocument();
  });
});
