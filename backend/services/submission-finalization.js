import Submission from '#root/models/submission.js';
import { SubmissionStatus } from '#root/models/enum/enums.js';

const submissionStatusRank = {
  [SubmissionStatus.WRONG]: 0,
  [SubmissionStatus.IMPROVABLE]: 1,
  [SubmissionStatus.PROBABLY_CORRECT]: 2,
};

const getStatusRank = (status) => submissionStatusRank[status] ?? 0;

const pickLatest = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const aTime = new Date(a.updatedAt).getTime();
  const bTime = new Date(b.updatedAt).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
    return b.id > a.id ? b : a;
  }
  return bTime >= aTime ? b : a;
};

export const computeFinalSubmissionForMatch = async ({
  matchId,
  transaction,
}) => {
  const submissions = await Submission.findAll({
    where: { matchId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (!submissions.length) return null;

  let manual = null;
  let automatic = null;
  submissions.forEach((submission) => {
    if (submission.isAutomaticSubmission) {
      automatic = pickLatest(automatic, submission);
    } else {
      manual = pickLatest(manual, submission);
    }
  });

  let winner = null;
  if (manual && automatic) {
    const manualRank = getStatusRank(manual.status);
    const autoRank = getStatusRank(automatic.status);
    if (autoRank > manualRank) {
      winner = automatic;
    } else {
      winner = manual;
    }
  } else if (manual) {
    winner = manual;
  } else if (automatic) {
    winner = automatic;
  }

  await Submission.update(
    { isFinal: false },
    { where: { matchId }, transaction }
  );

  if (winner) {
    await Submission.update(
      { isFinal: true },
      { where: { id: winner.id }, transaction }
    );
  }

  return winner;
};
