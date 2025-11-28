import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import NewChallengePage from '../app/newChallenge/page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockGetMatchSettingsReady = vi.fn();
vi.mock('#js/useMatchSetting', () => ({
  default: () => ({
    loading: false,
    getMatchSettingsReady: mockGetMatchSettingsReady,
  }),
}));

const mockCreateChallenge = vi.fn();
vi.mock('#js/useChallenge', () => ({
  default: () => ({
    loadingChallenge: false,
    createChallenge: mockCreateChallenge,
  }),
}));

describe('Create Challenge Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMatchSettingsReady.mockResolvedValue({
      success: true,
      data: [
        { id: 1, problemTitle: 'Ready Problem 1', status: 'ready' },
        { id: 2, problemTitle: 'Ready Problem 2', status: 'ready' },
      ],
    });
  });

  it('AC: Displays only ready match settings', async () => {
    mockGetMatchSettingsReady.mockResolvedValue({
      success: true,
      data: [{ id: 1, problemTitle: 'Ready Problem 1', status: 'ready' }],
    });

    render(<NewChallengePage />);

    // Wait for loading
    expect(await screen.findByText('Ready Problem 1')).toBeInTheDocument();

    // Ensure table rows exist
    const rows = screen.getAllByRole('row');
    // Header + 1 data row = 2 rows
    expect(rows).toHaveLength(2);
  });

  it('AC: Match setting row can be toggled on/off', async () => {
    const user = userEvent.setup();
    render(<NewChallengePage />);

    const checkboxes = await screen.findAllByLabelText('select setting', {
      selector: 'input[type="checkbox"]',
    });
    const checkbox = checkboxes[0];

    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('AC: Teacher cannot create a challenge unless at least one match setting is selected', async () => {
    const user = userEvent.setup();
    render(<NewChallengePage />);

    await user.type(screen.getByLabelText(/Challenge Name/i), 'Test Challenge');

    const startInput = screen.getByLabelText(/Start Date\/Time/i);
    fireEvent.change(startInput, { target: { value: '2025-12-01T10:00' } });

    const durationInput = screen.getByLabelText(/Duration/i);
    await user.clear(durationInput);
    await user.type(durationInput, '60');

    const endInput = screen.getByLabelText(/End Date\/Time/i);
    fireEvent.change(endInput, { target: { value: '2025-12-01T12:00' } });

    const pStartInput = screen.getByLabelText(/Peer Review Start/i);
    fireEvent.change(pStartInput, { target: { value: '2025-12-01T12:05' } });

    const pEndInput = screen.getByLabelText(/Peer Review End/i);
    fireEvent.change(pEndInput, { target: { value: '2025-12-02T12:00' } });

    const createButton = screen.getByRole('button', { name: /Create/i });
    await user.click(createButton);

    expect(
      await screen.findByText(/Select at least one match setting/i)
    ).toBeInTheDocument();
    expect(mockCreateChallenge).not.toHaveBeenCalled();
  });

  it('AC: Challenge created successfully when valid fields and match setting selected', async () => {
    const user = userEvent.setup();
    mockCreateChallenge.mockResolvedValue({
      success: true,
      challenge: { id: 123 },
    });

    render(<NewChallengePage />);

    await user.type(
      screen.getByLabelText(/Challenge Name/i),
      'Valid Challenge'
    );

    fireEvent.change(screen.getByLabelText(/Start Date\/Time/i), {
      target: { value: '2025-12-01T10:00' },
    });

    const durationInput = screen.getByLabelText(/Duration/i);
    await user.clear(durationInput);
    await user.type(durationInput, '60');

    fireEvent.change(screen.getByLabelText(/End Date\/Time/i), {
      target: { value: '2025-12-01T12:00' },
    });
    fireEvent.change(screen.getByLabelText(/Peer Review Start/i), {
      target: { value: '2025-12-01T12:05' },
    });
    fireEvent.change(screen.getByLabelText(/Peer Review End/i), {
      target: { value: '2025-12-02T12:00' },
    });

    const checkbox = await screen.findAllByLabelText('select setting');
    await user.click(checkbox[0]); // Select first one

    await user.click(screen.getByRole('button', { name: /Create/i }));

    expect(mockCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Valid Challenge',
        duration: 60,
        matchSettingIds: [1],
        status: 'public',
        startDatetime: expect.stringContaining('2025-12-01'),
        endDatetime: expect.stringContaining('2025-12-01'),
      })
    );

    expect(
      await screen.findByText(/Challenge created successfully/i)
    ).toBeInTheDocument();

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/challenges');
      },
      { timeout: 4000 }
    );
  });

  it('Validates time window (End date must accommodate duration)', async () => {
    const user = userEvent.setup();
    render(<NewChallengePage />);

    fireEvent.change(screen.getByLabelText(/Start Date\/Time/i), {
      target: { value: '2025-12-01T10:00' },
    });

    const durationInput = screen.getByLabelText(/Duration/i);
    await user.clear(durationInput);
    await user.type(durationInput, '120');

    fireEvent.change(screen.getByLabelText(/End Date\/Time/i), {
      target: { value: '2025-12-01T11:00' },
    });

    const checkbox = await screen.findAllByLabelText('select setting');
    await user.click(checkbox[0]);

    await user.click(screen.getByRole('button', { name: /Create/i }));

    mockCreateChallenge.mockResolvedValue({
      success: false,
      message:
        'Error: The time window (end - start) must be greater than or equal to the duration.',
    });
  });
});
