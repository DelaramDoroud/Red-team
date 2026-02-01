import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import User from '#root/models/user.js';
import Badge from '#root/models/badge.js';
import StudentBadge from '#root/models/student-badges.js';
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
/* Helper: create a completed challenge for a student */
const createCompletedChallenge = async (
  student,
  suffix,
  codeReviewScore = 30
) => {
  // 1️⃣ Create a match setting
  const matchSetting = await MatchSetting.create({
    problemTitle: `Problem ${suffix}`,
    problemDescription: 'desc',
    referenceSolution: 'solution',
    publicTests: [],
    privateTests: [],
    status: 'ready',
  });

  // 2️⃣ Create a challenge with all required fields
  const now = new Date();
  const challenge = await Challenge.create({
    title: `Challenge ${suffix}`,
    duration: 30,
    startDatetime: new Date(now.getTime() - 60 * 60 * 1000),
    endDatetime: new Date(now.getTime() - 30 * 60 * 1000),
    durationPeerReview: 20,
    status: 'ended_phase_one',
  });

  // 3️⃣ Link challenge and match setting
  const cms = await ChallengeMatchSetting.create({
    challengeId: challenge.id,
    matchSettingId: matchSetting.id,
  });

  // 4️⃣ Register student participation
  const participant = await ChallengeParticipant.create({
    challengeId: challenge.id,
    studentId: student.id,
  });

  // 5️⃣ Create a match
  const match = await Match.create({
    challengeMatchSettingId: cms.id,
    challengeParticipantId: participant.id,
  });

  // 6️⃣ Create a final submission
  const submission = await Submission.create({
    matchId: match.id,
    challengeParticipantId: participant.id,
    code: 'some code',
    status: SubmissionStatus.PROBABLY_CORRECT,
    isFinal: true,
  });

  // 7️⃣ Create score breakdown
  await SubmissionScoreBreakdown.create({
    submissionId: submission.id,
    codeReviewScore,
    implementationScore: 40,
    totalScore: 70,
  });

  return participant;
};

/* ------------------------------------------------------------------ */
/* Test suite */
describe('Challenge milestone badge awarding (backend)', () => {
  beforeAll(async () => {
    const models = [
      User,
      Badge,
      StudentBadge,
      MatchSetting,
      Challenge,
      ChallengeMatchSetting,
      ChallengeParticipant,
      Match,
      Submission,
      SubmissionScoreBreakdown,
    ];

    for (const model of models) {
      try {
        await model.sync({ force: true });
      } catch {
        return null;
      }
    }

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
    // --- START ADDITION ---
    // Create badges in the DB, otherwise the system won't find any to assign
    await Badge.bulkCreate([
      {
        key: 'challenge_3',
        name: '3 Done',
        description: 'Desc',
        iconUrl: 'url',
      },
      {
        key: 'challenge_5',
        name: '5 Done',
        description: 'Desc',
        iconUrl: 'url',
      },
      {
        key: 'challenge_10',
        name: '10 Done',
        description: 'Desc',
        iconUrl: 'url',
      },
    ]);
    // --- END ADDITION ---

    const eligibleStudent = await User.create({
      username: 'eligible',
      email: 'eligible@test.com',
      password: 'pw',
      role: 'student',
    });

    // ... the rest of your code remains the same ...

    const ineligibleStudent = await User.create({
      username: 'ineligible',
      email: 'ineligible@test.com',
      password: 'pw',
      role: 'student',
    });

    // Eligible student: 5 completed challenges
    for (let i = 0; i < 5; i++)
      await createCompletedChallenge(eligibleStudent, i, 30);

    // Ineligible student: 2 completed challenges
    for (let i = 0; i < 2; i++)
      await createCompletedChallenge(ineligibleStudent, i, 30);

    const eligibleResult = await awardBadgeIfEligible(eligibleStudent.id);
    const ineligibleResult = await awardBadgeIfEligible(ineligibleStudent.id);

    // Eligible student
    const eligibleKeys = eligibleResult.unlockedBadges.map((b) => b.key);

    // Debug (if it fails again, uncomment to see what is returned)
    // console.log('Badges found:', eligibleKeys);

    expect(eligibleResult.completedChallenges).toBe(5);
    expect(eligibleKeys).toContain('challenge_3');
    expect(eligibleKeys).toContain('challenge_5');
    expect(eligibleKeys).not.toContain('challenge_10');

    // Ineligible student
    const ineligibleKeys = ineligibleResult.unlockedBadges.map((b) => b.key);
    expect(ineligibleResult.completedChallenges).toBe(2);
    expect(ineligibleKeys.length).toBe(0);
  });

  it('allows a single student to unlock multiple challenge badges in one evaluation', async () => {
    const student = await User.create({
      username: 'multi',
      email: 'multi@test.com',
      password: 'pw',
      role: 'student',
    });

    // 5 completed challenges → should unlock challenge_3 and challenge_5
    for (let i = 0; i < 5; i++) await createCompletedChallenge(student, i, 30);

    const result = await awardBadgeIfEligible(student.id);
    const keys = result.unlockedBadges.map((b) => b.key);

    expect(result.completedChallenges).toBe(5);
    expect(keys).toContain('challenge_3');
    expect(keys).toContain('challenge_5');
    expect(keys).not.toContain('challenge_10');
  });

  it('returns only newly unlocked badges and does not return duplicates', async () => {
    const student = await User.create({
      username: 'no-dup',
      email: 'nodup@test.com',
      password: 'pw',
      role: 'student',
    });

    // 5 completed challenges
    for (let i = 0; i < 5; i++) await createCompletedChallenge(student, i, 30);

    // First evaluation → badges should be returned
    const first = await awardBadgeIfEligible(student.id);
    expect(first.unlockedBadges.length).toBeGreaterThan(0);

    // Second evaluation → no new badges should be returned
    const second = await awardBadgeIfEligible(student.id);
    expect(second.unlockedBadges.length).toBe(0);
  });
});
