import Challenge from '#root/models/challenge.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';
import SubmissionScoreBreakdown from '#root/models/submission-score-breakdown.js';
import { maybeCompleteCodingPhaseFinalization } from '#root/services/coding-phase-finalization.js';
import { broadcastEvent } from '#root/services/event-stream.js';
import finalizePeerReviewChallenge from '#root/services/finalize-peer-review.js';
import { calculateChallengeScores } from '#root/services/scoring-service.js';
import { finalizeMissingSubmissionsForChallenge } from '#root/services/submission-finalization.js';

const codingPhaseTimers = new Map();
const peerReviewTimers = new Map();

const clearCodingPhaseTimer = (challengeId) => {
  const timer = codingPhaseTimers.get(challengeId);
  if (timer) clearTimeout(timer);
  codingPhaseTimers.delete(challengeId);
};

const computeCodingPhaseEndMs = (challenge) => {
  if (challenge.endCodingPhaseDateTime) {
    const explicit = new Date(challenge.endCodingPhaseDateTime).getTime();
    return Number.isNaN(explicit) ? null : explicit;
  }
  const startMs = new Date(challenge.startCodingPhaseDateTime).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + Number(challenge.duration || 0) * 60 * 1000 + 5000;
};

const computePeerReviewEndMs = (challenge) => {
  if (challenge.endPeerReviewDateTime) {
    const explicit = new Date(challenge.endPeerReviewDateTime).getTime();
    return Number.isNaN(explicit) ? null : explicit;
  }
  const startMs = new Date(challenge.startPeerReviewDateTime).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + Number(challenge.durationPeerReview || 0) * 60 * 1000 + 5000;
};

const markCodingPhaseEnded = async (challengeId) => {
  clearCodingPhaseTimer(challengeId);
  const [updatedCount, updatedRows] = await Challenge.update(
    {
      status: ChallengeStatus.ENDED_CODING_PHASE,
      endCodingPhaseDateTime: new Date(),
      codingPhaseFinalizationCompletedAt: null,
    },
    {
      where: {
        id: challengeId,
        status: ChallengeStatus.STARTED_CODING_PHASE,
      },
      returning: true,
    }
  );

  if (updatedCount > 0) {
    const updatedChallenge = updatedRows?.[0];
    try {
      const finalizedMatches = await finalizeMissingSubmissionsForChallenge({
        challengeId: updatedChallenge.id,
      });
      finalizedMatches.forEach((finalized) => {
        broadcastEvent({
          event: 'finalization-updated',
          data: {
            challengeId: updatedChallenge.id,
            matchId: finalized.matchId,
          },
        });
      });
    } catch (error) {
      console.error(
        `Error finalizing submissions for challenge ${updatedChallenge.id}:`,
        error
      );
    }
    broadcastEvent({
      event: 'challenge-updated',
      data: {
        challengeId: updatedChallenge.id,
        status: updatedChallenge.status,
      },
    });

    try {
      await maybeCompleteCodingPhaseFinalization({
        challengeId: updatedChallenge.id,
      });
    } catch (error) {
      console.error(
        `Error completing coding phase finalization for challenge ${updatedChallenge.id}:`,
        error
      );
    }
  }
};

const clearPeerReviewTimer = (challengeId) => {
  const timer = peerReviewTimers.get(challengeId);
  if (timer) clearTimeout(timer);
  peerReviewTimers.delete(challengeId);
};

const markPeerReviewEnded = async (challengeId) => {
  clearPeerReviewTimer(challengeId);
  const challenge = await Challenge.findByPk(challengeId);

  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PEER_REVIEW) {
    return;
  }

  // 1. Finalize Peer Review
  const result = await finalizePeerReviewChallenge({ challengeId });

  if (result.status === 'ok' && result.challenge) {
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

      // ----------------------------------------------------------------
      // 3. CALCULATION AND SAVING (RT-215)
      // ----------------------------------------------------------------

      // Calculate scores in memory
      const scores = await calculateChallengeScores(challengeId);

      if (scores && scores.length > 0) {
        await Promise.all(
          scores.map(async (scoreItem) => {
            if (scoreItem.challengeParticipantId) {
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
                await breakdown.update({
                  submissionId:
                    scoreItem.submissionId || breakdown.submissionId,
                  codeReviewScore: scoreItem.codeReviewScore,
                  implementationScore: scoreItem.implementationScore || 0,
                  totalScore: scoreItem.totalScore || 0,
                });
              }
            }
          })
        );
      }
      // ----------------------------------------------------------------

      // 4. COMPLETED
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
    } catch (error) {
      console.error(
        `Error computing scores for challenge ${challengeId}:`,
        error
      );
    }
  }
};

export const scheduleCodingPhaseEndForChallenge = async (challenge) => {
  if (!challenge || challenge.status !== ChallengeStatus.STARTED_CODING_PHASE)
    return;

  const endMs = computeCodingPhaseEndMs(challenge);
  if (!endMs) return;

  const delay = Math.max(0, endMs - Date.now());
  clearCodingPhaseTimer(challenge.id);

  if (delay === 0) {
    await markCodingPhaseEnded(challenge.id);
    return;
  }

  const timer = setTimeout(() => {
    markCodingPhaseEnded(challenge.id);
  }, delay);
  codingPhaseTimers.set(challenge.id, timer);
};

export const schedulePeerReviewEndForChallenge = async (challenge) => {
  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PEER_REVIEW) {
    return;
  }

  const endMs = computePeerReviewEndMs(challenge);
  if (!endMs) return;

  const delay = Math.max(0, endMs - Date.now());
  clearPeerReviewTimer(challenge.id);

  if (delay === 0) {
    await markPeerReviewEnded(challenge.id);
    return;
  }

  const timer = setTimeout(() => {
    markPeerReviewEnded(challenge.id);
  }, delay);
  peerReviewTimers.set(challenge.id, timer);
};

export const scheduleActiveCodingPhaseChallenges = async () => {
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_CODING_PHASE },
  });
  await Promise.all(
    activeChallenges.map((challenge) =>
      scheduleCodingPhaseEndForChallenge(challenge)
    )
  );
};

export const scheduleActivePeerReviewChallenges = async () => {
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_PEER_REVIEW },
  });
  await Promise.all(
    activeChallenges.map((challenge) =>
      schedulePeerReviewEndForChallenge(challenge)
    )
  );
};
