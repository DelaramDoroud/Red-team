import ChallengeParticipant from '#root/models/challenge-participant.mjs';
import Challenge from '#root/models/challenge.mjs';
import User from '#root/models/user.mjs';

export default async function joinChallenge({ studentId, challengeId }) {
  const challenge = await Challenge.findByPk(challengeId);
  if (!challenge) {
    return { status: 'challenge_not_found' };
  }

  const student = await User.findByPk(studentId);
  if (!student) {
    return { status: 'student_not_found' };
  }

  const existing = await ChallengeParticipant.findOne({
    where: { studentId, challengeId },
  });

  if (existing) {
    return { status: 'already_joined' };
  }

  try {
    const participation = await ChallengeParticipant.create({
      studentId,
      challengeId,
    });

    return { status: 'ok', participation };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return { status: 'already_joined' };
    }
    throw error;
  }
}
