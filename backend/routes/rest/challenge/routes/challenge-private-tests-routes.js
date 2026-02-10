const registerChallengePrivateTestsRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    Match,
    ChallengeMatchSetting,
    Submission,
    PeerReviewAssignment,
    PeerReviewVote,
    VoteType,
    handleException,
    normalizeOutputForComparison,
    runReferenceSolution,
    getRequestRole,
    isPrivilegedRole,
    requirePrivilegedUser,
    isEndedStatus,
    parseJsonValueStrict,
  } = deps;

  router.post(
    '/challenges/:challengeId/match-settings/:matchSettingId/private-tests',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        const matchSettingId = Number(req.params.matchSettingId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid challengeId',
          });
        }
        if (!Number.isInteger(matchSettingId) || matchSettingId < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid matchSettingId',
          });
        }
        if (!isPrivilegedRole(getRequestRole(req))) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized to update private tests.',
          });
        }

        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }
        if (!isEndedStatus(challenge.status)) {
          return res.status(409).json({
            success: false,
            error: 'Challenge has not ended yet.',
          });
        }

        const cms = await ChallengeMatchSetting.findOne({
          where: { challengeId, matchSettingId },
        });
        if (!cms) {
          return res.status(404).json({
            success: false,
            error: 'Match setting not found for this challenge',
          });
        }

        const matchSetting = await MatchSetting.findByPk(matchSettingId);
        if (!matchSetting) {
          return res.status(404).json({
            success: false,
            error: 'Match setting not found',
          });
        }

        const assignmentId = Number(req.body?.assignmentId);
        if (!Number.isInteger(assignmentId) || assignmentId < 1) {
          return res.status(400).json({
            success: false,
            error: 'assignmentId is required to validate the peer review test.',
          });
        }

        const assignment = await PeerReviewAssignment.findOne({
          where: { id: assignmentId },
          include: [
            {
              model: Submission,
              as: 'submission',
              include: [
                {
                  model: Match,
                  as: 'match',
                  include: [
                    {
                      model: ChallengeMatchSetting,
                      as: 'challengeMatchSetting',
                      where: { challengeId, matchSettingId },
                      required: true,
                    },
                  ],
                },
              ],
            },
            {
              model: PeerReviewVote,
              as: 'vote',
            },
          ],
        });

        if (!assignment?.submission) {
          return res.status(404).json({
            success: false,
            error: 'Peer review assignment not found for this match setting.',
          });
        }

        const vote = assignment.vote;
        if (!vote || vote.vote !== VoteType.INCORRECT) {
          return res.status(400).json({
            success: false,
            error:
              'Only incorrect peer review votes can be added to private tests.',
          });
        }

        if (!vote.testCaseInput || !vote.expectedOutput) {
          return res.status(400).json({
            success: false,
            error: 'Peer review test case is missing input or expected output.',
          });
        }

        const parsedInput = parseJsonValueStrict(vote.testCaseInput, 'Input');
        if (!parsedInput.ok) {
          return res.status(400).json({
            success: false,
            error: parsedInput.error,
          });
        }
        const parsedOutput = parseJsonValueStrict(
          vote.expectedOutput,
          'Output'
        );
        if (!parsedOutput.ok) {
          return res.status(400).json({
            success: false,
            error: parsedOutput.error,
          });
        }

        if (!matchSetting.referenceSolution) {
          return res.status(400).json({
            success: false,
            error:
              'Reference solution is required to validate peer review tests.',
          });
        }

        try {
          const referenceResult = await runReferenceSolution({
            referenceSolution: matchSetting.referenceSolution,
            testCaseInput: JSON.stringify(parsedInput.value),
          });
          const normalizedExpected = normalizeOutputForComparison(
            parsedOutput.value
          );
          const normalizedReference = normalizeOutputForComparison(
            referenceResult.referenceOutput
          );

          if (normalizedExpected !== normalizedReference) {
            return res.status(400).json({
              success: false,
              error: 'Expected output does not match the reference solution.',
            });
          }
        } catch (error) {
          return res.status(400).json({
            success: false,
            error:
              error?.message ||
              'Unable to validate the peer review test against the reference solution.',
          });
        }

        const privateTests = Array.isArray(matchSetting.privateTests)
          ? matchSetting.privateTests
          : [];
        const newTestCase = {
          input: parsedInput.value,
          output: parsedOutput.value,
        };

        const alreadyExists = privateTests.some((testCase) => {
          if (!testCase) return false;
          return (
            JSON.stringify(testCase.input) ===
              JSON.stringify(newTestCase.input) &&
            JSON.stringify(testCase.output) ===
              JSON.stringify(newTestCase.output)
          );
        });

        if (!alreadyExists) {
          await matchSetting.update({
            privateTests: [...privateTests, newTestCase],
          });
        }

        return res.json({
          success: true,
          data: {
            matchSettingId: matchSetting.id,
            added: !alreadyExists,
            privateTests: matchSetting.privateTests,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengePrivateTestsRoutes;
