import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Import AFTER mocks are defined
import MatchView from '../app/student/challenges/[challengeId]/(components)/MatchView';

// Mock all child components at the top level
vi.mock(
  '../app/student/challenges/[challengeId]/(components)/CppEditor',
  () => ({
    default: ({ value, onChange, disabled }) => (
      <textarea
        data-testid='cpp-editor'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder='C++ Code Editor'
      />
    ),
  })
);

vi.mock('../app/student/challenges/[challengeId]/(components)/Timer', () => ({
  default: ({ onFinish }) => (
    <button type='button' data-testid='timer' onClick={onFinish}>
      Timer
    </button>
  ),
}));

vi.mock('#components/common/card', () => ({
  Card: ({ children }) => <div data-testid='card'>{children}</div>,
  CardHeader: ({ children }) => <div data-testid='card-header'>{children}</div>,
  CardTitle: ({ children }) => <h2 data-testid='card-title'>{children}</h2>,
  CardDescription: ({ children }) => (
    <p data-testid='card-description'>{children}</p>
  ),
  CardContent: ({ children }) => (
    <div data-testid='card-content'>{children}</div>
  ),
}));

vi.mock('#components/common/Button', () => ({
  Button: ({ children, disabled, onClick, ...props }) => (
    <button type='button' disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('#components/common/Table', () => ({
  Table: ({ children }) => <table>{children}</table>,
  TableHeader: ({ children }) => <thead>{children}</thead>,
  TableBody: ({ children }) => <tbody>{children}</tbody>,
  TableRow: ({ children }) => <tr>{children}</tr>,
  TableHead: ({ children }) => <th>{children}</th>,
  TableCell: ({ children }) => <td>{children}</td>,
}));

vi.mock('#components/common/Spinner', () => ({
  default: ({ label }) => <span data-testid='spinner'>{label}</span>,
}));

vi.mock('#components/common/Tooltip', () => ({
  default: ({ children, text }) => (
    <div data-testid='tooltip' title={text}>
      {children}
    </div>
  ),
}));

vi.mock('../(context)/DurationContext', () => ({
  useDuration: () => ({ duration: 30 }),
}));

describe('RT-4 MatchView Component – UI States', () => {
  const mockMatchData = {
    problemTitle: 'Sum Two Numbers',
    problemDescription: 'Write a function to add two numbers',
    publicTests: [
      { input: { a: 1, b: 2 }, output: 3 },
      { input: { a: 5, b: 7 }, output: 12 },
    ],
  };

  const defaultProps = {
    loading: false,
    error: null,
    message: null,
    matchData: mockMatchData,
    code: '#include <bits/stdc++.h>\nusing namespace std;\n',
    setCode: vi.fn(),
    isRunning: false,
    isSubmitting: false,
    isSubmittingActive: false,
    runResult: null,
    onRun: vi.fn(),
    onSubmit: vi.fn(),
    onTimerFinish: vi.fn(),
    isChallengeFinished: false,
    challengeId: '123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RT-4 AC: Loading state
  it('AC: should display loading state', () => {
    const props = { ...defaultProps, loading: true };

    render(<MatchView {...props} />);

    expect(screen.getByText(/Loading your match/i)).toBeInTheDocument();
  });

  // RT-4 AC: Error state
  it('AC: should display error message when match unavailable', () => {
    const error = { message: 'Match not found' };
    const props = { ...defaultProps, error, matchData: null };

    render(<MatchView {...props} />);

    expect(screen.getByText(/Match unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();
  });

  // RT-4 AC: Challenge finished state
  it('AC: should display challenge completion message when timer expires', () => {
    const props = { ...defaultProps, isChallengeFinished: true };

    render(<MatchView {...props} />);

    expect(screen.getByText(/Phase One Complete/i)).toBeInTheDocument();
  });

  // RT-4 AC: Editor is read-only after challenge finishes
  it('AC: should disable code editor when challenge is finished', () => {
    const props = { ...defaultProps, isChallengeFinished: true };

    render(<MatchView {...props} />);

    expect(screen.getByText(/Phase One Complete/i)).toBeInTheDocument();
    expect(screen.queryByTestId('cpp-editor')).not.toBeInTheDocument();
  });

  // RT-4 AC: Problem description is visible
  it('AC: should display problem title and description', () => {
    const props = { ...defaultProps };

    render(<MatchView {...props} />);

    expect(screen.getByText(mockMatchData.problemTitle)).toBeInTheDocument();
    expect(
      screen.getByText(mockMatchData.problemDescription)
    ).toBeInTheDocument();
  });

  // RT-4 AC: Public test cases are displayed
  it('AC: should display public test cases', () => {
    const props = { ...defaultProps };

    render(<MatchView {...props} />);

    expect(screen.getByText(/Public tests/i)).toBeInTheDocument();
  });

  // RT-4 AC: Run result is displayed
  it('AC: should display run result after code execution', () => {
    const runResult = 'Output: 42';
    const props = { ...defaultProps, runResult };

    render(<MatchView {...props} />);

    expect(screen.getByText(runResult)).toBeInTheDocument();
  });

  // RT-4 AC: Timer is rendered
  it('AC: should render timer component', () => {
    const props = { ...defaultProps };

    render(<MatchView {...props} />);

    expect(screen.getByTestId('timer')).toBeInTheDocument();
  });

  // RT-4 AC: Code editor receives updates
  it('AC: should update code when editor changes', () => {
    const setCode = vi.fn();
    const props = { ...defaultProps, setCode };

    render(<MatchView {...props} />);

    const editor = screen.getByTestId('cpp-editor');
    fireEvent.change(editor, { target: { value: 'new code' } });

    expect(setCode).toHaveBeenCalledWith('new code');
  });

  // RT-4 AC: Challenge finished message with submission summary
  it('AC: should show submission confirmation in challenge finished state', () => {
    const message = 'Thanks for your participation.';
    const props = {
      ...defaultProps,
      isChallengeFinished: true,
      message,
    };

    render(<MatchView {...props} />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  // RT-4 AC: Submit button disabled initially
  it('AC: should have submit button in DOM even when disabled', () => {
    const props = {
      ...defaultProps,
      isSubmittingActive: false,
      isChallengeFinished: false,
    };

    render(<MatchView {...props} />);

    const buttons = screen.queryAllByText('Submit');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // RT-4 AC: Run button is available
  it('AC: should have run button in DOM', () => {
    const props = { ...defaultProps };

    render(<MatchView {...props} />);

    const buttons = screen.queryAllByText('Run');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // RT-4 AC: Error message display
  it('AC: should display error message if submission fails', () => {
    const error = { message: 'Compilation error: missing semicolon' };
    const props = { ...defaultProps, error };

    render(<MatchView {...props} />);

    expect(screen.getByText(error.message)).toBeInTheDocument();
  });

  // RT-4 AC: Success message display
  it('AC: should display success message after successful submission', () => {
    const message = 'Thanks for your submission.';
    const props = { ...defaultProps, message };

    render(<MatchView {...props} />);

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  // RT-4 AC: No public tests message
  it('AC: should display message when no public tests available', () => {
    const props = {
      ...defaultProps,
      matchData: { ...mockMatchData, publicTests: [] },
    };

    render(<MatchView {...props} />);

    expect(screen.getByText(/No public tests available/i)).toBeInTheDocument();
  });
});
