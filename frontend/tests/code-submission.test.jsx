import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MatchContainer from '../app/student/challenges/[challengeId]/(components)/MatchContainer';
import { given, when, andThen as then } from './bdd';

// Mocks
const mockGetStudentAssignedMatchSetting = vi.fn();
const mockGetStudentAssignedMatch = vi.fn();
const mockSubmitSubmission = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getStudentAssignedMatchSetting: mockGetStudentAssignedMatchSetting,
    getStudentAssignedMatch: mockGetStudentAssignedMatch,
    submitSubmission: mockSubmitSubmission,
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ challengeId: '123' }),
}));

// Mock MatchView to isolate MatchContainer logic
vi.mock(
  '../app/student/challenges/[challengeId]/(components)/MatchView',
  () => ({
    default: ({
      onRun,
      onSubmit,
      onTimerFinish,
      isSubmittingActive,
      message,
      error,
      isChallengeFinished,
    }) => (
      <div data-testid='match-view'>
        <button type='button' onClick={onRun} data-testid='run-btn'>
          Run
        </button>
        <button
          type='button'
          onClick={onSubmit}
          disabled={!isSubmittingActive}
          data-testid='submit-btn'
        >
          Submit
        </button>
        <button
          type='button'
          onClick={onTimerFinish}
          data-testid='timer-finish-btn'
        >
          Finish Timer
        </button>
        {message && <div data-testid='message'>{message}</div>}
        {error && <div data-testid='error'>{error.message}</div>}
        {isChallengeFinished && (
          <div data-testid='challenge-finished'>Challenge Finished</div>
        )}
      </div>
    ),
  })
);

describe('RT-4 Code Submission', () => {
  const studentId = 1;
  const challengeId = '123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful match setting response
    mockGetStudentAssignedMatchSetting.mockResolvedValue({
      success: true,
      data: {
        starterCode: 'int main() {}',
      },
    });
    // Default successful match response
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: {
        id: 456,
      },
    });
  });

  it('should enable submit button only after running code', async () => {
    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    await then(async () => {
      const submitBtn = screen.getByTestId('submit-btn');
      expect(submitBtn).toBeDisabled();
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('run-btn'));
      // Wait for the simulated run delay (300ms in MatchContainer)
      await waitFor(
        () => {
          expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
        },
        { timeout: 1000 }
      );
    });
  });

  it('should submit code successfully when submit button is clicked', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    // Enable submit button
    await when(async () => {
      fireEvent.click(screen.getByTestId('run-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      expect(mockSubmitSubmission).toHaveBeenCalledWith({
        matchId: 456,
        code: expect.any(String),
      });
      await waitFor(() => {
        expect(screen.getByTestId('message')).toHaveTextContent(
          'Submission successful!'
        );
      });
    });
  });

  it('should handle submission failure', async () => {
    mockSubmitSubmission.mockResolvedValue({
      success: false,
      error: { message: 'Compilation failed' },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    // Enable submit button
    await when(async () => {
      fireEvent.click(screen.getByTestId('run-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent(
          'Compilation failed'
        );
      });
    });
  });

  it('should automatically submit when timer finishes', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(mockSubmitSubmission).toHaveBeenCalled();
      });
    });
  });
});
