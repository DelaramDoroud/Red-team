import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import toast from 'react-hot-toast';
import ChallengeForm from '#components/challenge/ChallengeForm';

// Mock the useChallenge hook
const mockCreateChallenge = vi.fn();
vi.mock('#js/useChallenge', () => ({
  default: () => ({
    loading: false,
    createChallenge: mockCreateChallenge,
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ChallengeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateChallenge.mockReset();
  });

  describe('Form Rendering', () => {
    it('renders all form fields', () => {
      render(<ChallengeForm />);

      expect(screen.getByLabelText(/Challenge Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Duration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Start Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Match Settings/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Create Challenge/i })
      ).toBeInTheDocument();
    });

    it('displays ready match settings only', () => {
      render(<ChallengeForm />);

      expect(screen.getByText(/Algorithm Challenge 1/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Data Structures Challenge/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/API Design Challenge/i)).toBeInTheDocument();
      // SQL Query Challenge has ready: false, so should not appear
      expect(
        screen.queryByText(/SQL Query Challenge/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows error when title is empty and form is submitted', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
    });

    it('shows error when duration is empty', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      expect(
        await screen.findByText(/Duration is required/i)
      ).toBeInTheDocument();
    });

    it('shows error when duration is zero', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const durationInput = screen.getByLabelText(/Duration/i);
      await user.clear(durationInput);
      await user.type(durationInput, '0');

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      expect(
        await screen.findByText(/Duration must be greater than 0/i)
      ).toBeInTheDocument();
    });

    it('shows error when start date is empty', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      expect(
        await screen.findByText(/Start date is required/i)
      ).toBeInTheDocument();
    });

    it('shows error when start time is empty', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      expect(
        await screen.findByText(/Start time is required/i)
      ).toBeInTheDocument();
    });

    it('shows error when no match settings are selected', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const titleInput = screen.getByLabelText(/Challenge Title/i);
      const durationInput = screen.getByLabelText(/Duration/i);
      const dateInput = screen.getByLabelText(/Start Date/i);
      const timeInput = screen.getByLabelText(/Start Time/i);

      await user.type(titleInput, 'Test Challenge');
      await user.type(durationInput, '60');
      await user.type(dateInput, '2025-12-31');
      await user.type(timeInput, '14:00');

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      expect(
        await screen.findByText(/At least one match setting must be selected/i)
      ).toBeInTheDocument();
    });

    it('clears errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      // Wait for error to appear
      expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();

      // Start typing in title field
      const titleInput = screen.getByLabelText(/Challenge Title/i);
      await user.type(titleInput, 'New');

      // Error should be cleared
      expect(screen.queryByText(/Title is required/i)).not.toBeInTheDocument();
    });
  });

  describe('Match Settings Selection', () => {
    it('allows selecting match settings with checkboxes', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const checkbox = screen.getByRole('checkbox', {
        name: /Algorithm Challenge 1/i,
      });
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('displays selected count when match settings are selected', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const checkbox1 = screen.getByRole('checkbox', {
        name: /Algorithm Challenge 1/i,
      });
      const checkbox2 = screen.getByRole('checkbox', {
        name: /Data Structures Challenge/i,
      });

      await user.click(checkbox1);
      expect(screen.getByText(/\(1 selected\)/i)).toBeInTheDocument();

      await user.click(checkbox2);
      expect(screen.getByText(/\(2 selected\)/i)).toBeInTheDocument();
    });

    it('clears match settings error when a setting is selected', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      // Wait for match settings error to appear
      expect(
        await screen.findByText(/At least one match setting must be selected/i)
      ).toBeInTheDocument();

      // Select a match setting
      const checkbox = screen.getByRole('checkbox', {
        name: /Algorithm Challenge 1/i,
      });
      await user.click(checkbox);

      // Error should be cleared
      expect(
        screen.queryByText(/At least one match setting must be selected/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data', async () => {
      const user = userEvent.setup();
      mockCreateChallenge.mockResolvedValue({ success: true });

      render(<ChallengeForm />);

      // Fill in all fields
      const titleInput = screen.getByLabelText(/Challenge Title/i);
      const durationInput = screen.getByLabelText(/Duration/i);
      const dateInput = screen.getByLabelText(/Start Date/i);
      const timeInput = screen.getByLabelText(/Start Time/i);

      await user.type(titleInput, 'Test Challenge');
      await user.type(durationInput, '60');
      await user.type(dateInput, '2025-12-31');
      await user.type(timeInput, '14:00');

      // Select a match setting
      const checkbox = screen.getByRole('checkbox', {
        name: /Algorithm Challenge 1/i,
      });
      await user.click(checkbox);

      // Submit form
      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateChallenge).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Challenge',
            duration: 60,
            status: 'draft',
            matchSettings: [1],
          })
        );
        // Check startDatetime separately since it depends on timezone
        const call = mockCreateChallenge.mock.calls[0][0];
        expect(call.startDatetime).toMatch(/2025-12-31T/);
      });
    });

    it('resets form after successful submission', async () => {
      const user = userEvent.setup();
      mockCreateChallenge.mockResolvedValue({ success: true });

      render(<ChallengeForm />);

      // Fill in all fields
      const titleInput = screen.getByLabelText(/Challenge Title/i);
      const durationInput = screen.getByLabelText(/Duration/i);
      const dateInput = screen.getByLabelText(/Start Date/i);
      const timeInput = screen.getByLabelText(/Start Time/i);

      await user.type(titleInput, 'Test Challenge');
      await user.type(durationInput, '60');
      await user.type(dateInput, '2025-12-31');
      await user.type(timeInput, '14:00');

      const checkbox = screen.getByRole('checkbox', {
        name: /Algorithm Challenge 1/i,
      });
      await user.click(checkbox);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(titleInput).toHaveValue('');
        expect(durationInput).toHaveDisplayValue('');
        expect(dateInput).toHaveValue('');
        expect(timeInput).toHaveValue('');
        expect(checkbox).not.toBeChecked();
      });
    });

    it('does not submit when validation fails', async () => {
      const user = userEvent.setup();
      render(<ChallengeForm />);

      const submitButton = screen.getByRole('button', {
        name: /Create Challenge/i,
      });
      await user.click(submitButton);

      // Should show errors but not call API
      await waitFor(() => {
        expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
      });

      expect(mockCreateChallenge).not.toHaveBeenCalled();
    });

    it('submits with multiple match settings selected', async () => {
      const user = userEvent.setup();
      mockCreateChallenge.mockResolvedValue({ success: true });

      render(<ChallengeForm />);

      // Fill in all fields
      await user.type(
        screen.getByLabelText(/Challenge Title/i),
        'Test Challenge'
      );
      await user.type(screen.getByLabelText(/Duration/i), '60');
      await user.type(screen.getByLabelText(/Start Date/i), '2025-12-31');
      await user.type(screen.getByLabelText(/Start Time/i), '14:00');

      // Select multiple match settings
      await user.click(
        screen.getByRole('checkbox', { name: /Algorithm Challenge 1/i })
      );
      await user.click(
        screen.getByRole('checkbox', { name: /Data Structures Challenge/i })
      );
      await user.click(
        screen.getByRole('checkbox', { name: /API Design Challenge/i })
      );

      await user.click(
        screen.getByRole('button', { name: /Create Challenge/i })
      );

      await waitFor(() => {
        expect(mockCreateChallenge).toHaveBeenCalledWith(
          expect.objectContaining({
            matchSettings: [1, 2, 4],
          })
        );
      });
    });
  });

  describe('API Error Handling', () => {
    it('handles API error on submission', async () => {
      const user = userEvent.setup();
      mockCreateChallenge.mockResolvedValue({
        success: false,
        message: 'Server error',
      });

      render(<ChallengeForm />);

      // Fill in valid data
      await user.type(
        screen.getByLabelText(/Challenge Title/i),
        'Test Challenge'
      );
      await user.type(screen.getByLabelText(/Duration/i), '60');
      await user.type(screen.getByLabelText(/Start Date/i), '2025-12-31');
      await user.type(screen.getByLabelText(/Start Time/i), '14:00');
      await user.click(
        screen.getByRole('checkbox', { name: /Algorithm Challenge 1/i })
      );

      await user.click(
        screen.getByRole('button', { name: /Create Challenge/i })
      );

      await waitFor(() => {
        expect(mockCreateChallenge).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Server error');
      });

      expect(screen.getByLabelText(/Challenge Title/i)).toHaveValue(
        'Test Challenge'
      );
      expect(screen.getByLabelText(/Duration/i)).toHaveValue('60');
      expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2025-12-31');
      expect(screen.getByLabelText(/Start Time/i)).toHaveValue('14:00');
      expect(
        screen.getByRole('checkbox', { name: /Algorithm Challenge 1/i })
      ).toBeChecked();
    });
  });
});
