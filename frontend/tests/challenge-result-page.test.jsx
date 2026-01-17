import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ChallengeResultPage from '../app/student/challenges/[challengeId]/result/page';

const mockGetChallengeResults = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getChallengeResults: mockGetChallengeResults,
  }),
}));

vi.mock('#js/useRoleGuard', () => ({
  __esModule: true,
  default: () => ({
    user: { id: 1, role: 'student' },
    isAuthorized: true,
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

  it('renders ended challenge details with private tests and peer review feedback', async () => {
    mockGetChallengeResults.mockResolvedValue({
      success: true,
      data: {
        challenge: {
          id: 42,
          title: 'Sorting Challenge',
          status: 'ended_phase_two',
        },
        matchSetting: { id: 5, problemTitle: 'Sort an array' },
        studentSubmission: {
          id: 99,
          code: 'int main() { return 0; }',
          createdAt: new Date('2025-12-01T10:00:00Z').toISOString(),
          privateSummary: { total: 1, passed: 1, failed: 0 },
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
              {
                input: '2 1',
                expectedOutput: '1 2',
                notes: 'Check ordering',
              },
            ],
          },
        ],
      },
    });

    render(<ChallengeResultPage />);

    expect(await screen.findByText('Sorting Challenge')).toBeInTheDocument();
    expect(screen.getByText(/Problem: Sort an array/i)).toBeInTheDocument();
    expect(screen.getByText(/Your submission/i)).toBeInTheDocument();
    expect(screen.getByText(/int main\(\) { return 0; }/i)).toBeInTheDocument();
    expect(screen.getByText(/Private test results/i)).toBeInTheDocument();
    expect(screen.getAllByText('1 2').length).toBeGreaterThan(0);
    expect(screen.getByText(/Peer review tests/i)).toBeInTheDocument();
    expect(screen.getByText(/Check ordering/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Other participant solutions/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('peer').length).toBeGreaterThan(0);
  });

  it('shows an error message when the API fails', async () => {
    mockGetChallengeResults.mockResolvedValue({
      success: false,
      error: { message: 'Challenge has not ended yet.' },
    });

    render(<ChallengeResultPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Challenge has not ended yet/i)
      ).toBeInTheDocument();
    });
  });
});
