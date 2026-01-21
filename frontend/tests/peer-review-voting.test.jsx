/**
 * RT-181: Comprehensive tests for voting functionality in peer review
 *
 * Tests cover:
 * - Vote selection and changing votes
 * - Vote persistence across navigation (Next/Previous buttons, sidebar)
 * - Vote persistence across page refresh
 * - Progress bar updates in real-time
 * - Incorrect vote validation (empty fields, invalid arrays, public test detection)
 * - Vote saving behavior (auto-save for Correct/Abstain, conditional for Incorrect)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { ChallengeStatus } from '#js/constants';
import PeerReviewPage from '../app/student/challenges/[challengeId]/peer-review/page';

// Mock Monaco editor
vi.mock('next/dynamic', () => ({
  default: () => {
    function FakeMonaco({ value }) {
      return <pre data-testid='code-editor'>{value}</pre>;
    }
    return FakeMonaco;
  },
}));

const mockPush = vi.fn();
const mockRouter = { push: mockPush };
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  custom: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({
    challengeId: '123',
  }),
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: mockToast,
}));

const mockUseRoleGuard = vi.fn();
vi.mock('#js/useRoleGuard', () => ({
  __esModule: true,
  default: () => mockUseRoleGuard(),
}));

const mockGetStudentPeerReviewAssignments = vi.fn();
const mockGetStudentVotes = vi.fn();
const mockGetPeerReviewSummary = vi.fn();
const mockSubmitPeerReviewVote = vi.fn();
const mockExitPeerReview = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getStudentPeerReviewAssignments: mockGetStudentPeerReviewAssignments,
    getStudentVotes: mockGetStudentVotes,
    getPeerReviewSummary: mockGetPeerReviewSummary,
    submitPeerReviewVote: mockSubmitPeerReviewVote,
    exitPeerReview: mockExitPeerReview,
  }),
}));

const mockRedirectOnError = vi.fn();
vi.mock('#js/useApiErrorRedirect', () => ({
  __esModule: true,
  default: () => mockRedirectOnError,
}));

// Mock Button component
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

// Mock Card components
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

const createTestStore = () =>
  configureStore({
    reducer: {
      ui: (state = { theme: 'light' }) => state,
    },
  });

const renderWithRedux = (component) =>
  render(<Provider store={createTestStore()}>{component}</Provider>);

const baseChallenge = {
  id: 123,
  status: ChallengeStatus.STARTED_PHASE_TWO,
  startPhaseTwoDateTime: new Date(Date.now() - 1000 * 60).toISOString(),
  durationPeerReview: 30,
};

const assignmentsMock = [
  {
    id: 1,
    submissionId: 11,
    code: 'function solve(arr) { return arr[0]; }',
  },
  {
    id: 2,
    submissionId: 22,
    code: 'function solve(arr) { return arr.reverse(); }',
  },
  {
    id: 3,
    submissionId: 33,
    code: 'function solve(arr) { return arr.sort(); }',
  },
];

describe('RT-181: Vote Selection and Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRoleGuard.mockReturnValue({
      user: { id: 1, role: 'student' },
      isAuthorized: true,
    });

    mockGetStudentPeerReviewAssignments.mockResolvedValue({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    });

    mockGetStudentVotes.mockResolvedValue({
      success: true,
      votes: [],
    });

    mockSubmitPeerReviewVote.mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Vote selection options', () => {
    it('allows student to select Correct vote', async () => {
      renderWithRedux(<PeerReviewPage />);

      const correctRadios = await screen.findAllByRole('radio', {
        name: /correct/i,
      });
      const correctRadio = correctRadios[0];

      await userEvent.click(correctRadio);

      await waitFor(() => {
        expect(correctRadio).toBeChecked();
      });

      // Verify it was saved automatically
      expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
        1,
        'correct',
        null,
        null
      );
    });

    it('allows student to select Incorrect vote', async () => {
      renderWithRedux(<PeerReviewPage />);

      const incorrectRadios = await screen.findAllByRole('radio', {
        name: /incorrect/i,
      });
      const incorrectRadio = incorrectRadios[0];

      await userEvent.click(incorrectRadio);

      await waitFor(() => {
        expect(incorrectRadio).toBeChecked();
      });

      // Incorrect vote should NOT be saved until validation passes
      expect(mockSubmitPeerReviewVote).not.toHaveBeenCalled();
    });

    it('allows student to select Abstain vote', async () => {
      renderWithRedux(<PeerReviewPage />);

      const abstainRadios = await screen.findAllByRole('radio', {
        name: /abstain/i,
      });
      const abstainRadio = abstainRadios[0];

      await userEvent.click(abstainRadio);

      await waitFor(() => {
        expect(abstainRadio).toBeChecked();
      });

      // Verify it was saved automatically
      expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
        1,
        'abstain',
        null,
        null
      );
    });
  });

  describe('Changing votes', () => {
    it('allows student to change vote from Correct to Incorrect', async () => {
      renderWithRedux(<PeerReviewPage />);

      // Select Correct first
      const correctRadios = await screen.findAllByRole('radio', {
        name: /correct/i,
      });
      await userEvent.click(correctRadios[0]);

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'correct',
          null,
          null
        );
      });

      vi.clearAllMocks();

      // Change to Incorrect
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      await waitFor(() => {
        expect(incorrectRadios[0]).toBeChecked();
        expect(correctRadios[0]).not.toBeChecked();
      });
    });

    it('allows student to change vote from Incorrect to Abstain', async () => {
      renderWithRedux(<PeerReviewPage />);

      // Select Incorrect first
      const incorrectRadios = await screen.findAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      // Change to Abstain
      const abstainRadios = screen.getAllByRole('radio', { name: /abstain/i });
      await userEvent.click(abstainRadios[0]);

      await waitFor(() => {
        expect(abstainRadios[0]).toBeChecked();
        expect(incorrectRadios[0]).not.toBeChecked();
      });

      // Abstain should be saved automatically
      expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
        1,
        'abstain',
        null,
        null
      );
    });

    it('replaces previous vote when a new vote is selected', async () => {
      renderWithRedux(<PeerReviewPage />);

      // Select Correct
      const correctRadios = await screen.findAllByRole('radio', {
        name: /correct/i,
      });
      await userEvent.click(correctRadios[0]);

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'correct',
          null,
          null
        );
      });

      vi.clearAllMocks();

      // Change to Abstain
      const abstainRadios = screen.getAllByRole('radio', { name: /abstain/i });
      await userEvent.click(abstainRadios[0]);

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'abstain',
          null,
          null
        );
      });

      // Only Abstain should be checked now
      expect(abstainRadios[0]).toBeChecked();
      expect(correctRadios[0]).not.toBeChecked();
    });
  });

  describe('Vote persistence across navigation using sidebar', () => {
    it('persists vote when navigating to another solution via sidebar', async () => {
      renderWithRedux(<PeerReviewPage />);

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Select Correct for solution 1
      const correctRadios = screen.getAllByRole('radio', { name: /correct/i });
      await userEvent.click(correctRadios[0]);

      await waitFor(() => {
        expect(correctRadios[0]).toBeChecked();
      });

      // Navigate to solution 2 via sidebar
      const solution2Buttons = screen.getAllByRole('button', {
        name: /solution 2/i,
      });
      await userEvent.click(solution2Buttons[0]); // First is sidebar button

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Navigate back to solution 1 via sidebar
      const solution1Buttons = screen.getAllByRole('button', {
        name: /solution 1/i,
      });
      await userEvent.click(solution1Buttons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Verify vote is still selected
      const correctRadiosAfter = screen.getAllByRole('radio', {
        name: /correct/i,
      });
      expect(correctRadiosAfter[0]).toBeChecked();
    });

    it('persists multiple votes across sidebar navigation', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Vote Correct on solution 1
      const correctRadios1 = screen.getAllByRole('radio', {
        name: /correct/i,
      });
      await userEvent.click(correctRadios1[0]);

      // Go to solution 2
      const solution2Buttons = screen.getAllByRole('button', {
        name: /solution 2/i,
      });
      await userEvent.click(solution2Buttons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Vote Abstain on solution 2
      const abstainRadios2 = screen.getAllByRole('radio', { name: /abstain/i });
      await userEvent.click(abstainRadios2[0]);

      // Go to solution 3
      const solution3Buttons = screen.getAllByRole('button', {
        name: /solution 3/i,
      });
      await userEvent.click(solution3Buttons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Solution 3 of 3/i)).toBeInTheDocument();
      });

      // Vote Incorrect on solution 3
      const incorrectRadios3 = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios3[0]);

      // Navigate back to solution 1
      const solution1BackButtons = screen.getAllByRole('button', {
        name: /solution 1/i,
      });
      await userEvent.click(solution1BackButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Verify vote is still Correct
      const correctRadiosBack = screen.getAllByRole('radio', {
        name: /correct/i,
      });
      expect(correctRadiosBack[0]).toBeChecked();

      // Navigate to solution 2
      const solution2BackButtons = screen.getAllByRole('button', {
        name: /solution 2/i,
      });
      await userEvent.click(solution2BackButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Verify vote is still Abstain
      const abstainRadiosBack = screen.getAllByRole('radio', {
        name: /abstain/i,
      });
      expect(abstainRadiosBack[0]).toBeChecked();
    });
  });

  describe('Vote persistence across navigation using Next/Previous buttons', () => {
    it('persists vote when navigating using Next button', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Select Correct
      const correctRadios = screen.getAllByRole('radio', { name: /correct/i });
      await userEvent.click(correctRadios[0]);

      // Click Next
      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Click Previous
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await userEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Verify vote is still selected
      const correctRadiosAfter = screen.getAllByRole('radio', {
        name: /correct/i,
      });
      expect(correctRadiosAfter[0]).toBeChecked();
    });

    it('persists vote when navigating using Previous button', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Navigate to solution 2
      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Select Abstain
      const abstainRadios = screen.getAllByRole('radio', { name: /abstain/i });
      await userEvent.click(abstainRadios[0]);

      // Navigate to solution 3
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 3 of 3/i)).toBeInTheDocument();
      });

      // Navigate back to solution 2
      const prevButton = screen.getByRole('button', { name: /previous/i });
      await userEvent.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Verify vote is still selected
      const abstainRadiosAfter = screen.getAllByRole('radio', {
        name: /abstain/i,
      });
      expect(abstainRadiosAfter[0]).toBeChecked();
    });
  });

  describe('Vote persistence across page refresh', () => {
    it('loads previously saved votes from backend on page load', async () => {
      const existingVotes = [
        { submissionId: 11, vote: 'correct' },
        {
          submissionId: 22,
          vote: 'incorrect',
          testCaseInput: '[1]',
          expectedOutput: '[2]',
        },
        { submissionId: 33, vote: 'abstain' },
      ];

      mockGetStudentVotes.mockResolvedValue({
        success: true,
        votes: existingVotes,
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Verify solution 1 vote is loaded (Correct)
      const correctRadios = screen.getAllByRole('radio', { name: /correct/i });
      expect(correctRadios[0]).toBeChecked();

      // Navigate to solution 2
      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      // Verify solution 2 vote is loaded (Incorrect)
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      expect(incorrectRadios[0]).toBeChecked();

      // Navigate to solution 3
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 3 of 3/i)).toBeInTheDocument();
      });

      // Verify solution 3 vote is loaded (Abstain)
      const abstainRadios = screen.getAllByRole('radio', { name: /abstain/i });
      expect(abstainRadios[0]).toBeChecked();
    });

    it('retains votes after simulated refresh by re-fetching from backend', async () => {
      // Initial render with no votes
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // User votes Correct on solution 1
      const correctRadios = screen.getAllByRole('radio', { name: /correct/i });
      await userEvent.click(correctRadios[0]);

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'correct',
          null,
          null
        );
      });

      // Simulate refresh by updating mock to return saved votes
      mockGetStudentVotes.mockResolvedValue({
        success: true,
        votes: [{ submissionId: 11, vote: 'correct' }],
      });

      // Re-render (simulating page refresh)
      const { unmount } = renderWithRedux(<PeerReviewPage />);
      unmount();
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Verify vote is still selected after refresh
      await waitFor(() => {
        const correctRadiosAfter = screen.getAllByRole('radio', {
          name: /correct/i,
        });
        expect(correctRadiosAfter[0]).toBeChecked();
      });
    });
  });

  describe('Progress bar updates', () => {
    it('updates progress bar immediately when a valid vote is added', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Initially 0 completed
      expect(screen.getByText(/0\s*\/\s*3/i)).toBeInTheDocument();

      // Vote on solution 1
      const correctRadios = screen.getAllByRole('radio', { name: /correct/i });
      await userEvent.click(correctRadios[0]);

      // Progress should update
      await waitFor(() => {
        expect(screen.getByText(/1\s*\/\s*3/i)).toBeInTheDocument();
      });

      // Navigate to solution 2 and vote
      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Solution 2 of 3/i)).toBeInTheDocument();
      });

      const abstainRadios = screen.getAllByRole('radio', { name: /abstain/i });
      await userEvent.click(abstainRadios[0]);

      // Progress should update again
      await waitFor(() => {
        expect(screen.getByText(/2\s*\/\s*3/i)).toBeInTheDocument();
      });
    });

    it('updates progress bar when vote is changed', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Vote Correct
      const correctRadios = screen.getAllByRole('radio', { name: /correct/i });
      await userEvent.click(correctRadios[0]);

      await waitFor(() => {
        expect(screen.getByText(/1\s*\/\s*3/i)).toBeInTheDocument();
      });

      // Change to Abstain (should still be 1 voted)
      const abstainRadios = screen.getAllByRole('radio', { name: /abstain/i });
      await userEvent.click(abstainRadios[0]);

      // Progress should still show 1 (vote changed, not removed)
      await waitFor(() => {
        expect(screen.getByText(/1\s*\/\s*3/i)).toBeInTheDocument();
      });
    });

    it('does not count invalid incorrect votes in progress', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Initially 0 completed
      expect(screen.getByText(/0\s*\/\s*3/i)).toBeInTheDocument();

      // Select Incorrect without providing test case
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      // Progress should still be 0 (invalid vote)
      await waitFor(() => {
        expect(screen.getByText(/0\s*\/\s*3/i)).toBeInTheDocument();
      });

      // Now provide test case input and output
      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, '[[1, 2, 3]');
      await userEvent.type(outputField, '[[3, 2, 1]');

      // Trigger validation by typing
      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalled();
      });

      // Progress should now show 1 if vote is valid
      // Note: This depends on backend validation passing
    });
  });
});

describe('RT-181: Incorrect Vote Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseRoleGuard.mockReturnValue({
      user: { id: 1, role: 'student' },
      isAuthorized: true,
    });

    mockGetStudentPeerReviewAssignments.mockResolvedValue({
      success: true,
      assignments: assignmentsMock,
      challenge: baseChallenge,
    });

    mockGetStudentVotes.mockResolvedValue({
      success: true,
      votes: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty field validation', () => {
    it('shows warning when Incorrect is selected without providing fields', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Select Incorrect
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      // Warning should appear
      await waitFor(() => {
        expect(screen.getByText(/This vote won't count/i)).toBeInTheDocument();
      });

      // Vote should not be saved
      expect(mockSubmitPeerReviewVote).not.toHaveBeenCalled();
    });

    it('shows warning when only input is provided', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Select Incorrect
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      // Provide only input
      const inputField = await screen.findByLabelText(/Test Case Input/i);
      await userEvent.type(inputField, '[[1, 2]');

      // Warning should still be present
      await waitFor(() => {
        expect(screen.getByText(/This vote won't count/i)).toBeInTheDocument();
      });
    });

    it('shows warning when only output is provided', async () => {
      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Select Incorrect
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      // Provide only output
      const outputField = await screen.findByLabelText(/Expected Output/i);
      await userEvent.type(outputField, '[[3, 4]');

      // Warning should still be present
      await waitFor(() => {
        expect(screen.getByText(/This vote won't count/i)).toBeInTheDocument();
      });
    });
  });

  describe('Array format validation', () => {
    it('shows error when input is not a valid array', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: false,
        error: {
          message: 'Input and output must be valid array values',
        },
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      // Select Incorrect
      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      // Provide invalid input
      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, 'not an array');
      await userEvent.type(outputField, '[[1]');

      // Trigger save attempt
      await userEvent.tab();

      await waitFor(() => {
        expect(screen.getByText(/valid array values/i)).toBeInTheDocument();
      });
    });

    it('shows error when output is not a valid array', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: false,
        error: {
          message: 'Input and output must be valid array values',
        },
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, '[[1, 2]');
      await userEvent.type(outputField, 'invalid');

      await userEvent.tab();

      await waitFor(() => {
        expect(screen.getByText(/valid array values/i)).toBeInTheDocument();
      });
    });

    it('accepts valid array with numbers', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: true,
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, '[[1, 2, 3]');
      await userEvent.type(outputField, '[[3, 2, 1]');

      await userEvent.tab();

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'incorrect',
          '[1, 2, 3]',
          '[3, 2, 1]'
        );
      });
    });

    it('accepts valid array with strings', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: true,
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, '[[ "a", "b", "c" ]');
      await userEvent.type(outputField, '[[ "c", "b", "a" ]');

      await userEvent.tab();

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'incorrect',
          '[ "a", "b", "c" ]',
          '[ "c", "b", "a" ]'
        );
      });
    });

    it('accepts valid array with booleans', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: true,
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, '[[true, false]');
      await userEvent.type(outputField, '[[false, true]');

      await userEvent.tab();

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'incorrect',
          '[true, false]',
          '[false, true]'
        );
      });
    });

    it('accepts mixed type arrays', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: true,
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      await userEvent.type(inputField, '[[1, "a", true]');
      await userEvent.type(outputField, '[[true, "a", 1]');

      await userEvent.tab();

      await waitFor(() => {
        expect(mockSubmitPeerReviewVote).toHaveBeenCalledWith(
          1,
          'incorrect',
          '[1, "a", true]',
          '[true, "a", 1]'
        );
      });
    });
  });

  describe('Public test case detection', () => {
    it('shows error when test case matches a public test', async () => {
      mockSubmitPeerReviewVote.mockResolvedValue({
        success: false,
        error: {
          message: 'You cannot use public test cases',
        },
      });

      renderWithRedux(<PeerReviewPage />);

      await waitFor(() => {
        expect(screen.getByText(/Solution 1 of 3/i)).toBeInTheDocument();
      });

      const incorrectRadios = screen.getAllByRole('radio', {
        name: /incorrect/i,
      });
      await userEvent.click(incorrectRadios[0]);

      const inputField = await screen.findByLabelText(/Test Case Input/i);
      const outputField = await screen.findByLabelText(/Expected Output/i);

      // Attempt to use a public test case
      await userEvent.type(inputField, '[[1, 2, 3]');
      await userEvent.type(outputField, '[[6]');

      await userEvent.tab();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.stringContaining('public test')
        );
      });
    });
  });
});
