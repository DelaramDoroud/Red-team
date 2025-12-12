import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MatchContainer from '../app/student/challenges/[challengeId]/(components)/MatchContainer';

const mockGetStudentAssignedMatchSetting = vi.fn();

vi.mock('#js/useChallenge', () => ({
  __esModule: true,
  default: () => ({
    getStudentAssignedMatchSetting: mockGetStudentAssignedMatchSetting,
  }),
}));

// DurationContext used by MatchView
vi.mock(
  '../app/student/challenges/[challengeId]/(context)/DurationContext',
  () => ({
    useDuration: () => ({ duration: 30 }),
  })
);

vi.mock(
  '../app/student/challenges/[challengeId]/(components)/CppEditor',
  () => ({
    __esModule: true,
    default: ({ value, onChange }) => (
      <textarea
        data-testid='cpp-editor'
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
  })
);
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

vi.mock('#components/common/Table', () => {
  function Table({ children }) {
    return <table>{children}</table>;
  }
  function TableHeader({ children }) {
    return <thead>{children}</thead>;
  }
  function TableBody({ children }) {
    return <tbody>{children}</tbody>;
  }
  function TableRow({ children }) {
    return <tr>{children}</tr>;
  }
  function TableHead({ children }) {
    return <th>{children}</th>;
  }
  function TableCell({ children }) {
    return <td>{children}</td>;
  }
  return { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
});

describe('Match page – Acceptance criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(global, 'localStorage', {
      value: {
        store: {},
        getItem(key) {
          return this.store[key] || null;
        },
        setItem(key, value) {
          this.store[key] = String(value);
        },
        removeItem(key) {
          delete this.store[key];
        },
        clear() {
          this.store = {};
        },
      },
      writable: true,
    });
  });

  it('Displays problem statement, timer, and public tests', async () => {
    mockGetStudentAssignedMatchSetting.mockResolvedValue({
      success: true,
      data: {
        problemTitle: 'Two Sum',
        problemDescription: 'Given an array, return indices of two numbers...',
        publicTests: [
          { input: [2, 7, 11, 15], output: [0, 1] },
          { input: [3, 2, 4], output: [1, 2] },
        ],
        starterCode: '',
      },
    });

    render(<MatchContainer challengeId={2} studentId={1} />);

    // Full problem statement
    expect(await screen.findByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText(/Given an array/i)).toBeInTheDocument();

    // Timer visible
    expect(screen.getByTestId('timer-value')).toBeInTheDocument();
    expect(screen.getByTestId('timer-value')).toHaveTextContent('Timer:');

    // Public tests visible
    expect(screen.getByText(/Public tests/i)).toBeInTheDocument();
    expect(screen.getByText(/Expected Output/i)).toBeInTheDocument();

    // Rows render
    expect(
      screen.getByText(JSON.stringify([2, 7, 11, 15]))
    ).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify([0, 1]))).toBeInTheDocument();
  });

  it('Shows a clear error when match is unavailable / assignment fails', async () => {
    mockGetStudentAssignedMatchSetting.mockResolvedValue({
      success: false,
      message: 'Assignment failed',
      code: 'ASSIGNMENT_FAILED',
    });

    render(<MatchContainer challengeId={2} studentId={1} />);

    expect(await screen.findByText(/Match unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Assignment failed/i)).toBeInTheDocument();
  });

  it('Shows a clear error when network fails', async () => {
    mockGetStudentAssignedMatchSetting.mockRejectedValue(
      new Error('Network down')
    );

    render(<MatchContainer challengeId={2} studentId={1} />);

    expect(await screen.findByText(/Match unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Network error while loading your match/i)
    ).toBeInTheDocument();
  });
});
