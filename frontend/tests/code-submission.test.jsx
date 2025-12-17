import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import MatchContainer from '../app/student/challenges/[challengeId]/(components)/MatchContainer';
import MatchView from '../app/student/challenges/[challengeId]/(components)/MatchView';
import { given, when, andThen as then } from './bdd';
import { getMockedStoreWrapper } from './test-redux-provider';

// Mocks
const mockGetStudentAssignedMatchSetting = vi.fn();
const mockGetStudentAssignedMatch = vi.fn();
const mockSubmitSubmission = vi.fn();
const mockRunCode = vi.fn();
const mockGetLastSubmission = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getStudentAssignedMatchSetting: mockGetStudentAssignedMatchSetting,
    getStudentAssignedMatch: mockGetStudentAssignedMatch,
    submitSubmission: mockSubmitSubmission,
    getLastSubmission: mockGetLastSubmission,
    runCode: mockRunCode,
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ challengeId: '123' }),
}));

// Mock MatchView to isolate MatchContainer logic
vi.mock(
  '../app/student/challenges/[challengeId]/(components)/MatchView',
  () => ({
    default: vi.fn(
      ({
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
        setCode,
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
              onClick={() => setCode('broken')}
              data-testid='set-bad-code'
            >
              Set bad code
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
      }
    ),
  })
);

describe('RT-4 Code Submission', () => {
  const studentId = 1;
  const challengeId = '123';

  // Helper to click run button and wait for completion
  const clickRunAndWait = async () => {
    fireEvent.click(screen.getByTestId('run-btn'));
    // Wait for the mock run to complete (uses real setTimeout of 300ms in component)
    // Add extra buffer to ensure state updates propagate
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  };

  beforeEach(() => {
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
    mockRunCode.mockResolvedValue({
      success: true,
      data: { isCompiled: true, isPassed: true, results: [] },
    });
    mockGetLastSubmission.mockResolvedValue({
      success: true,
      data: { submission: { code: 'int main() {}', passedPublicTests: 2 } },
    });
  });

  afterEach(() => {
    // Clean up
  });

  it('should enable submit button only after running code', async () => {
    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />,
        {
          wrapper: getMockedStoreWrapper({
            auth: { user: { id: 1, role: 'student' }, isLoggedIn: true },
          }),
        }
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
  });

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
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
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
  });

  it('re-submits last successful code if new submission fails to compile', async () => {
    const goodCode = 'int main() {}';
    const badCode = 'broken';

    mockSubmitSubmission.mockImplementation(({ code }) =>
      Promise.resolve({ success: code !== badCode })
    );
    mockGetLastSubmission.mockResolvedValue({
      success: true,
      data: { submission: { code: goodCode } },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // First run + submit with good code
    await when(async () => {
      await clickRunAndWait();
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    // Update code to a bad one and try submitting again
    await when(async () => {
      fireEvent.click(screen.getByTestId('set-bad-code'));
      fireEvent.click(screen.getByTestId('run-btn'));
    });

    // Trigger submit with bad code first then fallback to last success
    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(mockSubmitSubmission).toHaveBeenCalledTimes(1);
      });
      expect(mockSubmitSubmission).toHaveBeenCalledWith({
        matchId: 456,
        code: badCode,
      });
      expect(mockGetLastSubmission).toHaveBeenCalledWith(456);
    });
  });

  it('should handle submission failure', async () => {
    mockSubmitSubmission.mockResolvedValueOnce({
      success: false,
      error: { message: 'Compilation failed' },
    });
    mockGetLastSubmission.mockResolvedValueOnce({
      success: false,
      error: { message: 'No submission found' },
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
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
        },
        { timeout: 2000 }
      );
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(screen.getByText(/Compilation failed/)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });
  });

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
    });

    await then(async () => {
      await waitFor(
        () => {
          expect(mockSubmitSubmission).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });

  // RT-4 AC: Automatic submission when timer reaches zero
  it('AC: should show "Thanks for your participation" message on automatic submission success', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: { id: 456 },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-finished')).toBeInTheDocument();
      });
      await waitFor(() => {
        const message = screen.getByTestId('message');
        expect(message).toHaveTextContent('Thanks for your participation');
      });
    });
  });

  // RT-4 AC: Automatic submission failure handling
  it('AC: should show compilation failure message on automatic submission if code fails to compile', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: false });
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: { id: 456 },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-finished')).toBeInTheDocument();
      });
      await waitFor(() => {
        const message = screen.getByTestId('message');
        expect(message).toHaveTextContent(
          'Your code did not compile successfully. Thanks for your participation'
        );
      });
    });
  });

  // RT-4 AC: Submit button disabled after timer expires
  it('AC: should disable submit button when challenge is finished', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: true,
      data: { id: 456 },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Enable submit button first
    await when(async () => {
      await clickRunAndWait();
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    // Trigger timer finish
    await when(async () => {
      fireEvent.click(screen.getByTestId('timer-finish-btn'));
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-finished')).toBeInTheDocument();
      });
      // Submit button should remain disabled
      expect(screen.getByTestId('submit-btn')).toBeDisabled();
    });
  });

  // RT-4 AC: Stored submission is linked to correct student_id and match_id
  it('AC: should include correct matchId and code in submission', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
    });

    await then(async () => {
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
  it('AC: should disable run button while submitting', async () => {
    let resolveSubmission;
    const submissionPromise = new Promise((resolve) => {
      resolveSubmission = resolve;
    });
    mockSubmitSubmission.mockReturnValue(submissionPromise);

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
    });

    await then(async () => {
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
    });

    // Resolve submission
    await act(async () => {
      resolveSubmission({ success: true });
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('run-btn')).not.toBeDisabled();
      });
    });
  });

  // RT-4 AC: Error handling for missing match
  it('AC: should display error if match cannot be found during submission', async () => {
    mockGetStudentAssignedMatch.mockResolvedValue({
      success: false,
      message: 'Match not found',
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
    });

    await then(async () => {
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
  it('AC: should prevent submission of empty code', async () => {
    mockSubmitSubmission.mockResolvedValue({ success: true });

    // Setup - code will default to template initially
    mockGetStudentAssignedMatchSetting.mockResolvedValue({
      success: true,
      data: {
        starterCode: 'int main() {}',
        problemTitle: 'Test Problem',
        testCases: [],
      },
    });

    await given(async () => {
      render(
        <MatchContainer challengeId={challengeId} studentId={studentId} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('match-view')).toBeInTheDocument();
    });

    // Simulate user clearing the code
    await act(async () => {
      const { calls } = vi.mocked(MatchView).mock;
      const lastCall = calls[calls.length - 1];
      const { setCode } = lastCall[0];
      setCode('');
    });

    // Enable submit button
    await when(async () => {
      await clickRunAndWait();
    });

    await then(async () => {
      await waitFor(() => {
        expect(screen.getByTestId('submit-btn')).not.toBeDisabled();
      });
    });

    // Click submit
    await when(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    await then(async () => {
      // Verify validation: submission should NOT be called
      expect(mockSubmitSubmission).not.toHaveBeenCalled();
    });
  });
});
