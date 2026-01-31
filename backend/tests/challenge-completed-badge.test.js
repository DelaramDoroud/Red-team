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
  // Create a match setting
  const matchSetting = await MatchSetting.create({
    problemTitle: `Problem ${suffix}`,
    problemDescription: 'desc',
    referenceSolution: 'solution',
    publicTests: [],
    privateTests: [],
    status: 'ready',
  });

  // Create a challenge
  const challenge = await Challenge.create({
    title: `Challenge ${suffix}`,
    duration: 30,
    startDatetime: new Date(Date.now() - 60 * 60 * 1000),
    endDatetime: new Date(Date.now() - 30 * 60 * 1000),
    durationPeerReview: 20,
    allowedNumberOfReview: 1,
    status: ChallengeStatus.FINISHED,
  });

  // Link challenge and match setting
  const cms = await ChallengeMatchSetting.create({
    challengeId: challenge.id,
    matchSettingId: matchSetting.id,
  });

  // Create a challenge participant
  const participant = await ChallengeParticipant.create({
    challengeId: challenge.id,
    studentId: student.id,
  });

  // Create a match
  const match = await Match.create({
    challengeMatchSettingId: cms.id,
    challengeParticipantId: participant.id,
  });

  // Create a final submission
  const submission = await Submission.create({
    matchId: match.id,
    challengeParticipantId: participant.id,
    code: 'code',
    status: SubmissionStatus.PROBABLY_CORRECT,
    isFinal: true,
  });

  // Add submission score breakdown
  await SubmissionScoreBreakdown.create({
    submissionId: submission.id,
    codeReviewScore: score,
    implementationScore: 40,
    totalScore: 70,
  });

  // Create peer review assignment
  const assignment = await PeerReviewAssignment.create({
    submissionId: submission.id,
    reviewerId: participant.id,
    isExtra: false,
  });

  // Create an abstain vote
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

    // Sync all required models
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

    // Seed predefined badges
    await Badge.seed();
  });

  beforeEach(async () => {
    // Clean database state before each test
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

    // Create 10 challenges with alternating valid/invalid scores
    for (let i = 0; i < 10; i++) {
      const score = i % 2 === 0 ? 30 : 20;
      await createCompletedChallenge(student, i, score);
    }

    const result = await awardBadgeIfEligible(student.id);
    const badgeNames = result.unlockedBadges.map((b) => b.name);

    // Only 5 challenges are valid
    expect(badgeNames).toContain('First Steps');
    expect(badgeNames).toContain('On a Roll');
    expect(badgeNames).not.toContain('Challenge Veteran');
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

    // Finalize peer review for the first challenge
    const result = await finalizePeerReviewChallenge({
      challengeId: challenges[0].id,
      allowEarly: true,
    });

    // Challenge should be moved to ENDED_PHASE_TWO
    expect(result.challenge.status).toBe(ChallengeStatus.ENDED_PHASE_TWO);

    // unlockedBadges must be returned as an array
    expect(Array.isArray(result.unlockedBadges)).toBe(true);

    const badgeNames = result.unlockedBadges.map((b) => b.name);

    expect(badgeNames).toContain('First Steps');
    expect(badgeNames).toContain('On a Roll');
    expect(badgeNames).not.toContain('Challenge Veteran');
  });
});
