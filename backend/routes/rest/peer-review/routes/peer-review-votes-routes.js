const registerPeerReviewVotesRoutes = (router, deps) => {
  const {
    handleException,
    ChallengeParticipant,
    PeerReviewAssignment,
    PeerReviewVote,
    Submission,
    Match,
    ChallengeMatchSetting,
    MatchSetting,
    User,
    VoteType,
    SubmissionStatus,
    logger,
    runReferenceSolution,
    normalizeOutputForComparison,
  } = deps;

  router.get(
    '/challenges/:challengeId/peer-reviews/votes',
    async (req, res) => {
      try {
        const { challengeId } = req.params;
        const userId = req.user?.id || req.session?.user?.id;
        if (!challengeId) {
          return res.status(400).json({
            success: false,
            error: { message: 'Challenge ID is required' },
          });
        }

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: { message: 'User not authenticated' },
          });
        }

        const participant = await ChallengeParticipant.findOne({
          where: {
            studentId: userId,
            challengeId: challengeId,
          },
        });

        if (!participant) {
          return res.status(403).json({
            success: false,
            error: { message: 'User is not a participant in this challenge' },
          });
        }

        const assignments = await PeerReviewAssignment.findAll({
          where: {
            reviewerId: participant.id,
          },
          include: [
            {
              model: PeerReviewVote,
              as: 'vote',
              required: true,
            },
            {
              model: Submission,
              as: 'submission',
              include: [
                {
                  model: ChallengeParticipant,
                  as: 'challengeParticipant',
                  include: [{ model: User, as: 'student' }],
                },
                {
                  model: Match,
                  as: 'match',
                  include: [
                    {
                      model: ChallengeMatchSetting,
                      as: 'challengeMatchSetting',
                      include: [{ model: MatchSetting, as: 'matchSetting' }],
                    },
                  ],
                },
              ],
            },
          ],
        });

        const votes = [];
        for (const assignment of assignments) {
          const submission = assignment.submission;
          const submissionStatus = submission?.status || null;
          const voteRecord = assignment.vote;
          const revieweeStudent = submission?.challengeParticipant?.student;
          const problemTitle =
            submission?.match?.challengeMatchSetting?.matchSetting
              ?.problemTitle || null;

          let expectedEvaluation = 'unknown';
          if (submissionStatus === SubmissionStatus.PROBABLY_CORRECT) {
            expectedEvaluation = 'correct';
          } else if (
            submissionStatus === SubmissionStatus.IMPROVABLE ||
            submissionStatus === SubmissionStatus.WRONG
          ) {
            expectedEvaluation = 'incorrect';
          }

          let isVoteCorrect =
            typeof voteRecord.isVoteCorrect === 'boolean'
              ? voteRecord.isVoteCorrect
              : null;
          let isExpectedOutputCorrect =
            typeof voteRecord.isExpectedOutputCorrect === 'boolean'
              ? voteRecord.isExpectedOutputCorrect
              : null;
          let referenceOutput = voteRecord.referenceOutput ?? null;
          let needsUpdate = false;

          if (isVoteCorrect === null && submissionStatus) {
            const isSubmissionValid =
              submissionStatus === SubmissionStatus.PROBABLY_CORRECT;
            if (voteRecord.vote === VoteType.CORRECT) {
              isVoteCorrect = isSubmissionValid;
              needsUpdate = true;
            } else if (voteRecord.vote === VoteType.INCORRECT) {
              isVoteCorrect = !isSubmissionValid;
              needsUpdate = true;
            }
          }

          if (
            voteRecord.vote === VoteType.INCORRECT &&
            isExpectedOutputCorrect === null &&
            submission
          ) {
            let matchSetting =
              submission.match?.challengeMatchSetting?.matchSetting;

            if (matchSetting && !matchSetting.referenceSolution) {
              matchSetting = await MatchSetting.findByPk(matchSetting.id);
            }

            if (
              matchSetting?.referenceSolution &&
              voteRecord.testCaseInput &&
              voteRecord.expectedOutput
            ) {
              try {
                const { referenceOutput: computedReferenceOutput } =
                  await runReferenceSolution({
                    referenceSolution: matchSetting.referenceSolution,
                    testCaseInput: voteRecord.testCaseInput,
                  });

                referenceOutput = computedReferenceOutput;
                isExpectedOutputCorrect =
                  normalizeOutputForComparison(voteRecord.expectedOutput) ===
                  normalizeOutputForComparison(referenceOutput);

                needsUpdate = true;
              } catch (evaluationError) {
                logger.error(
                  'Error computing expected output correctness',
                  evaluationError
                );
              }
            }
          }

          if (needsUpdate) {
            await voteRecord.update({
              isVoteCorrect,
              isExpectedOutputCorrect,
              referenceOutput,
            });
          }

          const isBugProven =
            typeof voteRecord.isBugProven === 'boolean'
              ? voteRecord.isBugProven
              : null;

          let earnedCredit = false;
          if (voteRecord.vote === VoteType.CORRECT) {
            earnedCredit = Boolean(
              typeof isVoteCorrect === 'boolean'
                ? isVoteCorrect
                : submissionStatus === SubmissionStatus.PROBABLY_CORRECT
            );
          } else if (voteRecord.vote === VoteType.INCORRECT) {
            let baseCorrect = false;
            if (typeof isVoteCorrect === 'boolean') {
              baseCorrect = isVoteCorrect;
            } else if (submissionStatus) {
              baseCorrect =
                submissionStatus !== SubmissionStatus.PROBABLY_CORRECT;
            }

            if (typeof isExpectedOutputCorrect === 'boolean') {
              earnedCredit = baseCorrect && isExpectedOutputCorrect;
            } else if (typeof isBugProven === 'boolean') {
              earnedCredit = baseCorrect && isBugProven;
            } else {
              earnedCredit = baseCorrect;
            }
          }

          votes.push({
            assignmentId: assignment.id,
            submissionId: assignment.submissionId,
            reviewedSubmission: {
              id: assignment.submissionId,
              matchId: submission?.matchId || submission?.match?.id || null,
              student: revieweeStudent
                ? {
                    id: revieweeStudent.id,
                    username: revieweeStudent.username,
                  }
                : null,
              problemTitle,
            },
            vote: voteRecord.vote,
            expectedEvaluation,
            isCorrect: earnedCredit,
            evaluationStatus: voteRecord.evaluationStatus || null,
            isVoteCorrect,
            isExpectedOutputCorrect,
            isBugProven,
            testCaseInput: voteRecord.testCaseInput,
            expectedOutput: voteRecord.expectedOutput,
            referenceOutput,
            actualOutput: voteRecord.actualOutput ?? null,
            earnedCredit,
          });
        }

        return res.json({
          success: true,
          votes,
        });
      } catch (error) {
        logger.error('Get peer review votes error:', error);
        handleException(res, error);
      }
    }
  );
};

export default registerPeerReviewVotesRoutes;
