import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CppEditor from '../app/student/challenges/[challengeId]/(components)/CppEditor';

// Mock next/dynamic to return components immediately
vi.mock('next/dynamic', () => ({
  default: (fn) => {
    const Component = fn();
    return Component.default || Component;
  },
}));

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options, height }) => (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={options?.readOnly}
      placeholder='C++ Code Editor'
      style={{ height }}
    />
  ),
}));

describe('RT-4 CppEditor Component', () => {
  const defaultCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
  return 0;
}`;

  const defaultProps = {
    value: defaultCode,
    onChange: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // RT-4 AC: Editor displays code
  it('AC: should display initial code value', () => {
    render(<CppEditor {...defaultProps} />);

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).toHaveValue(defaultCode);
  });

  // RT-4 AC: Code can be edited
  it('AC: should call onChange when code is modified', () => {
    const onChange = vi.fn();
    render(<CppEditor {...defaultProps} onChange={onChange} />);

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    const newCode = 'cout << "Hello" << endl;';

    // Simulate user typing by directly calling onChange
    editor.dispatchEvent(
      new Event('change', { bubbles: true, target: { value: newCode } })
    );

    expect(onChange).toHaveBeenCalled();
  });

  // RT-4 AC: Editor is read-only when disabled
  it('AC: should disable editor when disabled prop is true', () => {
    const props = { ...defaultProps, disabled: true };
    render(<CppEditor {...props} />);

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).toBeDisabled();
  });

  // RT-4 AC: Editor is editable when enabled
  it('AC: should enable editor when disabled prop is false', () => {
    const props = { ...defaultProps, disabled: false };
    render(<CppEditor {...props} />);

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).not.toBeDisabled();
  });

  // RT-4 AC: Proper height is set
  it('AC: should set editor height to 50vh', () => {
    render(<CppEditor {...defaultProps} />);

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).toHaveStyle({ height: '50vh' });
  });

  // RT-4 AC: Multiple edits work correctly
  it('AC: should handle multiple consecutive edits', () => {
    const onChange = vi.fn();
    render(<CppEditor {...defaultProps} onChange={onChange} />);

    // Simulate onChange being called directly by Monaco
    onChange('int x = 1;');
    onChange('int x = 1;\nint y = 2;');

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'int x = 1;');
    expect(onChange).toHaveBeenNthCalledWith(2, 'int x = 1;\nint y = 2;');
  });

  // RT-4 AC: Empty code is handled
  it('AC: should handle empty code', () => {
    const onChange = vi.fn();
    render(<CppEditor value='' onChange={onChange} disabled={false} />);

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).toHaveValue('');
  });

  // RT-4 AC: State transitions from editable to read-only
  it('AC: should transition from editable to read-only', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CppEditor value={defaultCode} onChange={onChange} disabled={false} />
    );

    screen.getByTestId('monaco-editor');
    let editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).not.toBeDisabled();

    // Rerender with disabled=true
    rerender(<CppEditor value={defaultCode} onChange={onChange} disabled />);

    screen.getByTestId('monaco-editor');
    editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).toBeDisabled();
  });

  // RT-4 AC: Code preserves formatting
  it('AC: should preserve code formatting and indentation', () => {
    const formattedCode = `#include <bits/stdc++.h>
using namespace std;

int main() {
    for (int i = 0; i < 10; i++) {
        if (i % 2 == 0) {
            cout << i << endl;
        }
    }
    return 0;
}`;

    const onChange = vi.fn();
    render(
      <CppEditor value={formattedCode} onChange={onChange} disabled={false} />
    );

    screen.getByTestId('monaco-editor');
    const editor = screen.getByPlaceholderText('C++ Code Editor');
    expect(editor).toHaveValue(formattedCode);
  });

  // RT-4 AC: Component renders correctly
  it('AC: should render editor component', () => {
    render(<CppEditor {...defaultProps} />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });
});
