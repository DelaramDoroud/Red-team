import Challenge from '#root/models/challenge.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';
import { broadcastEvent } from '#root/services/event-stream.js';
import finalizePeerReviewChallenge from '#root/services/finalize-peer-review.js';
import { calculateChallengeScores } from '#root/services/scoring-service.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import logger from '#root/services/logger.js'; // <--- ASSICURATI CHE IL PATH SIA GIUSTO

const phaseOneTimers = new Map();
const phaseTwoTimers = new Map();

const clearPhaseOneTimer = (challengeId) => {
  const timer = phaseOneTimers.get(challengeId);
  if (timer) {
    logger.info(
      `[Scheduler] Clearing Phase 1 timer for challenge ${challengeId}`
    );
    clearTimeout(timer);
  }
  phaseOneTimers.delete(challengeId);
};

const computePhaseOneEndMs = (challenge) => {
  if (challenge.endPhaseOneDateTime) {
    const explicit = new Date(challenge.endPhaseOneDateTime).getTime();
    return Number.isNaN(explicit) ? null : explicit;
  }
  const startMs = new Date(challenge.startPhaseOneDateTime).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + Number(challenge.duration || 0) * 60 * 1000 + 5000;
};

const computePhaseTwoEndMs = (challenge) => {
  if (challenge.endPhaseTwoDateTime) {
    const explicit = new Date(challenge.endPhaseTwoDateTime).getTime();
    return Number.isNaN(explicit) ? null : explicit;
  }
  const startMs = new Date(challenge.startPhaseTwoDateTime).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + Number(challenge.durationPeerReview || 0) * 60 * 1000 + 5000;
};

const markPhaseOneEnded = async (challengeId) => {
  logger.info(
    `[Scheduler] Marking Phase 1 ended for challenge ${challengeId}...`
  );
  clearPhaseOneTimer(challengeId);

  try {
    const [updatedCount, updatedRows] = await Challenge.update(
      {
        status: ChallengeStatus.ENDED_PHASE_ONE,
        endPhaseOneDateTime: new Date(),
      },
      {
        where: {
          id: challengeId,
          status: ChallengeStatus.STARTED_PHASE_ONE,
        },
        returning: true,
      }
    );

    if (updatedCount > 0) {
      const updatedChallenge = updatedRows?.[0];
      logger.info(
        `[Scheduler] Phase 1 ended successfully for challenge ${challengeId}. Broadcasting event.`
      );
      broadcastEvent({
        event: 'challenge-updated',
        data: {
          challengeId: updatedChallenge.id,
          status: updatedChallenge.status,
        },
      });
    } else {
      logger.warn(
        `[Scheduler] Phase 1 end attempted for challenge ${challengeId}, but no rows updated (wrong status?).`
      );
    }
  } catch (err) {
    logger.error(
      `[Scheduler] Error ending Phase 1 for challenge ${challengeId}:`,
      err
    );
  }
};

const clearPhaseTwoTimer = (challengeId) => {
  const timer = phaseTwoTimers.get(challengeId);
  if (timer) {
    logger.info(
      `[Scheduler] Clearing Phase 2 timer for challenge ${challengeId}`
    );
    clearTimeout(timer);
  }
  phaseTwoTimers.delete(challengeId);
};

const markPhaseTwoEnded = async (challengeId) => {
  logger.info(
    `[Scheduler] Marking Phase 2 ended for challenge ${challengeId}...`
  );
  clearPhaseTwoTimer(challengeId);

  const challenge = await Challenge.findByPk(challengeId);

  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PHASE_TWO) {
    logger.info(
      `[Scheduler] Challenge ${challengeId} not in STARTED_PHASE_TWO. Skipping end procedure.`
    );
    return;
  }

  // 1. Finalize Peer Review
  logger.info(
    `[Scheduler] Finalizing Peer Review logic for challenge ${challengeId}...`
  );
  const result = await finalizePeerReviewChallenge({ challengeId });

  if (result.status === 'ok' && result.challenge) {
    logger.info(
      `[Scheduler] Peer Review finalized. Transitioning to Scoring...`
    );

    // Notify "Pending"
    broadcastEvent({
      event: 'challenge-updated',
      data: {
        challengeId: result.challenge.id,
        status: result.challenge.status,
        scoringStatus: 'pending',
      },
    });

    try {
      // 2. Set COMPUTING status
      logger.info(
        `[Scheduler] Setting scoringStatus to 'computing' for challenge ${challengeId}`
      );
      await Challenge.update(
        { scoringStatus: 'computing' },
        { where: { id: challengeId } }
      );

      broadcastEvent({
        event: 'challenge-updated',
        data: {
          challengeId: result.challenge.id,
          status: result.challenge.status,
          scoringStatus: 'computing',
        },
      });

      // ----------------------------------------------------------------
      // 3. CALCULATION AND SAVING (RT-215 / RT-216)
      // ----------------------------------------------------------------

      logger.info(`[Scheduler] calculating challenge scores...`);

      // Calculate scores in memory
      const scores = await calculateChallengeScores(challengeId);

      logger.info(
        `[Scheduler] Scores calculated. Entries to save: ${scores ? scores.length : 0}`
      );

      // Save results to the submission_score_breakdown table
      if (scores && scores.length > 0) {
        await Promise.all(
          scores.map(async (scoreItem) => {
            // Save the score ONLY if the user has a submission (schema requires submission_id)
            if (scoreItem.submissionId) {
              logger.info(
                `[Scheduler] Saving score breakdown for submission ${scoreItem.submissionId}`
              );

              // Check if a record already exists (e.g., previous partial calculations) or create it
              const [breakdown, created] =
                await SubmissionScoreBreakdown.findOrCreate({
                  where: { submissionId: scoreItem.submissionId },
                  defaults: {
                    codeReviewScore: scoreItem.codeReviewScore,
                    implementationScore: 0, // calculated in RT-216
                    totalScore: 0,
                  },
                });

              // If it already existed, update only the Code Review part
              if (!created) {
                logger.info(
                  `[Scheduler] Updating existing score breakdown for submission ${scoreItem.submissionId}`
                );
                await breakdown.update({
                  codeReviewScore: scoreItem.codeReviewScore,
                });
              }
            } else {
              logger.warn(
                `[Scheduler] Score item missing submissionId, skipping save. Item: ${JSON.stringify(scoreItem)}`
              );
            }
          })
        );
      }
      // ----------------------------------------------------------------

      // 4. COMPLETED
      logger.info(
        `[Scheduler] Scoring finished. Setting status to 'completed' for challenge ${challengeId}`
      );
      await Challenge.update(
        { scoringStatus: 'completed' },
        { where: { id: challengeId } }
      );

      broadcastEvent({
        event: 'challenge-updated',
        data: {
          challengeId: result.challenge.id,
          status: result.challenge.status,
          scoringStatus: 'completed',
        },
      });
      logger.info(
        `[Scheduler] Phase 2 End & Scoring procedure COMPLETED for challenge ${challengeId}`
      );
    } catch (error) {
      logger.error(
        `[Scheduler] Error computing scores for challenge ${challengeId}:`,
        error
      );
    }
  } else {
    logger.error(
      `[Scheduler] Failed to finalize peer review for challenge ${challengeId}. Result: ${JSON.stringify(result)}`
    );
  }
};

export const schedulePhaseOneEndForChallenge = async (challenge) => {
  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PHASE_ONE)
    return;

  const endMs = computePhaseOneEndMs(challenge);
  if (!endMs) return;

  const delay = Math.max(0, endMs - Date.now());
  logger.info(
    `[Scheduler] Scheduling Phase 1 END for challenge ${challenge.id} in ${delay}ms`
  );

  clearPhaseOneTimer(challenge.id);

  if (delay === 0) {
    logger.info(
      `[Scheduler] Phase 1 ended immediately (delay 0) for challenge ${challenge.id}`
    );
    await markPhaseOneEnded(challenge.id);
    return;
  }

  const timer = setTimeout(() => {
    markPhaseOneEnded(challenge.id);
  }, delay);
  phaseOneTimers.set(challenge.id, timer);
};

export const schedulePhaseTwoEndForChallenge = async (challenge) => {
  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PHASE_TWO) {
    return;
  }

  const endMs = computePhaseTwoEndMs(challenge);
  if (!endMs) return;

  const delay = Math.max(0, endMs - Date.now());
  logger.info(
    `[Scheduler] Scheduling Phase 2 END for challenge ${challenge.id} in ${delay}ms`
  );

  clearPhaseTwoTimer(challenge.id);

  if (delay === 0) {
    logger.info(
      `[Scheduler] Phase 2 ended immediately (delay 0) for challenge ${challenge.id}`
    );
    await markPhaseTwoEnded(challenge.id);
    return;
  }

  const timer = setTimeout(() => {
    markPhaseTwoEnded(challenge.id);
  }, delay);
  phaseTwoTimers.set(challenge.id, timer);
};

export const scheduleActivePhaseOneChallenges = async () => {
  logger.info(`[Scheduler] Checking for active Phase 1 challenges...`);
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_PHASE_ONE },
  });
  logger.info(
    `[Scheduler] Found ${activeChallenges.length} active Phase 1 challenges.`
  );

  await Promise.all(
    activeChallenges.map((challenge) =>
      schedulePhaseOneEndForChallenge(challenge)
    )
  );
};

export const scheduleActivePhaseTwoChallenges = async () => {
  logger.info(`[Scheduler] Checking for active Phase 2 challenges...`);
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_PHASE_TWO },
  });
  logger.info(
    `[Scheduler] Found ${activeChallenges.length} active Phase 2 challenges.`
  );

  await Promise.all(
    activeChallenges.map((challenge) =>
      schedulePhaseTwoEndForChallenge(challenge)
    )
  );
};
