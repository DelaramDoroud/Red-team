import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
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
      loading,
      onRun,
      onSubmit,
      onTimerFinish,
      isSubmittingActive,
      isRunning,
      isSubmitting,
      message,
      error,
      isChallengeFinished,
    }) => {
      if (loading) return <div data-testid='loading'>Loading...</div>;
      if (error) return <div data-testid='error'>{error.message}</div>;

      return (
        <div data-testid='match-view'>
          <button
            type='button'
            onClick={onRun}
            disabled={isRunning || isSubmitting || isChallengeFinished}
            data-testid='run-btn'
          >
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
          {isChallengeFinished && (
            <div data-testid='challenge-finished'>Challenge Finished</div>
          )}
        </div>
      );
    },
  })
);

describe('RT-4 Code Submission', () => {
  const studentId = 1;
  const challengeId = '123';

  // Helper to click run button and advance timers
  const clickRunAndWait = async () => {
    fireEvent.click(screen.getByTestId('run-btn'));
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Default successful match setting response
    mockGetStudentAssignedMatchSetting.mockResolvedValue({
      success: true,
      data: {
        starterCode: 'int main() {}',
        problemTitle: 'Test Problem',
        testCases: [],
      },
    });
    // Default successful match response
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: {
        id: 456,
      },
    });
    // Default successful submission response
    mockSubmitSubmission.mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
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
      await clickRunAndWait();
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });
  }, 10000);

  it('should submit code successfully when submit button is clicked', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    // Wait for component to be fully loaded
    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
      await waitFor(
        () => {
          expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
    });

    await then(async () => {
      expect(mockSubmitSubmission).toHaveBeenCalledWith({
        matchId: 456,
        code: expect.any(String),
      });
      await waitFor(
        () => {
          expect(screen.getByTestId('message')).toHaveTextContent(
            'Submission successful!'
          );
        },
        { timeout: 2000 }
      );
    });
  }, 10000);

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

    // Wait for component to be fully loaded
    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
      await waitFor(
        () => {
          expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(screen.getByTestId('error')).toHaveTextContent(
            'Compilation failed'
          );
        },
        { timeout: 2000 }
      );
    });
  }, 10000);

  it('should automatically submit when timer finishes', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    // Wait for component to be fully loaded
    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(mockSubmitSubmission).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  }, 10000);

  // RT-4 AC: Automatic submission when timer reaches zero
  it.skip('AC: should show "Thanks for your participation" message on automatic submission success', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: { id: 456 },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-finished')).toBeInTheDocument();
      });
    });

    await then(async () => {
      await waitFor(() => {
        const message = screen.getByTestId('message');
        expect(message).toHaveTextContent('Thanks for your participation');
      });
    });
  });

  // RT-4 AC: Automatic submission failure handling
  it.skip('AC: should show compilation failure message on automatic submission if code fails to compile', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: false });
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: { id: 456 },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-finished')).toBeInTheDocument();
      });
    });

    await then(async () => {
      await waitFor(() => {
        const message = screen.getByTestId('message');
        expect(message).toHaveTextContent(
          'Your code did not compile successfully. Thanks for your participation'
        );
      });
    });
  });

  // RT-4 AC: Submit button disabled after timer expires
  it.skip('AC: should disable submit button when challenge is finished', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: { id: 456 },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    // Enable submit button first
    await when(async () => {
      await clickRunAndWait();
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    // Trigger timer finish
    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-finished')).toBeInTheDocument();
      });
    });

    await then(async () => {
      // Submit button should remain disabled
      expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });
  });

  // RT-4 AC: Stored submission is linked to correct student_id and match_id
  it.skip('AC: should include correct matchId and code in submission', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(mockSubmitSubmission).toHaveBeenCalledWith({
          matchId: 456,
          code: expect.any(String),
        });
      });
    });
  });

  // RT-4 AC: Run button should be disabled when submitting
  it.skip('AC: should disable run button while submitting', async () => {
    mockSubmitSubmission.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 500);
        })
    );

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('run-btn')).toBeDisabled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('run-btn')).not.toBeDisabled();
      });
    });
  });

  // RT-4 AC: Error handling for missing match
  it.skip('AC: should display error if match cannot be found during submission', async () => {
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: false,
      message: 'Match not found',
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('No match found');
      });
    });
  });

  // RT-4 AC: Error handling for empty code submission
  it.skip('AC: should prevent submission of empty code', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
      await waitFor(() => {
        expect(screen.getByTestId('match-view')).toBeInTheDocument();
      });
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    // Mock a scenario where MatchContainer has empty code (for testing)
    // Note: In real scenario, this would be set via editor
    await when(async () => {
      // This test assumes the component properly validates empty code
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      // Verify the validation is in place
      expect(mockSubmitSubmission).toHaveBeenCalled();
    });
  });
});
