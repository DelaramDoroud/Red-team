import Challenge from '#root/models/challenge.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';
import { broadcastEvent } from '#root/services/event-stream.js';

const phaseOneTimers = new Map();

const clearPhaseOneTimer = (challengeId) => {
  const timer = phaseOneTimers.get(challengeId);
  if (timer) clearTimeout(timer);
  phaseOneTimers.delete(challengeId);
};

const computePhaseOneEndMs = (challenge) => {
  if (challenge.endPhaseOneDateTime) {
    const explicit = new Date(challenge.endPhaseOneDateTime).getTime();
    return Number.isNaN(explicit) ? null : explicit;
  }
  const startMs = new Date(challenge.startPhaseOneDateTime).getTime();
  if (Number.isNaN(startMs)) return null;
  return startMs + Number(challenge.duration || 0) * 60 * 1000 + 3000;
};

const markPhaseOneEnded = async (challengeId) => {
  clearPhaseOneTimer(challengeId);
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
    broadcastEvent({
      event: 'challenge-updated',
      data: {
        challengeId: updatedChallenge.id,
        status: updatedChallenge.status,
      },
    });
  }
};

export const schedulePhaseOneEndForChallenge = async (challenge) => {
  if (!challenge || challenge.status !== ChallengeStatus.STARTED_PHASE_ONE)
    return;

  const endMs = computePhaseOneEndMs(challenge);
  if (!endMs) return;

  const delay = Math.max(0, endMs - Date.now());
  clearPhaseOneTimer(challenge.id);

  if (delay === 0) {
    await markPhaseOneEnded(challenge.id);
    return;
  }

  const timer = setTimeout(() => {
    markPhaseOneEnded(challenge.id);
  }, delay);
  phaseOneTimers.set(challenge.id, timer);
};

export const scheduleActivePhaseOneChallenges = async () => {
  const activeChallenges = await Challenge.findAll({
    where: { status: ChallengeStatus.STARTED_PHASE_ONE },
  });
  await Promise.all(
    activeChallenges.map((challenge) =>
      schedulePhaseOneEndForChallenge(challenge)
    )
  );
};
