import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CppEditor from '../app/student/challenges/[challengeId]/(components)/CppEditor';

// Mock Monaco Editor
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options, height }) => (
    <textarea
      data-testid='monaco-editor'
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

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveValue(defaultCode);
  });

  // RT-4 AC: Code can be edited
  it('AC: should call onChange when code is modified', () => {
    const onChange = vi.fn();
    render(<CppEditor {...defaultProps} onChange={onChange} />);

    const editor = screen.getByTestId('monaco-editor');
    const newCode = 'cout << "Hello" << endl;';

    fireEvent.change(editor, { target: { value: newCode } });

    expect(onChange).toHaveBeenCalledWith(newCode);
  });

  // RT-4 AC: Editor is read-only when disabled
  it('AC: should disable editor when disabled prop is true', () => {
    const props = { ...defaultProps, disabled: true };
    render(<CppEditor {...props} />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toBeDisabled();
  });

  // RT-4 AC: Editor is editable when enabled
  it('AC: should enable editor when disabled prop is false', () => {
    const props = { ...defaultProps, disabled: false };
    render(<CppEditor {...props} />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).not.toBeDisabled();
  });

  // RT-4 AC: Proper height is set
  it('AC: should set editor height to 50vh', () => {
    render(<CppEditor {...defaultProps} />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveStyle({ height: '50vh' });
  });

  // RT-4 AC: Multiple edits work correctly
  it('AC: should handle multiple consecutive edits', () => {
    const onChange = vi.fn();
    render(<CppEditor {...defaultProps} onChange={onChange} />);

    const editor = screen.getByTestId('monaco-editor');

    // First edit
    fireEvent.change(editor, { target: { value: 'int x = 1;' } });
    expect(onChange).toHaveBeenNthCalledWith(1, 'int x = 1;');

    // Second edit
    fireEvent.change(editor, { target: { value: 'int x = 1;\nint y = 2;' } });
    expect(onChange).toHaveBeenNthCalledWith(2, 'int x = 1;\nint y = 2;');

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  // RT-4 AC: Empty code is handled
  it('AC: should handle empty code', () => {
    const onChange = vi.fn();
    render(<CppEditor value='' onChange={onChange} disabled={false} />);

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveValue('');
  });

  // RT-4 AC: State transitions from editable to read-only
  it('AC: should transition from editable to read-only', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CppEditor value={defaultCode} onChange={onChange} disabled={false} />
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).not.toBeDisabled();

    // Rerender with disabled=true
    rerender(<CppEditor value={defaultCode} onChange={onChange} disabled />);

    const updatedEditor = screen.getByTestId('monaco-editor');
    expect(updatedEditor).toBeDisabled();
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

    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveValue(formattedCode);
  });

  // RT-4 AC: Component renders correctly
  it('AC: should render editor component', () => {
    render(<CppEditor {...defaultProps} />);
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
  });
});
