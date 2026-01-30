import { Op } from 'sequelize';
import Challenge from '#root/models/challenge.js';
import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import Submission from '#root/models/submission.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import { executeCodeTests } from '#root/services/execute-code-tests.js';
import { VoteType } from '#root/models/enum/enums.js';
import logger from '#root/services/logger.js';

/**
 * CALCOLO COMPLETO (RT-215 + RT-216)
 * Calcola Code Review Score e Implementation Score per tutti i partecipanti.
 */
export async function calculateChallengeScores(challengeId) {
  logger.info(`Starting FULL score calculation for Challenge ${challengeId}`);

  // ---------------------------------------------------------
  // 1. DATA FETCHING
  // ---------------------------------------------------------
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

  // Mappa MatchSettingID -> Oggetto MatchSetting (per reference_solution)
  const matchSettingsMap = new Map();
  challenge.challengeMatchSettings.forEach((cms) => {
    if (cms.matchSetting) {
      matchSettingsMap.set(cms.id, cms.matchSetting);
    }
  });

  // Recupera tutte le Submission FINALI (include i dati del Match)
  const submissions = await Submission.findAll({
    where: { isFinal: true },
    include: [
      {
        model: Match,
        as: 'match',
        where: {
          challengeMatchSettingId: {
            [Op.in]: Array.from(matchSettingsMap.keys()),
          },
        },
      },
    ],
  });

  // Recupera Assegnazioni e Voti
  const assignments = await PeerReviewAssignment.findAll({
    where: {
      submissionId: { [Op.in]: submissions.map((s) => s.id) },
    },
    include: [
      { model: PeerReviewVote, as: 'vote', required: false },
      { model: Submission, as: 'submission' },
    ],
  });

  // ---------------------------------------------------------
  // FASE A: VALIDAZIONE TEST CASE (Reference Check)
  // ---------------------------------------------------------

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

    // FIX: Usiamo l'array 'submissions' scaricato all'inizio
    const fullSubmission = submissions.find(
      (s) => s.id === assignment.submissionId
    );

    if (!fullSubmission || !fullSubmission.match) {
      logger.warn(
        `Could not find submission or match info for assignment ${assignment.id}`
      );
      continue;
    }

    const cmsId = fullSubmission.match.challengeMatchSettingId;
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

  logger.info(
    `Votes to validate grouped by MatchSetting: ${votesByMatchSetting.size}`
  );

  // Eseguiamo i test contro la Reference Solution
  for (const { setting, votes } of votesByMatchSetting.values()) {
    const referenceCode = setting.referenceSolution;

    if (!referenceCode) {
      logger.warn(
        `No reference solution for MatchSetting ${setting.id}. Skipping validation.`
      );
      continue;
    }

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
      await Promise.all(
        votes.map(async (vote, index) => {
          const result = execResult.testResults[index];

          // --- FIX SICUREZZA TRIM ---
          let producedOutput = result.actualOutput;
          if (typeof producedOutput !== 'string') {
            producedOutput = JSON.stringify(producedOutput);
          }
          producedOutput = (producedOutput || '').trim();

          let expectedOutput = vote.expectedOutput;
          if (typeof expectedOutput !== 'string') {
            expectedOutput = JSON.stringify(expectedOutput);
          }
          expectedOutput = (expectedOutput || '').trim();
          // --------------------------

          const isOutputCorrect = producedOutput === expectedOutput;

          await vote.update({
            referenceOutput: producedOutput,
            isExpectedOutputCorrect: isOutputCorrect,
          });
        })
      );
    } else {
      logger.error(
        `Reference solution failed to compile for MatchSetting ${setting.id}`
      );
    }
  }

  // ---------------------------------------------------------
  // FASE B: DETERMINA LA VERITÀ (Ground Truth)
  // ---------------------------------------------------------
  const submissionTruthMap = new Map();
  const implementationStatsMap = new Map();

  for (const submission of submissions) {
    // --- 1. Teacher Tests ---
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

    // --- 2. Valid Peer Tests (Killer Tests) ---
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
        // FIX: Usare 'killerVotes', NON 'votes' (che non esiste qui)
        await Promise.all(
          killerVotes.map(async (vote, index) => {
            const result = execResult.testResults[index];
            const passed = result.passed; // true se output studente == expectedOutput

            // --- FIX SICUREZZA SALVATAGGIO ---
            let actualOutputToSave = result.actualOutput;
            if (typeof actualOutputToSave !== 'string') {
              actualOutputToSave = JSON.stringify(actualOutputToSave);
            }
            // ---------------------------------

            if (!passed) failedPeerTestCount++;

            await vote.update({
              actualOutput: actualOutputToSave,
              isBugProven: !passed,
              isVoteCorrect: !passed,
            });
          })
        );
      }
    }

    // Salva stats per RT-216
    implementationStatsMap.set(submission.id, {
      passedTeacher: passedTeacherTests,
      totalTeacher: totalTeacherTests,
      failedPeer: failedPeerTestCount,
      totalPeer: totalValidPeerTests,
    });

    const isUltimatelyCorrect = isTeacherPassed && failedPeerTestCount === 0;
    submissionTruthMap.set(submission.id, isUltimatelyCorrect);
  }

  // Aggiorna Endorsements (RT-215 Fase B-2)
  const endorsementVotes = assignments
    .map((a) => a.vote)
    .filter((v) => v && v.vote === VoteType.CORRECT);
  await Promise.all(
    endorsementVotes.map(async (vote) => {
      const assignment = assignments.find(
        (a) => a.id === vote.peerReviewAssignmentId
      );
      if (assignment) {
        const isSubmissionCorrect = submissionTruthMap.get(
          assignment.submissionId
        );
        await vote.update({ isVoteCorrect: isSubmissionCorrect });
      }
    })
  );

  // ---------------------------------------------------------
  // FASE C: CALCOLO SCORE
  // ---------------------------------------------------------
  const results = [];

  const reviewerAssignmentsMap = new Map();
  assignments.forEach((a) => {
    if (!reviewerAssignmentsMap.has(a.reviewerId)) {
      reviewerAssignmentsMap.set(a.reviewerId, []);
    }
    reviewerAssignmentsMap.get(a.reviewerId).push(a);
  });

  for (const [reviewerId, revAssignments] of reviewerAssignmentsMap) {
    let E = 0,
      C = 0,
      W = 0,
      I_total = 0,
      C_total = 0;

    const reviewerSubmission = submissions.find(
      (s) => s.challengeParticipantId === reviewerId
    );

    for (const assignment of revAssignments) {
      const isSubmissionCorrect = submissionTruthMap.get(
        assignment.submissionId
      );
      if (isSubmissionCorrect) C_total++;
      else I_total++;

      const vote = assignment.vote;
      if (!vote || vote.vote === VoteType.ABSTAIN) continue;

      if (vote.vote === VoteType.CORRECT) {
        vote.isVoteCorrect ? C++ : W++;
      } else if (vote.vote === VoteType.INCORRECT) {
        vote.isExpectedOutputCorrect && vote.isVoteCorrect ? E++ : W++;
      }
    }

    const numerator = 2 * E + 1 * C - 0.5 * W;
    const denominator = 2 * I_total + 1 * C_total;
    let rawReviewScore = denominator > 0 ? 50 * (numerator / denominator) : 0;
    const finalReviewScore = Math.max(0, Math.min(50, rawReviewScore));

    // CALCOLO IMPLEMENTATION SCORE (RT-216)
    let implementationScore = 0;

    if (reviewerSubmission) {
      const stats = implementationStatsMap.get(reviewerSubmission.id);
      if (stats) {
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
        implementationScore = Math.max(0, implementationScore);
      }
    }

    results.push({
      participantId: reviewerId,
      submissionId: reviewerSubmission ? reviewerSubmission.id : null,
      codeReviewScore: parseFloat(finalReviewScore.toFixed(2)),
      implementationScore: parseFloat(implementationScore.toFixed(2)),
      stats: { E, C, W, I_total, C_total },
    });
  }

  logger.info(
    `Calculated scores for ${results.length} participants in Challenge ${challengeId}`
  );
  return results;
}
