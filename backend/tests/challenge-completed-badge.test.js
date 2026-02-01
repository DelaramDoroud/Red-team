import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import sequelize from '#root/services/sequelize.js';

import User from '#root/models/user.js';
import Badge from '#root/models/badge.js';
import Challenge from '#root/models/challenge.js';
import MatchSetting from '#root/models/match-setting.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Match from '#root/models/match.js';
import Submission from '#root/models/submission.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';

import { awardBadgeIfEligible } from '#root/services/challenge-completed-badges-controller.js';
import { SubmissionStatus } from '#root/models/enum/enums.js';

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
    // Create the full schema once
    await sequelize.sync({ force: true });

    // Seed challenge milestone badges (challenge_3, challenge_5, challenge_10)
    await Badge.seed();
  });

  beforeEach(async () => {
    // Clean DB safely respecting FK constraints
    await sequelize.truncate({ cascade: true });
    await Badge.seed();
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

    // Eligible student → 5 completed challenges
    for (let i = 0; i < 5; i++) {
      await createCompletedChallenge(eligibleStudent, i);
    }

    // Ineligible student → 2 completed challenges
    for (let i = 0; i < 2; i++) {
      await createCompletedChallenge(ineligibleStudent, i);
    }

    const eligibleResult = await awardBadgeIfEligible(eligibleStudent.id);
    const ineligibleResult = await awardBadgeIfEligible(ineligibleStudent.id);

    // Eligible student
    const eligibleKeys = eligibleResult.unlockedBadges.map((b) => b.key);
    expect(eligibleResult.completedChallenges).toBe(5);
    expect(eligibleKeys).toEqual(
      expect.arrayContaining(['challenge_3', 'challenge_5'])
    );
    expect(eligibleKeys).not.toContain('challenge_10');

    // Ineligible student
    expect(ineligibleResult.completedChallenges).toBe(2);
    expect(ineligibleResult.unlockedBadges).toHaveLength(0);
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

    const result = await awardBadgeIfEligible(student.id);
    const keys = result.unlockedBadges.map((b) => b.key);

    expect(result.completedChallenges).toBe(5);
    expect(keys).toEqual(
      expect.arrayContaining(['challenge_3', 'challenge_5'])
    );
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

    const first = await awardBadgeIfEligible(student.id);
    expect(first.unlockedBadges.length).toBeGreaterThan(0);

    const second = await awardBadgeIfEligible(student.id);
    expect(second.unlockedBadges).toHaveLength(0);
  });
});
