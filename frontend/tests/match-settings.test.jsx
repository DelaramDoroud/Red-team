import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import MatchSettingsPage from '../app/match-settings/page';
import MatchSettingForm from '../assets/modules/match-settings/form';

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/match-settings',
}));

const mockGetMatchSettings = vi.fn();
const mockDuplicateMatchSetting = vi.fn();
const mockCreateMatchSetting = vi.fn();
const mockUpdateMatchSetting = vi.fn();
const mockPublishMatchSetting = vi.fn();
const mockUnpublishMatchSetting = vi.fn();
const mockGetMatchSetting = vi.fn();
const mockGetMatchSettingPeerReviewTests = vi.fn();

vi.mock('#js/useMatchSetting', () => ({
  default: () => ({
    loading: false,
    getMatchSettings: mockGetMatchSettings,
    duplicateMatchSetting: mockDuplicateMatchSetting,
    createMatchSetting: mockCreateMatchSetting,
    updateMatchSetting: mockUpdateMatchSetting,
    publishMatchSetting: mockPublishMatchSetting,
    unpublishMatchSetting: mockUnpublishMatchSetting,
    getMatchSetting: mockGetMatchSetting,
    getMatchSettingPeerReviewTests: mockGetMatchSettingPeerReviewTests,
  }),
}));

vi.mock('#js/useRoleGuard', () => ({
  default: () => ({ isAuthorized: true }),
}));

describe('Match Settings UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMatchSettings.mockResolvedValue({
      success: true,
      data: [
        { id: 1, problemTitle: 'Draft setting', status: 'draft' },
        { id: 2, problemTitle: 'Ready setting', status: 'ready' },
      ],
    });
    mockDuplicateMatchSetting.mockResolvedValue({
      success: true,
      data: { id: 10, status: 'draft' },
    });
    mockCreateMatchSetting.mockResolvedValue({
      success: true,
      data: { id: 10, status: 'draft' },
    });
    mockUpdateMatchSetting.mockResolvedValue({
      success: true,
      data: { id: 10, status: 'draft' },
    });
    mockPublishMatchSetting.mockResolvedValue({
      success: true,
      data: { id: 10, status: 'ready' },
    });
    mockUnpublishMatchSetting.mockResolvedValue({
      success: true,
      data: { id: 10, status: 'draft' },
    });
    mockGetMatchSetting.mockResolvedValue({
      success: true,
      data: {
        id: 10,
        problemTitle: 'Loaded setting',
        problemDescription: 'Description',
        referenceSolution: 'int main() { return 0; }',
        publicTests: [],
        privateTests: [],
        status: 'draft',
      },
    });
    mockGetMatchSettingPeerReviewTests.mockResolvedValue({
      success: true,
      data: {
        assignmentCount: 1,
        totalTests: 1,
        tests: [
          {
            assignmentId: 1,
            submissionId: 99,
            createdAt: new Date('2025-11-30T10:00:00Z').toISOString(),
            reviewer: { id: 1, username: 'reviewer' },
            challenge: { id: 10, title: 'Challenge 10' },
            input: '[1,2]',
            expectedOutput: '[2,1]',
            notes: 'Swap needed',
          },
        ],
      },
    });
  });

  it('shows match setting names and status labels', async () => {
    render(<MatchSettingsPage />);

    expect(await screen.findByText('Draft setting')).toBeInTheDocument();
    expect(screen.getByText('Ready setting')).toBeInTheDocument();
    expect(screen.getByText('Ready for use')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows the empty state message when no settings exist', async () => {
    mockGetMatchSettings.mockResolvedValue({ success: true, data: [] });
    render(<MatchSettingsPage />);

    expect(
      await screen.findByText('No match settings available')
    ).toBeInTheDocument();
  });

  it('saves drafts even with incomplete data', async () => {
    const user = userEvent.setup();
    render(<MatchSettingForm />);

    await user.type(
      screen.getByLabelText('Match setting name'),
      'Incomplete draft'
    );

    await user.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(mockCreateMatchSetting).toHaveBeenCalledWith({
        problemTitle: 'Incomplete draft',
        problemDescription: '',
        referenceSolution: '',
        publicTests: [],
        privateTests: [],
      });
    });

    expect(mockRouter.replace).toHaveBeenCalledWith('/match-settings/10');
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument();
  });

  it('blocks publish when required fields are missing', async () => {
    const user = userEvent.setup();
    render(<MatchSettingForm />);

    await user.type(
      screen.getByLabelText('Match setting name'),
      'Publish draft'
    );

    await user.click(screen.getByRole('button', { name: /publish/i }));

    expect(
      await screen.findByText('Problem description is required to publish.')
    ).toBeInTheDocument();
    expect(mockPublishMatchSetting).not.toHaveBeenCalled();
    expect(mockCreateMatchSetting).not.toHaveBeenCalled();
  });

  it('renders peer review test suggestions and allows adding to private tests', async () => {
    const user = userEvent.setup();
    render(<MatchSettingForm matchSettingId={10} />);

    expect(
      await screen.findByText(/Student-submitted tests/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Reviewer: reviewer/i)).toBeInTheDocument();

    const addButton = screen.getByRole('button', {
      name: /add to private tests/i,
    });
    await user.click(addButton);

    expect(
      await screen.findByText(/Test added to private tests/i)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('[1,2]')).toBeInTheDocument();
    expect(screen.getByDisplayValue('[2,1]')).toBeInTheDocument();
  });
});
