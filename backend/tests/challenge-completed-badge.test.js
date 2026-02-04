import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import User from '#root/models/user.js';
import Badge from '#root/models/badge.js';
import Challenge from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import StudentBadge from '#root/models/student-badges.js';

import { awardChallengeMilestoneBadges } from '#root/services/challenge-completed-badges.js';
import { SubmissionStatus } from '#root/models/enum/enums.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';

/* ------------------------------------------------------------------ */
/* Initialize only the associations required by this test suite */
function initializeMinimalRelations() {
  // ChallengeMatchSetting relations
  ChallengeMatchSetting.initializeRelations?.({
    Challenge,
    MatchSetting,
    Match,
  });

  // Challenge relations
  Challenge.initializeRelations?.({
    ChallengeParticipant,
    ChallengeMatchSetting,
    MatchSetting,
    User,
  });

  // ChallengeParticipant relations
  ChallengeParticipant.initializeRelations?.({
    Challenge,
    Match,
    Submission,
    SubmissionScoreBreakdown,
    User,
    PeerReviewAssignment,
  });

  // Match relations
  Match.initializeRelations?.({
    ChallengeMatchSetting,
    ChallengeParticipant,
    Submission,
  });

  // Submission relations
  Submission.initializeRelations?.({
    Match,
    ChallengeParticipant,
    SubmissionScoreBreakdown,
    PeerReviewAssignment,
  });

  // SubmissionScoreBreakdown relations
  SubmissionScoreBreakdown.initializeRelations?.({
    Submission,
    ChallengeParticipant,
  });

  // StudentBadge relations
  StudentBadge.initializeRelations?.({
    User,
    Badge,
  });
}

/* ------------------------------------------------------------------ */
/* Helper: create one completed challenge for a student */
async function createCompletedChallenge(student, suffix, codeReviewScore = 30) {
  const matchSetting = await MatchSetting.create({
    problemTitle: `Problem ${suffix}`,
    problemDescription: 'desc',
    referenceSolution: 'solution',
    publicTests: [],
    privateTests: [],
    status: 'ready',
  });

  const now = new Date();

  const challenge = await Challenge.create({
    title: `Challenge ${suffix}`,
    duration: 30,
    startDatetime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    endDatetime: new Date(now.getTime() - 60 * 60 * 1000),
    durationPeerReview: 30,
    status: 'ended_phase_one',
  });

  const cms = await ChallengeMatchSetting.create({
    challengeId: challenge.id,
    matchSettingId: matchSetting.id,
  });

  const participant = await ChallengeParticipant.create({
    challengeId: challenge.id,
    studentId: student.id,
  });

  const match = await Match.create({
    challengeMatchSettingId: cms.id,
    challengeParticipantId: participant.id,
  });

  const submission = await Submission.create({
    matchId: match.id,
    challengeParticipantId: participant.id,
    code: 'some code',
    status: SubmissionStatus.PROBABLY_CORRECT,
    isFinal: true,
  });

  await SubmissionScoreBreakdown.create({
    submissionId: submission.id,
    challengeParticipantId: participant.id,
    codeReviewScore,
    implementationScore: 40,
    totalScore: 70,
  });
}

/* ------------------------------------------------------------------ */
/* Test suite */
describe('Challenge milestone badge awarding (backend)', () => {
  beforeAll(async () => {
    // Initialize only required associations
    initializeMinimalRelations();

    const safeSync = async (model) => {
      try {
        await model.sync({ force: true });
      } catch {
        return null;
      }
    };

    await safeSync(User);
    await safeSync(Badge);
    await safeSync(StudentBadge);
    await safeSync(MatchSetting);
    await safeSync(Challenge);
    await safeSync(ChallengeMatchSetting);
    await safeSync(ChallengeParticipant);
    await safeSync(Match);
    await safeSync(Submission);
    await safeSync(SubmissionScoreBreakdown);

    await Badge.seed();
  });

  beforeEach(async () => {
    await StudentBadge.destroy({ where: {} });
    await SubmissionScoreBreakdown.destroy({ where: {} });
    await Submission.destroy({ where: {} });
    await Match.destroy({ where: {} });
    await ChallengeParticipant.destroy({ where: {} });
    await ChallengeMatchSetting.destroy({ where: {} });
    await Challenge.destroy({ where: {} });
    await MatchSetting.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  it('evaluates badge eligibility independently for each participant', async () => {
    const eligibleStudent = await User.create({
      username: 'eligible',
      email: 'eligible@test.com',
      password: 'pw',
      role: 'student',
    });

    const ineligibleStudent = await User.create({
      username: 'ineligible',
      email: 'ineligible@test.com',
      password: 'pw',
      role: 'student',
    });

    for (let i = 0; i < 5; i++) {
      await createCompletedChallenge(eligibleStudent, i);
    }

    for (let i = 0; i < 2; i++) {
      await createCompletedChallenge(ineligibleStudent, i);
    }

    const eligibleResult = await awardChallengeMilestoneBadges(
      eligibleStudent.id
    );
    const ineligibleResult = await awardChallengeMilestoneBadges(
      ineligibleStudent.id
    );

    expect(eligibleResult.completedChallenges).toBe(5);
    expect(eligibleResult.newlyUnlocked.length).toBeGreaterThan(0);

    expect(ineligibleResult.completedChallenges).toBe(2);
    expect(ineligibleResult.newlyUnlocked).toHaveLength(0);
  });

  it('allows a single student to unlock multiple challenge badges in one evaluation', async () => {
    const student = await User.create({
      username: 'multi',
      email: 'multi@test.com',
      password: 'pw',
      role: 'student',
    });

    for (let i = 0; i < 5; i++) {
      await createCompletedChallenge(student, i);
    }

    const result = await awardChallengeMilestoneBadges(student.id);

    expect(result.completedChallenges).toBe(5);
    expect(result.newlyUnlocked.length).toBeGreaterThan(1);
  });

  it('returns only newly unlocked badges and does not return duplicates', async () => {
    const student = await User.create({
      username: 'nodup',
      email: 'nodup@test.com',
      password: 'pw',
      role: 'student',
    });

    for (let i = 0; i < 5; i++) {
      await createCompletedChallenge(student, i);
    }

    const first = await awardChallengeMilestoneBadges(student.id);
    expect(first.newlyUnlocked.length).toBeGreaterThan(0);

    const second = await awardChallengeMilestoneBadges(student.id);
    expect(second.newlyUnlocked).toHaveLength(0);
  });
});
