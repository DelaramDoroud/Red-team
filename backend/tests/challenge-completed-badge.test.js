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

  // Create a participant
  const participant = await ChallengeParticipant.create({
    challengeId: challenge.id,
    studentId: student.id,
  });

  // Create a match for the participant
  const match = await Match.create({
    challengeMatchSettingId: cms.id,
    challengeParticipantId: participant.id,
  });

  // Create a final submission with reviewable status
  const submission = await Submission.create({
    matchId: match.id,
    challengeParticipantId: participant.id,
    code: 'code',
    status: SubmissionStatus.PROBABLY_CORRECT,
    isFinal: true,
  });

  // 🔹 Add submission score for code review
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

  // Create a peer review vote (ABSTAIN)
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

    // Sync all models
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
    // Clear all tables before each test
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

  it('awards multiple milestones correctly via direct badge service', async () => {
    const student = await User.create({
      username: 'all_milestones',
      email: 'all@test.com',
      password: 'pw',
      role: 'student',
    });

    // Create 10 challenges with alternating codeReviewScore
    for (let i = 0; i < 10; i++) {
      const score = i % 2 === 0 ? 30 : 20; // only even-indexed submissions count
      await createCompletedChallenge(student, i, score);
    }

    // Award badges
    const result = await awardBadgeIfEligible(student.id);
    const badges = result.unlockedBadges;

    // Only 5 challenges are valid → only milestones for 5 challenges should be unlocked
    expect(badges).toContain('First Steps'); // milestone 1
    expect(badges).toContain('On a Roll'); // milestone 5
    expect(badges).not.toContain('Challenge Veteran'); // milestone 10 not reached
  });

  it('finalizes peer review and triggers badge awarding', async () => {
    const student = await User.create({
      username: 'peer_review_student',
      email: 'peer@test.com',
      password: 'pw',
      role: 'student',
    });

    const challenges = [];
    for (let i = 0; i < 10; i++) {
      const score = i % 2 === 0 ? 30 : 20;
      const challenge = await createCompletedChallenge(student, i, score);
      challenges.push(challenge);
    }

    // Finalize peer review for the first challenge
    const challengeToFinalize = challenges[0];
    const result = await finalizePeerReviewChallenge({
      challengeId: challengeToFinalize.id,
      allowEarly: true,
    });

    // Check that challenge phase two is ended
    expect(result.challenge.status).toBe(ChallengeStatus.ENDED_PHASE_TWO);
    expect(result.badgeUnlocked).toBe(true);

    // Check that the correct badges are awarded to the student
    const studentBadges = result.badgesAwarded.find(
      (b) => b.studentId === student.id
    );

    expect(studentBadges).toBeDefined();
    expect(studentBadges.unlockedBadges).toContain('First Steps');
    expect(studentBadges.unlockedBadges).toContain('On a Roll');
    expect(studentBadges.unlockedBadges).not.toContain('Challenge Veteran');
  });
});
