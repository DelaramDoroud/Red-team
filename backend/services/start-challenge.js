import Challenge from '#root/models/challenge.js';
import Match from '#root/models/match.js';
import ChallengeMatchSetting from '#root/models/challenge-match-setting.js';
import { getChallengeParticipants } from '#root/services/challenge-participant.js';
import { ChallengeStatus } from '#root/models/enum/enums.js';

export default async function startChallenge({ challengeId }) {
  // 1) Verify challenge exists(same as assign)
  const challenge = await Challenge.findByPk(challengeId);
  if (!challenge) {
    return { status: 'challenge_not_found' };
  }

  // 2) We only allow starting when challenge status is assigned
  if (
    challenge.status !== ChallengeStatus.ASSIGNED &&
    challenge.status !== ChallengeStatus.STARTED_PHASE_ONE
  ) {
    return {
      status: 'invalid_status',
      challengeStatus: challenge.status,
    };
  }

  // 3) startDatetime must be <= now(same as assign)
  const now = new Date();
  if (challenge.startDatetime && now < new Date(challenge.startDatetime)) {
    return { status: 'too_early' };
  }

  // 4) Verify there is at least one participant(same as assign)
  const participantsResult = await getChallengeParticipants({ challengeId });

  if (participantsResult.status !== 'ok') {
    return { status: 'participants_error' };
  }

  const participants = participantsResult.participants || [];
  if (participants.length === 0) {
    return { status: 'no_participants' };
  }

  // 5) Verify if there are matches assigned for this challenge
  const matchesCount = await Match.count({
    include: [
      {
        model: ChallengeMatchSetting,
        as: 'challengeMatchSetting',
        where: { challengeId },
      },
    ],
  });

  if (matchesCount === 0) {
    return { status: 'no_matches' };
  }

  // 6) Already started?
  if (challenge.status === ChallengeStatus.STARTED_PHASE_ONE) {
    return { status: 'already_started' };
  }

  // 7) Update status to "started"
  challenge.status = ChallengeStatus.STARTED_PHASE_ONE;
  challenge.startPhaseOneDateTime = new Date();
  await challenge.save();

  return {
    status: 'ok',
    challenge,
  };
}
