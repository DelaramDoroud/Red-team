import Challenge from '#root/models/challenge.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';
import { broadcastEvent } from '#root/services/event-stream.js';
import finalizePeerReviewChallenge from '#root/services/finalize-peer-review.js';
import { calculateChallengeScores } from '#root/services/scoring-service.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import logger from '#root/services/logger.js';

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
  logger.info(`[Scheduler] TRIGGER: Phase 1 END for challenge ${challengeId}`);
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
        `[Scheduler] Phase 1 ended successfully for ${challengeId}. Broadcasting update.`
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
        `[Scheduler] Failed to mark Phase 1 ended for ${challengeId}. Wrong status or not found?`
      );
    }
  } catch (err) {
    logger.error(
      `[Scheduler] Error ending Phase 1 for ${challengeId}: ${err.message}`
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
  logger.info(`[Scheduler] TRIGGER: Phase 2 END for challenge ${challengeId}`);
  clearPhaseTwoTimer(challengeId);

  const challenge = await Challenge.findByPk(challengeId);

  if (!challenge) {
    logger.error(
      `[Scheduler] Challenge ${challengeId} not found during Phase 2 end.`
    );
    return;
  }

  logger.info(
    `[Scheduler] Current status for ${challengeId} is: ${challenge.status}`
  );

  if (challenge.status !== ChallengeStatus.STARTED_PHASE_TWO) {
    logger.warn(
      `[Scheduler] Challenge ${challengeId} is not in STARTED_PHASE_TWO. Skipping logic.`
    );
    return;
  }

  // 1. Finalize Peer Review
  logger.info(`[Scheduler] Finalizing Peer Review for ${challengeId}...`);
  const result = await finalizePeerReviewChallenge({
    challengeId,
    allowEarly: true,
  });

  if (result.status === 'ok' && result.challenge) {
    logger.info(
      `[Scheduler] Peer Review Finalized. Transitioning to COMPUTING...`
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

      // 3. CALCULATION AND SAVING
      logger.info(
        `[Scheduler] Starting SCORE CALCULATION for ${challengeId}...`
      );
      const scores = await calculateChallengeScores(challengeId);
      logger.info(
        `[Scheduler] Calculation done. Found scores for ${scores ? scores.length : 0} participants.`
      );

      if (scores && scores.length > 0) {
        await Promise.all(
          scores.map(async (scoreItem) => {
            if (scoreItem.challengeParticipantId) {
              logger.info(
                `[Scheduler] Saving score for participant ${scoreItem.challengeParticipantId}: Total=${scoreItem.totalScore}`
              );

              const [breakdown, created] =
                await SubmissionScoreBreakdown.findOrCreate({
                  where: {
                    challengeParticipantId: scoreItem.challengeParticipantId,
                  },
                  defaults: {
                    submissionId: scoreItem.submissionId || null,
                    codeReviewScore: scoreItem.codeReviewScore,
                    implementationScore: scoreItem.implementationScore || 0,
                    totalScore: scoreItem.totalScore || 0,
                  },
                });

              if (!created) {
                logger.info(
                  `[Scheduler] Updating existing breakdown for participant ${scoreItem.challengeParticipantId}`
                );
                await breakdown.update({
                  submissionId:
                    scoreItem.submissionId || breakdown.submissionId,
                  codeReviewScore: scoreItem.codeReviewScore,
                  implementationScore: scoreItem.implementationScore || 0,
                  totalScore: scoreItem.totalScore || 0,
                });
              }
            } else {
              logger.warn(
                `[Scheduler] Score item missing challengeParticipantId: ${JSON.stringify(scoreItem)}`
              );
            }
          })
        );
      } else {
        logger.warn(
          `[Scheduler] No scores returned from calculateChallengeScores.`
        );
      }

      // 4. COMPLETED
      logger.info(
        `[Scheduler] Marking Scoring as COMPLETED for ${challengeId}`
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
        `[Scheduler] SUCCESS: Challenge ${challengeId} Phase 2 & Scoring fully completed.`
      );
    } catch (error) {
      logger.error(
        `[Scheduler] CRITICAL ERROR during scoring for ${challengeId}: ${error.message}`
      );
      console.error(error);
    }
  } else {
    logger.error(
      `[Scheduler] finalizePeerReviewChallenge failed: ${JSON.stringify(result)}`
    );
  }
};

export const schedulePhaseOneEndForChallenge = async (challenge) => {
  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PHASE_ONE)
    return;

  const endMs = computePhaseOneEndMs(challenge);
  if (!endMs) {
    logger.warn(
      `[Scheduler] Could not compute Phase 1 end time for ${challenge.id}`
    );
    return;
  }

  const delay = Math.max(0, endMs - Date.now());
  logger.info(
    `[Scheduler] Scheduled Phase 1 END for ${challenge.id} in ${delay}ms`
  );

  clearPhaseOneTimer(challenge.id);

  if (delay === 0) {
    logger.info(
      `[Scheduler] Phase 1 end time passed. Executing immediately for ${challenge.id}`
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
  if (!endMs) {
    logger.warn(
      `[Scheduler] Could not compute Phase 2 end time for ${challenge.id}`
    );
    return;
  }

  const delay = Math.max(0, endMs - Date.now());
  logger.info(
    `[Scheduler] Scheduled Phase 2 END for ${challenge.id} in ${delay}ms`
  );

  clearPhaseTwoTimer(challenge.id);

  if (delay === 0) {
    logger.info(
      `[Scheduler] Phase 2 end time passed. Executing immediately for ${challenge.id}`
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
  logger.info(`[Scheduler] Init: Checking active Phase 1 challenges...`);
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_PHASE_ONE },
  });
  logger.info(
    `[Scheduler] Found ${activeChallenges.length} Phase 1 challenges.`
  );

  await Promise.all(
    activeChallenges.map((challenge) =>
      schedulePhaseOneEndForChallenge(challenge)
    )
  );
};

export const scheduleActivePhaseTwoChallenges = async () => {
  logger.info(`[Scheduler] Init: Checking active Phase 2 challenges...`);
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_PHASE_TWO },
  });
  logger.info(
    `[Scheduler] Found ${activeChallenges.length} Phase 2 challenges.`
  );

  await Promise.all(
    activeChallenges.map((challenge) =>
      schedulePhaseTwoEndForChallenge(challenge)
    )
  );
};
