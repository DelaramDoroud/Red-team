import { Op } from 'sequelize';
import Challenge from '#root/models/challenge.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import { VoteType } from '#root/models/enum/enums.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import Submission from '#root/models/submission.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import { executeCodeTests } from '#root/services/execute-code-tests.js';
import logger from '#root/services/logger.js';

export async function calculateChallengeScores(challengeId) {
  logger.info(`Starting FULL score calculation for Challenge ${challengeId}`);

  const challenge = await Challenge.findByPk(challengeId, {
    include: [
      {
        model: ChallengeMatchSetting,
        as: 'challengeMatchSettings',
        include: [{ model: MatchSetting, as: 'matchSetting' }],
      },
    ],
  });

  if (!challenge) throw new Error(`Challenge ${challengeId} not found`);

  const matchSettingsMap = new Map();
  challenge.challengeMatchSettings.forEach((cms) => {
    if (cms.matchSetting) {
      matchSettingsMap.set(cms.id, cms.matchSetting);
    }
  });

  const participants = await ChallengeParticipant.findAll({
    where: { challengeId },
    include: [
      {
        model: Submission,
        as: 'submissions',
        required: false,
        where: { isFinal: true },
        include: [
          {
            model: Match,
            as: 'match',
          },
        ],
      },
    ],
  });

  const validSubmissions = participants
    .map((p) =>
      p.submissions && p.submissions.length > 0 ? p.submissions[0] : null
    )
    .filter((s) => s && s.id);

  const assignments = await PeerReviewAssignment.findAll({
    where: {
      [Op.or]: [
        { submissionId: { [Op.in]: validSubmissions.map((s) => s.id) } },
        { reviewerId: { [Op.in]: participants.map((p) => p.id) } },
      ],
    },
    include: [
      { model: PeerReviewVote, as: 'vote', required: false },
      { model: Submission, as: 'submission' },
    ],
  });

  const incorrectVotesWithTests = assignments
    .map((a) => a.vote)
    .filter(
      (vote) => vote && vote.vote === VoteType.INCORRECT && vote.testCaseInput
    );

  const votesByMatchSetting = new Map();

  for (const vote of incorrectVotesWithTests) {
    const assignment = assignments.find(
      (a) => a.id === vote.peerReviewAssignmentId
    );
    if (!assignment) continue;

    const reviewedSubmission = validSubmissions.find(
      (s) => s.id === assignment.submissionId
    );

    if (!reviewedSubmission || !reviewedSubmission.match) continue;

    const cmsId = reviewedSubmission.match.challengeMatchSettingId;
    const matchSetting = matchSettingsMap.get(cmsId);

    if (matchSetting) {
      if (!votesByMatchSetting.has(matchSetting.id)) {
        votesByMatchSetting.set(matchSetting.id, {
          setting: matchSetting,
          votes: [],
        });
      }
      votesByMatchSetting.get(matchSetting.id).votes.push(vote);
    }
  }

  for (const { setting, votes } of votesByMatchSetting.values()) {
    const referenceCode = setting.referenceSolution;

    if (!referenceCode) continue;

    const testCases = votes.map((v) => ({
      input: v.testCaseInput,
      expectedOutput: v.expectedOutput,
    }));

    const execResult = await executeCodeTests({
      code: referenceCode,
      language: 'cpp',
      testCases: testCases,
      userId: null,
    });

    if (execResult.isCompiled) {
      // no-op: this precheck validates reference execution compatibility
    }
  }

  const submissionTruthMap = new Map();
  const implementationStatsMap = new Map();

  for (const submission of validSubmissions) {
    let passedTeacherTests = 0;
    let totalTeacherTests = 0;
    const cmsId = submission.match?.challengeMatchSettingId;
    const matchSetting = matchSettingsMap.get(cmsId);

    let teacherResults = [];
    try {
      teacherResults =
        typeof submission.privateTestResults === 'string'
          ? JSON.parse(submission.privateTestResults)
          : submission.privateTestResults || [];
    } catch (e) {
      teacherResults = [];
    }

    if (Array.isArray(teacherResults)) {
      totalTeacherTests = teacherResults.length;
      passedTeacherTests = teacherResults.filter((r) => r.passed).length;
    }

    if (totalTeacherTests === 0 && matchSetting?.privateTests) {
      const tests = Array.isArray(matchSetting.privateTests)
        ? matchSetting.privateTests
        : [];
      totalTeacherTests = tests.length;
    }

    const isTeacherPassed =
      totalTeacherTests > 0 && passedTeacherTests === totalTeacherTests;

    const relevantAssignments = assignments.filter(
      (a) => a.submissionId === submission.id
    );

    const killerVotes = relevantAssignments
      .map((a) => a.vote)
      .filter(
        (v) => v && v.vote === VoteType.INCORRECT && v.isExpectedOutputCorrect
      );

    let failedPeerTestCount = 0;
    let totalValidPeerTests = killerVotes.length;

    if (killerVotes.length > 0) {
      const testCases = killerVotes.map((v) => ({
        input: v.testCaseInput,
        expectedOutput: v.expectedOutput,
      }));

      const execResult = await executeCodeTests({
        code: submission.code,
        language: 'cpp',
        testCases: testCases,
        userId: null,
      });

      if (execResult.isCompiled) {
        execResult.testResults.forEach((result) => {
          if (!result.passed) failedPeerTestCount++;
        });
      }
    }

    implementationStatsMap.set(submission.id, {
      passedTeacher: passedTeacherTests,
      totalTeacher: totalTeacherTests,
      failedPeer: failedPeerTestCount,
      totalPeer: totalValidPeerTests,
    });

    const isUltimatelyCorrect = isTeacherPassed && failedPeerTestCount === 0;
    submissionTruthMap.set(submission.id, isUltimatelyCorrect);
  }

  const results = [];

  const reviewerAssignmentsMap = new Map();
  assignments.forEach((a) => {
    if (!reviewerAssignmentsMap.has(a.reviewerId)) {
      reviewerAssignmentsMap.set(a.reviewerId, []);
    }
    reviewerAssignmentsMap.get(a.reviewerId).push(a);
  });

  for (const participant of participants) {
    const reviewerId = participant.id;
    const revAssignments = reviewerAssignmentsMap.get(reviewerId) || [];

    const reviewerSubmission =
      participant.submissions && participant.submissions.length > 0
        ? participant.submissions[0]
        : null;

    let E = 0,
      C = 0,
      W = 0,
      I_total = 0,
      C_total = 0;

    for (const assignment of revAssignments) {
      const isSubmissionCorrect = submissionTruthMap.get(
        assignment.submissionId
      );

      if (isSubmissionCorrect) C_total++;
      else I_total++;

      const vote = assignment.vote;
      if (!vote || vote.vote === VoteType.ABSTAIN) continue;

      if (vote.vote === VoteType.CORRECT) {
        if (vote.isVoteCorrect) C++;
        else {
          isSubmissionCorrect ? C++ : W++;
        }
      } else if (vote.vote === VoteType.INCORRECT) {
        if (vote.isExpectedOutputCorrect && vote.isVoteCorrect) E++;
        else {
          if (vote.isExpectedOutputCorrect && !isSubmissionCorrect) E++;
          else W++;
        }
      }
    }

    E = 0;
    C = 0;
    W = 0;
    for (const assignment of revAssignments) {
      const isSubCorrect = submissionTruthMap.get(assignment.submissionId);
      const v = assignment.vote;
      if (!v || v.vote === VoteType.ABSTAIN) continue;

      if (v.vote === VoteType.CORRECT) {
        if (isSubCorrect) C++;
        else W++;
      } else if (v.vote === VoteType.INCORRECT) {
        if (v.isExpectedOutputCorrect && !isSubCorrect) {
          if (v.isVoteCorrect) E++;
          else if (isSubCorrect === false && v.isVoteCorrect === undefined) {
            E++;
          } else {
            W++;
          }
        } else {
          W++;
        }
      }
    }

    const numerator = 2 * E + C - 0.5 * W;
    const denominator = 2 * I_total + C_total;
    let rawReviewScore = denominator > 0 ? 50 * (numerator / denominator) : 0;

    if (denominator === 0 && E + C + W === 0) rawReviewScore = 0;

    const finalReviewScore = parseFloat(
      Math.max(0, Math.min(50, rawReviewScore)).toFixed(2)
    );

    let implementationScore = 0;
    let implStats = {
      passedTeacher: 0,
      totalTeacher: 0,
      failedPeer: 0,
      totalPeer: 0,
    };

    if (reviewerSubmission) {
      const stats = implementationStatsMap.get(reviewerSubmission.id);
      if (stats) {
        implStats = stats;

        let baseScore = 0;
        if (stats.totalTeacher > 0) {
          baseScore = (stats.passedTeacher / stats.totalTeacher) * 50;
        }

        let penalty = 0;
        if (stats.totalPeer > 0) {
          const rawPenalty = (stats.failedPeer / stats.totalPeer) * 50;
          const maxPenalty = 50 / 3;
          penalty = Math.min(maxPenalty, rawPenalty);
        }

        implementationScore = baseScore - penalty;
        implementationScore = parseFloat(
          Math.max(0, implementationScore).toFixed(2)
        );
      }
    } else {
      implementationScore = 0;
    }

    const totalScore = parseFloat(
      (finalReviewScore + implementationScore).toFixed(2)
    );

    const statsJSON = {
      codeReview: {
        E,
        C,
        W,
        I_total,
        C_total,
        totalReviewed: revAssignments.length,
      },
      implementation: {
        teacherPassed: implStats.passedTeacher,
        teacherTotal: implStats.totalTeacher,
        peerPenalties: implStats.failedPeer,
        peerTotal: implStats.totalPeer,
      },
    };

    try {
      const [breakdown, created] = await SubmissionScoreBreakdown.findOrCreate({
        where: { challengeParticipantId: reviewerId },
        defaults: {
          submissionId: reviewerSubmission ? reviewerSubmission.id : null,
          codeReviewScore: finalReviewScore,
          implementationScore: implementationScore,
          totalScore: totalScore,
          stats: statsJSON,
        },
      });

      if (!created) {
        await breakdown.update({
          submissionId: reviewerSubmission
            ? reviewerSubmission.id
            : breakdown.submissionId,
          codeReviewScore: finalReviewScore,
          implementationScore: implementationScore,
          totalScore: totalScore,
          stats: statsJSON,
        });
      }
    } catch (error) {
      logger.error(
        `Failed to save breakdown for participant ${reviewerId}: ${error.message}`
      );
    }

    results.push({
      challengeParticipantId: reviewerId,
      submissionId: reviewerSubmission ? reviewerSubmission.id : null,
      codeReviewScore: finalReviewScore,
      implementationScore: implementationScore,
      totalScore: totalScore,
      stats: statsJSON,
    });
  }

  logger.info(
    `Calculated and saved scores for ${results.length} participants.`
  );
  return results;
}
