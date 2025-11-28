import ChallengeParticipant from '#root/models/challenge-participant.js';
import Challenge from '#root/models/challenge.js';
import User from '#root/models/user.js';

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
