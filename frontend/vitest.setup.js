import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined') {
  window.IS_REACT_ACT_ENVIRONMENT = true;
}

const originalConsoleError = console.error;
console.error = (...args) => {
  const [firstArg] = args;
  if (
    typeof firstArg === 'string' &&
    firstArg.includes(
      'The current testing environment is not configured to support act(...)'
    )
  ) {
    return;
  }
  originalConsoleError(...args);
};

const createMockEventSource = () => {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((type, cb) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    }),
    removeEventListener: vi.fn((type, cb) => {
      const list = listeners.get(type);
      if (list) {
        const idx = list.indexOf(cb);
        if (idx !== -1) list.splice(idx, 1);
      }
    }),
    close: vi.fn(),
    // Helper to trigger events in tests
    emit: (type, data) => {
      const list = listeners.get(type);
      if (list) {
        list.forEach((cb) => cb(data));
      }
    },
  };
};

function MockEventSource() {
  return createMockEventSource();
}

globalThis.EventSource = MockEventSource;

const createCanvasContextMock = () => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  arc: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  setTransform: vi.fn(),
});

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => createCanvasContextMock()),
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});
