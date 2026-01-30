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

import {
  ChallengeStatus,
  SubmissionStatus,
  VoteType,
} from '#root/models/enum/enums.js';

import { awardBadgeIfEligible } from '#root/services/challenge-completed-badges-controller.js';

/* ------------------------------------------------------------------ */
const createCompletedChallenge = async (student, suffix) => {
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

  const assignment = await PeerReviewAssignment.create({
    submissionId: submission.id,
    reviewerId: participant.id,
    isExtra: false,
  });

  await PeerReviewVote.create({
    peerReviewAssignmentId: assignment.id,
    vote: VoteType.ABSTAIN,
  });
};

/* ------------------------------------------------------------------ */
/* Test suite */
/* ------------------------------------------------------------------ */
describe('Milestone Badge Service', () => {
  beforeAll(async () => {
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
    await safeSync(PeerReviewAssignment);
    await safeSync(PeerReviewVote);

    await Badge.seed();
  });

  beforeEach(async () => {
    await StudentBadge.destroy({ where: {} });
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

  it('awards multiple milestones correctly', async () => {
    const student = await User.create({
      username: 'all_milestones',
      email: 'all@test.com',
      password: 'pw',
      role: 'student',
    });

    for (let i = 0; i < 10; i++) {
      await createCompletedChallenge(student, i);
    }

    const result = await awardBadgeIfEligible(student.id);

    const badges = result.unlockedBadges;

    expect(badges).toContain('First Steps'); // challenge_3
    expect(badges).toContain('On a Roll'); // challenge_5
    expect(badges).toContain('Challenge Veteran'); // challenge_10
  });
});
