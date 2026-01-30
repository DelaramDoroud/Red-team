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
 * RT-215: Calcola il Code Review Score per tutti i partecipanti di una challenge.
 *
 * Fasi del processo:
 * 1. Reference Check: Valida i test case forniti nei voti "INCORRECT" contro la soluzione del docente.
 * 2. Truth Inference: Determina se ogni sottomissione è corretta o bacata (Teacher Tests + Valid Peer Tests).
 * 3. Reviewer Grading: Calcola il punteggio (0-50) per ogni revisore basandosi sulla formula RT-9.
 */
export async function calculateChallengeScores(challengeId) {
  logger.info(`Starting score calculation for Challenge ${challengeId}`);

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

  // Mappa MatchSettingID -> Oggetto MatchSetting (per accedere a reference_solution)
  const matchSettingsMap = new Map();
  challenge.challengeMatchSettings.forEach((cms) => {
    if (cms.matchSetting) {
      matchSettingsMap.set(cms.id, cms.matchSetting);
    }
  });

  // Recupera tutte le Submission FINALI della challenge
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
      {
        model: PeerReviewVote,
        as: 'vote',
        required: false, // Includi anche se non c'è ancora il voto (caso limite)
      },
      {
        model: Submission,
        as: 'submission',
      },
    ],
  });

  // ---------------------------------------------------------
  // FASE A: VALIDAZIONE TEST CASE (Reference Check)
  // I test case nei voti "INCORRECT" sono validi? (producono l'output atteso sulla soluzione docente?)
  // ---------------------------------------------------------

  const incorrectVotesWithTests = assignments
    .map((a) => a.vote)
    .filter(
      (vote) => vote && vote.vote === VoteType.INCORRECT && vote.testCaseInput
    );

  // Raggruppa per MatchSetting per ottimizzare le compilazioni (batch execution)
  const votesByMatchSetting = new Map();

  for (const vote of incorrectVotesWithTests) {
    const assignment = assignments.find(
      (a) => a.id === vote.peerReviewAssignmentId
    );
    if (!assignment) continue;

    const cmsId = assignment.submission?.match?.challengeMatchSettingId;
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
    // [RT-215] Usa referenceSolution dallo schema DB
    const referenceCode = setting.referenceSolution;

    if (!referenceCode) {
      logger.warn(
        `No reference solution for MatchSetting ${setting.id}. Skipping validation.`
      );
      continue;
    }

    // Prepara i test case. Nota: passiamo input e ci aspettiamo output nullo per catturare quello reale.
    const testCases = votes.map((v) => ({
      input: v.testCaseInput,
      expectedOutput: v.expectedOutput, // Passiamo l'expected per info, ma executeCodeTests ricalcola
    }));

    // Esegui contro la soluzione del docente
    const execResult = await executeCodeTests({
      code: referenceCode,
      language: 'cpp', // Assunto default, o prendere da setting.language
      testCases: testCases,
      userId: null, // System execution
    });

    if (execResult.isCompiled) {
      await Promise.all(
        votes.map(async (vote, index) => {
          const result = execResult.testResults[index];
          const producedOutput = (result.actualOutput || '').trim();
          const expectedOutput = (vote.expectedOutput || '').trim();

          const isOutputCorrect = producedOutput === expectedOutput;

          // [RT-215] Persistenza risultati intermedi su PeerReviewVote
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
  // Una submission è corretta sse passa i Teacher Tests E nessun Valid Peer Test la rompe.
  // ---------------------------------------------------------

  const submissionTruthMap = new Map(); // submissionId -> boolean (isUltimatelyCorrect)

  for (const submission of submissions) {
    // 1. Check Teacher Tests (da privateTestResults)
    let passedTeacherTests = false;
    try {
      const results =
        typeof submission.privateTestResults === 'string'
          ? JSON.parse(submission.privateTestResults)
          : submission.privateTestResults;

      // Logica: se esiste l'array e tutti i test sono passati
      if (Array.isArray(results) && results.length > 0) {
        passedTeacherTests = results.every((r) => r.passed);
      }
    } catch (e) {
      passedTeacherTests = false;
    }

    // 2. Check Valid Peer Tests (Killer Tests)
    const relevantAssignments = assignments.filter(
      (a) => a.submissionId === submission.id
    );

    // Prendiamo solo i voti INCORRECT che hanno superato la FASE A (test case valido)
    const killerVotes = relevantAssignments
      .map((a) => a.vote)
      .filter(
        (v) => v && v.vote === VoteType.INCORRECT && v.isExpectedOutputCorrect
      );

    let failedPeerTest = false;

    if (killerVotes.length > 0) {
      // Eseguiamo il codice dello studente contro questi test "killer"
      const testCases = killerVotes.map((v) => ({
        input: v.testCaseInput,
        expectedOutput: v.expectedOutput, // Questo è l'output "giusto" validato dal docente
      }));

      const execResult = await executeCodeTests({
        code: submission.code,
        language: 'cpp',
        testCases: testCases,
        userId: null,
      });

      if (execResult.isCompiled) {
        await Promise.all(
          killerVotes.map(async (vote, index) => {
            const result = execResult.testResults[index];
            const passed = result.passed; // true se output studente == expectedOutput

            // Se passed == false, lo studente ha fallito un test valido -> BUG PROVATO
            const bugProven = !passed;
            if (bugProven) failedPeerTest = true;

            await vote.update({
              actualOutput: result.actualOutput,
              isBugProven: bugProven,
              isVoteCorrect: bugProven, // Il voto "Incorrect" è giusto solo se il bug è reale
            });
          })
        );
      }
    }

    // Definizione finale di correttezza
    const isUltimatelyCorrect = passedTeacherTests && !failedPeerTest;
    submissionTruthMap.set(submission.id, isUltimatelyCorrect);
  }

  // ---------------------------------------------------------
  // FASE B-2: Aggiorna isVoteCorrect per gli ENDORSEMENT
  // Se ho votato CORRECT, ho ragione solo se la submission è davvero corretta.
  // ---------------------------------------------------------
  const endorsementVotes = assignments
    .map((a) => a.vote)
    .filter((v) => v && v.vote === VoteType.CORRECT);

  await Promise.all(
    endorsementVotes.map(async (vote) => {
      // Trova l'assignment padre per risalire alla submission
      const assignment = assignments.find(
        (a) => a.id === vote.peerReviewAssignmentId
      );
      if (assignment) {
        const isSubmissionCorrect = submissionTruthMap.get(
          assignment.submissionId
        );
        await vote.update({
          isVoteCorrect: isSubmissionCorrect, // True se ho detto "Giusto" ed era giusto
        });
      }
    })
  );

  // ---------------------------------------------------------
  // FASE C: CALCOLO PUNTEGGI (Formula RT-9)
  // Score = 50 * ((2E + 1C - 0.5W) / (2Itotal + 1Ctotal))
  // ---------------------------------------------------------

  const results = [];

  // Raggruppa per Reviewer
  const reviewerAssignmentsMap = new Map();
  assignments.forEach((a) => {
    if (!reviewerAssignmentsMap.has(a.reviewerId)) {
      reviewerAssignmentsMap.set(a.reviewerId, []);
    }
    reviewerAssignmentsMap.get(a.reviewerId).push(a);
  });

  for (const [reviewerId, revAssignments] of reviewerAssignmentsMap) {
    let E = 0; // Correct Error Spotting (Weight 2)
    let C = 0; // Correct Endorsement (Weight 1)
    let W = 0; // Incorrect Vote (Weight -0.5)
    let I_total = 0; // Totale submissioni scorrette nel set assegnato
    let C_total = 0; // Totale submissioni corrette nel set assegnato

    // Recuperiamo il submissionId del revisore stesso per popolare submission_score_breakdown dopo
    // (Assumiamo che il revisore sia anche uno studente che ha sottomesso)
    const reviewerSubmission = submissions.find(
      (s) => s.challengeParticipantId === reviewerId
    );

    for (const assignment of revAssignments) {
      const isSubmissionCorrect = submissionTruthMap.get(
        assignment.submissionId
      );

      // Calcolo denominatori (Il "potenziale" del set assegnato)
      if (isSubmissionCorrect) C_total++;
      else I_total++;

      const vote = assignment.vote;

      // Astensioni: contano nei totali (I_total/C_total) ma non danno punti (W=0)
      if (!vote || vote.vote === VoteType.ABSTAIN) continue;

      if (vote.vote === VoteType.CORRECT) {
        if (vote.isVoteCorrect) {
          // Già calcolato in Fase B-2 (isSubmissionCorrect === true)
          C++;
        } else {
          W++;
        }
      } else if (vote.vote === VoteType.INCORRECT) {
        // E (Error Spotting) richiede:
        // 1. Test case valido (isExpectedOutputCorrect)
        // 2. Bug dimostrato (isVoteCorrect/isBugProven)
        if (vote.isExpectedOutputCorrect && vote.isVoteCorrect) {
          E++;
        } else {
          W++;
        }
      }
    }

    // Calcolo finale formula
    const numerator = 2 * E + 1 * C - 0.5 * W;
    const denominator = 2 * I_total + 1 * C_total;

    let rawScore = 0;
    if (denominator > 0) {
      rawScore = 50 * (numerator / denominator);
    }

    // Clamp tra 0 e 50
    const finalScore = Math.max(0, Math.min(50, rawScore));

    results.push({
      participantId: reviewerId,
      submissionId: reviewerSubmission ? reviewerSubmission.id : null, // Utile per il salvataggio
      codeReviewScore: parseFloat(finalScore.toFixed(2)), // Arrotondamento a 2 decimali
      stats: { E, C, W, I_total, C_total }, // Utile per debug o UI
    });
  }

  logger.info(
    `Calculated scores for ${results.length} reviewers in Challenge ${challengeId}`
  );
  return results;
}
