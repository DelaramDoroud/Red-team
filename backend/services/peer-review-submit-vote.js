import PeerReviewAssignment from '#root/models/peer_review_assignment.js';
import PeerReviewVote from '#root/models/peer-review-vote.js';
import ChallengeParticipant from '#root/models/challenge-participant.js';
import Submission from '#root/models/submission.js';
import Match from '#root/models/match.js';
import MatchSetting from '#root/models/match-setting.js';

export const submitVote = async (
  userId,
  assignmentId,
  { vote, testCaseInput, expectedOutput }
) => {
  const validVotes = ['correct', 'incorrect', 'abstain'];
  if (!validVotes.includes(vote)) {
    const error = new Error('Invalid vote type');
    error.code = 'INVALID_INPUT';
    throw error;
  }

  const assignment = await PeerReviewAssignment.findByPk(assignmentId, {
    include: [
      {
        model: Submission,
        as: 'submission',
        include: [
          {
            model: Match,
            as: 'match',
            include: [{ model: MatchSetting, as: 'matchSetting' }],
          },
        ],
      },
      {
        model: ChallengeParticipant,
        as: 'reviewer',
      },
    ],
  });

  if (!assignment) {
    const error = new Error('Assignment not found');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (assignment.reviewer.studentId !== userId) {
    const error = new Error(
      'You are not the assigned reviewer for this solution'
    );
    error.code = 'FORBIDDEN';
    throw error;
  }

  // 4. Validazione Specifica per "Incorrect" (Logica JSON & Public Tests)
  let cleanInput = null;
  let cleanOutput = null;

  if (vote === 'incorrect') {
    if (!testCaseInput?.trim() || !expectedOutput?.trim()) {
      const error = new Error(
        "This vote won't count until you provide both input and expected output"
      );
      error.code = 'INVALID_INPUT';
      throw error;
    }

    let inputJson, outputJson;
    try {
      inputJson = JSON.parse(testCaseInput);
      outputJson = JSON.parse(expectedOutput);
    } catch (e) {
      const error = new Error(
        'Input and output must be valid array values (e.g., [1,2,4], [true,false], ["a","b"]).'
      );
      error.code = 'INVALID_INPUT';
      throw error;
    }

    if (!Array.isArray(inputJson) || !Array.isArray(outputJson)) {
      const error = new Error('Input and output must be valid array values.');
      error.code = 'INVALID_INPUT';
      throw error;
    }

    if (inputJson.length === 0) {
      const error = new Error('Input array cannot be empty.');
      error.code = 'INVALID_INPUT';
      throw error;
    }

    const matchSetting = assignment.submission?.match?.matchSetting;
    const publicTests = matchSetting?.publicTests || [];

    const isPublic = publicTests.some((pt) => {
      const ptInput =
        typeof pt.input === 'string' ? JSON.parse(pt.input) : pt.input;
      return JSON.stringify(ptInput) === JSON.stringify(inputJson);
    });

    if (isPublic) {
      const error = new Error(
        'You cannot use public test cases. Please provide a different test case.'
      );
      error.code = 'INVALID_INPUT';
      throw error;
    }

    cleanInput = testCaseInput;
    cleanOutput = expectedOutput;
  }

  const existingVote = await PeerReviewVote.findOne({
    where: { peerReviewAssignmentId: assignment.id },
  });

  if (existingVote) {
    existingVote.vote = vote;
    existingVote.testCaseInput = cleanInput;
    existingVote.expectedOutput = cleanOutput;
    await existingVote.save();
  } else {
    await PeerReviewVote.create({
      peerReviewAssignmentId: assignment.id,
      vote,
      testCaseInput: cleanInput,
      expectedOutput: cleanOutput,
    });
  }

  return true;
};
