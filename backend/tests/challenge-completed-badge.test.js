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
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';

import {
  ChallengeStatus,
  SubmissionStatus,
  VoteType,
} from '#root/models/enum/enums.js';

import { awardBadgeIfEligible } from '#root/services/challenge-completed-badges-controller.js';
import finalizePeerReviewChallenge from '#root/services/finalize-peer-review.js';

/* ------------------------------------------------------------------ */
/* Helper: create a completed challenge for a student */
const createCompletedChallenge = async (student, suffix, score = 30) => {
  const matchSetting = await MatchSetting.create({
    problemTitle: `Problem ${suffix}`,
    problemDescription: 'desc',
    referenceSolution: 'solution',
    publicTests: [],
    privateTests: [],
    status: 'ready',
  });

  const challenge = await Challenge.create({
    title: `Challenge ${suffix}`,
    duration: 30,
    startDatetime: new Date(Date.now() - 60 * 60 * 1000),
    endDatetime: new Date(Date.now() - 30 * 60 * 1000),
    durationPeerReview: 20,
    allowedNumberOfReview: 1,
    status: ChallengeStatus.FINISHED,
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
    code: 'code',
    status: SubmissionStatus.PROBABLY_CORRECT,
    isFinal: true,
  });

  await SubmissionScoreBreakdown.create({
    submissionId: submission.id,
    codeReviewScore: score,
    implementationScore: 40,
    totalScore: 70,
  });

  const assignment = await PeerReviewAssignment.create({
    submissionId: submission.id,
    reviewerId: participant.id,
    isExtra: false,
  });

  await PeerReviewVote.create({
    peerReviewAssignmentId: assignment.id,
    vote: VoteType.ABSTAIN,
  });

  return challenge;
};

/* ------------------------------------------------------------------ */
/* Test suite */
describe('Milestone Badge Service', () => {
  beforeAll(async () => {
    const safeSync = async (model) => {
      try {
        await model.sync({ force: true });
      } catch {
        return null;
      }
    };

    // Sync models
    await safeSync(User);
    await safeSync(Badge);
    await safeSync(StudentBadge);
    await safeSync(MatchSetting);
    await safeSync(Challenge);
    await safeSync(ChallengeMatchSetting);
    await safeSync(ChallengeParticipant);
    await safeSync(Match);
    await safeSync(Submission);
    await safeSync(PeerReviewAssignment);
    await safeSync(PeerReviewVote);
    await safeSync(SubmissionScoreBreakdown);

    // Seed badges
    await Badge.seed();
  });

  beforeEach(async () => {
    await StudentBadge.destroy({ where: {} });
    await SubmissionScoreBreakdown.destroy({ where: {} });
    await PeerReviewVote.destroy({ where: {} });
    await PeerReviewAssignment.destroy({ where: {} });
    await Submission.destroy({ where: {} });
    await Match.destroy({ where: {} });
    await ChallengeParticipant.destroy({ where: {} });
    await ChallengeMatchSetting.destroy({ where: {} });
    await Challenge.destroy({ where: {} });
    await MatchSetting.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  it('awards milestone badges correctly via badge service', async () => {
    const student = await User.create({
      username: 'all_milestones',
      email: 'all@test.com',
      password: 'pw',
      role: 'student',
    });

    // 10 challenges, alternating valid/invalid scores
    for (let i = 0; i < 10; i++) {
      const score = i % 2 === 0 ? 30 : 20;
      await createCompletedChallenge(student, i, score);
    }

    const result = await awardBadgeIfEligible(student.id);
    const badgeKeys = result.unlockedBadges.map((b) => b.key);

    expect(badgeKeys).toContain('challenge_3'); // First Steps
    expect(badgeKeys).toContain('challenge_5'); // On a Roll
    expect(badgeKeys).not.toContain('challenge_10'); // Challenge Veteran
  });

  it('finalizes peer review and returns unlocked milestone badges', async () => {
    const student = await User.create({
      username: 'peer_review_student',
      email: 'peer@test.com',
      password: 'pw',
      role: 'student',
    });

    const challenges = [];
    for (let i = 0; i < 10; i++) {
      const score = i % 2 === 0 ? 30 : 20;
      challenges.push(await createCompletedChallenge(student, i, score));
    }

    // Finalize peer review for first challenge
    await finalizePeerReviewChallenge({
      challengeId: challenges[0].id,
      allowEarly: true,
    });

    // Ora recuperiamo i badge sbloccati
    const result = await awardBadgeIfEligible(student.id);

    expect(Array.isArray(result.unlockedBadges)).toBe(true);

    const badgeKeys = result.unlockedBadges.map((b) => b.key);

    expect(badgeKeys).toContain('challenge_3');
    expect(badgeKeys).toContain('challenge_5');
    expect(badgeKeys).not.toContain('challenge_10');
  });
});
