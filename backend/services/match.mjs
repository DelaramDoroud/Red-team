import Match from '#root/models/match.mjs';
import Challenge from '#root/models/challenge.mjs';
import User from '#root/models/user.mjs';

export async function joinChallenge({ studentId, challengeId }) {
  const challenge = await Challenge.findByPk(challengeId);
  if (!challenge) {
    return { status: 'challenge_not_found' };
  }

  const student = await User.findByPk(studentId);
  if (!student) {
    return { status: 'student_not_found' };
  }

  const existing = await Match.findOne({
    where: { studentId, challengeId },
  });

  if (existing) {
    return { status: 'already_joined' };
  }

  const participation = await Match.create({
    studentId,
    challengeId,
  });

  return { status: 'ok', participation };
}
