import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import NewChallengePage from '../app/new-challenge/page';

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
    expect(await screen.findByText('Ready Problem 1')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
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

    await screen.findByText('Ready Problem 1');

    await user.type(screen.getByLabelText(/Challenge Name/i), 'Test Challenge');

    fireEvent.change(screen.getByLabelText(/Start Date\/Time/i), {
      target: { value: '2025-12-01T10:00' },
    });
    fireEvent.change(screen.getByLabelText(/End Date\/Time/i), {
      target: { value: '2025-12-01T12:00' },
    });

    await user.clear(screen.getByLabelText('Duration (min)'));
    await user.type(screen.getByLabelText('Duration (min)'), '60');

    await user.clear(screen.getByLabelText('Duration Peer Review (min)'));
    await user.type(screen.getByLabelText('Duration Peer Review (min)'), '60');

    fireEvent.submit(screen.getByTestId('challenge-form'));

    expect(
      await screen.findByText(/Select at least one match setting/i)
    ).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/End Date\/Time/i), {
      target: { value: '2025-12-01T12:00' },
    });

    await user.clear(screen.getByLabelText('Duration (min)'));
    await user.type(screen.getByLabelText('Duration (min)'), '60');

    await user.clear(screen.getByLabelText('Duration Peer Review (min)'));
    await user.type(screen.getByLabelText('Duration Peer Review (min)'), '60');

    const checkbox = await screen.findAllByLabelText('select setting');
    await user.click(checkbox[0]);

    fireEvent.submit(screen.getByTestId('challenge-form'));

    expect(mockCreateChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Valid Challenge',
        duration: 60,
        durationPeerReview: 60,
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
    fireEvent.change(screen.getByLabelText(/End Date\/Time/i), {
      target: { value: '2025-12-01T11:00' },
    });

    await user.clear(screen.getByLabelText('Duration (min)'));
    await user.type(screen.getByLabelText('Duration (min)'), '60');

    await user.clear(screen.getByLabelText('Duration Peer Review (min)'));
    await user.type(screen.getByLabelText('Duration Peer Review (min)'), '60');

    const checkbox = await screen.findAllByLabelText('select setting');
    await user.click(checkbox[0]);

    await user.click(screen.getByTestId('create-challenge-button'));

    mockCreateChallenge.mockResolvedValue({
      success: false,
      message:
        'End date/time must accommodate challenge and peer review durations',
    });
  });
});
