import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Timer from '../app/student/challenges/[challengeId]/(components)/Timer';

describe('Countdown Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    Object.defineProperty(global, 'localStorage', {
      value: {
        store: {},
        getItem(key) {
          return this.store[key] || null;
        },
        setItem(key, value) {
          this.store[key] = value;
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down correctly when time passes', async () => {
    render(<Timer duration={1} challengeId={123} />);

    expect(screen.getByTestId('timer-value')).toHaveTextContent(
      'Timer: --:--:--'
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('timer-value')).toHaveTextContent('00:00:59');

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('timer-value')).toHaveTextContent('00:00:58');
  });
});
