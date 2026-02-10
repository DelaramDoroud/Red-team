const registerChallengeTeacherResultsRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    Match,
    ChallengeMatchSetting,
    ChallengeParticipant,
    User,
    Submission,
    PeerReviewAssignment,
    PeerReviewVote,
    handleException,
    executeCodeTests,
    Op,
    getRequestUser,
    requirePrivilegedUser,
    isEndedStatus,
    parseTestResults,
    parseJsonValue,
    executeInBatches,
  } = deps;

  router.get(
    '/challenges/:challengeId/teacher-results',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid challengeId',
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

        const includePeerReviewResults =
          String(req.query.includePeerReviewResults).toLowerCase() === 'true';

        const matches = await Match.findAll({
          include: [
            {
              model: ChallengeMatchSetting,
              as: 'challengeMatchSetting',
              where: { challengeId },
              include: [{ model: MatchSetting, as: 'matchSetting' }],
            },
            {
              model: ChallengeParticipant,
              as: 'challengeParticipant',
              include: [{ model: User, as: 'student' }],
            },
          ],
          order: [
            [
              { model: ChallengeMatchSetting, as: 'challengeMatchSetting' },
              'id',
            ],
            ['id', 'ASC'],
          ],
        });

        const matchIds = matches.map((matchRow) => matchRow.id);
        const submissions =
          matchIds.length > 0
            ? await Submission.findAll({
                where: { matchId: { [Op.in]: matchIds } },
                order: [
                  ['isFinal', 'DESC'],
                  ['updatedAt', 'DESC'],
                  ['id', 'DESC'],
                ],
              })
            : [];

        const submissionByMatchId = new Map();
        submissions.forEach((submission) => {
          if (!submissionByMatchId.has(submission.matchId)) {
            submissionByMatchId.set(submission.matchId, submission);
          }
        });

        const submissionsById = new Map(
          Array.from(submissionByMatchId.values()).map((submission) => [
            submission.id,
            submission,
          ])
        );
        const submissionIds = Array.from(submissionsById.keys());

        const assignments =
          submissionIds.length > 0
            ? await PeerReviewAssignment.findAll({
                where: { submissionId: { [Op.in]: submissionIds } },
                include: [
                  {
                    model: ChallengeParticipant,
                    as: 'reviewer',
                    include: [{ model: User, as: 'student' }],
                  },
                  {
                    model: PeerReviewVote,
                    as: 'vote',
                  },
                ],
              })
            : [];

        const assignmentsBySubmissionId = new Map();
        assignments.forEach((assignment) => {
          const submissionId = assignment.submissionId;
          if (!assignmentsBySubmissionId.has(submissionId)) {
            assignmentsBySubmissionId.set(submissionId, []);
          }
          assignmentsBySubmissionId.get(submissionId).push(assignment);
        });

        const testResultsByAssignmentId = new Map();
        if (includePeerReviewResults && assignments.length > 0) {
          const executionTasks = Array.from(
            assignmentsBySubmissionId.entries()
          ).map(([submissionId, submissionAssignments]) => async () => {
            const submission = submissionsById.get(submissionId);
            if (!submission?.code) return;

            const testCases = [];
            const assignmentIds = [];

            submissionAssignments.forEach((assignment) => {
              const vote = assignment.vote;
              if (!vote?.testCaseInput || !vote?.expectedOutput) return;
              const inputValue = parseJsonValue(vote.testCaseInput);
              const outputValue = parseJsonValue(vote.expectedOutput);
              testCases.push({ input: inputValue, output: outputValue });
              assignmentIds.push(assignment.id);
            });

            if (testCases.length === 0) return;

            try {
              const executionResult = await executeCodeTests({
                code: submission.code,
                language: 'cpp',
                testCases,
                userId: getRequestUser(req)?.id,
              });

              executionResult?.testResults?.forEach((result, index) => {
                const assignmentId = assignmentIds[index];
                if (!assignmentId) return;
                testResultsByAssignmentId.set(assignmentId, {
                  passed: result.passed,
                  actualOutput: result.actualOutput,
                  expectedOutput: result.expectedOutput,
                  error: result.error || result.stderr || null,
                  exitCode: result.exitCode,
                });
              });
            } catch (error) {
              assignmentIds.forEach((assignmentId) => {
                testResultsByAssignmentId.set(assignmentId, {
                  passed: false,
                  actualOutput: null,
                  expectedOutput: null,
                  error:
                    error?.message ||
                    'Unable to run the submitted peer review test.',
                  exitCode: -1,
                });
              });
            }
          });

          await executeInBatches(executionTasks, 4);
        }

        const grouped = {};
        matches.forEach((matchRow) => {
          const cmsId = matchRow.challengeMatchSettingId;
          if (!grouped[cmsId]) {
            grouped[cmsId] = {
              challengeMatchSettingId: cmsId,
              matchSetting: matchRow.challengeMatchSetting?.matchSetting
                ? {
                    id: matchRow.challengeMatchSetting.matchSetting.id,
                    problemTitle:
                      matchRow.challengeMatchSetting.matchSetting.problemTitle,
                  }
                : null,
              matches: [],
            };
          }

          const submission = submissionByMatchId.get(matchRow.id);
          const assignmentsForSubmission = submission
            ? assignmentsBySubmissionId.get(submission.id) || []
            : [];

          grouped[cmsId].matches.push({
            id: matchRow.id,
            student: matchRow.challengeParticipant?.student
              ? {
                  id: matchRow.challengeParticipant.student.id,
                  username: matchRow.challengeParticipant.student.username,
                  firstName: matchRow.challengeParticipant.student.firstName,
                  lastName: matchRow.challengeParticipant.student.lastName,
                  email: matchRow.challengeParticipant.student.email,
                }
              : null,
            submission: submission
              ? {
                  id: submission.id,
                  code: submission.code,
                  status: submission.status,
                  isFinal: submission.isFinal,
                  publicTestResults: parseTestResults(
                    submission.publicTestResults
                  ),
                  privateTestResults: parseTestResults(
                    submission.privateTestResults
                  ),
                  createdAt: submission.createdAt,
                  updatedAt: submission.updatedAt,
                }
              : null,
            peerReviewAssignments: assignmentsForSubmission.map(
              (assignment) => ({
                id: assignment.id,
                isExtra: assignment.isExtra,
                feedbackTests: assignment.feedbackTests || [],
                reviewer: assignment.reviewer?.student
                  ? {
                      id: assignment.reviewer.student.id,
                      username: assignment.reviewer.student.username,
                      firstName: assignment.reviewer.student.firstName,
                      lastName: assignment.reviewer.student.lastName,
                      email: assignment.reviewer.student.email,
                    }
                  : null,
                vote: assignment.vote
                  ? {
                      id: assignment.vote.id,
                      vote: assignment.vote.vote,
                      testCaseInput: assignment.vote.testCaseInput,
                      expectedOutput: assignment.vote.expectedOutput,
                      actualOutput: assignment.vote.actualOutput,
                      referenceOutput: assignment.vote.referenceOutput,
                      isExpectedOutputCorrect:
                        assignment.vote.isExpectedOutputCorrect,
                      isBugProven: assignment.vote.isBugProven,
                      isVoteCorrect: assignment.vote.isVoteCorrect,
                      evaluationStatus: assignment.vote.evaluationStatus,
                      createdAt: assignment.vote.createdAt,
                    }
                  : null,
                testExecution:
                  testResultsByAssignmentId.get(assignment.id) || null,
              })
            ),
          });
        });

        return res.json({
          success: true,
          data: {
            challenge: {
              id: challenge.id,
              status: challenge.status,
              title: challenge.title,
            },
            matchSettings: Object.values(grouped),
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengeTeacherResultsRoutes;
