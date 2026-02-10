const registerChallengeStudentResultsRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    Match,
    ChallengeMatchSetting,
    ChallengeParticipant,
    User,
    Submission,
    PeerReviewAssignment,
    SubmissionScoreBreakdown,
    ChallengeStatus,
    handleException,
    logger,
    CODING_PHASE_AUTOSUBMIT_GRACE_MS,
    getInFlightSubmissionsCount,
    awardChallengeMilestoneBadges,
    awardReviewMilestoneBadges,
    awardReviewQualityBadges,
    getReviewBadgesEarnedSince,
    requireAuthenticatedUser,
    isEndedStatus,
    parseTestResults,
    resolveStudentIdFromRequest,
  } = deps;

  router.get(
    '/challenges/:challengeId/results',
    requireAuthenticatedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid challengeId',
          });
        }
        const requestedStudentId = Number(req.query.studentId);
        const studentIdentity = resolveStudentIdFromRequest(
          req,
          Number.isInteger(requestedStudentId) && requestedStudentId > 0
            ? requestedStudentId
            : null
        );
        if (!studentIdentity.ok) {
          return res.status(studentIdentity.status).json({
            success: false,
            error: studentIdentity.error,
          });
        }
        const { studentId } = studentIdentity;

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

        const participant = await ChallengeParticipant.findOne({
          where: { challengeId, studentId },
        });
        if (!participant) {
          return res.status(403).json({
            success: false,
            error: 'Student has not joined this challenge',
          });
        }

        const match = await Match.findOne({
          where: { challengeParticipantId: participant.id },
          include: [
            {
              model: ChallengeMatchSetting,
              as: 'challengeMatchSetting',
              include: [{ model: MatchSetting, as: 'matchSetting' }],
            },
          ],
        });
        if (!match) {
          return res.status(404).json({
            success: false,
            error: 'Match not found for this student',
          });
        }

        const totalMatches = await Match.count({
          include: [
            {
              model: ChallengeMatchSetting,
              as: 'challengeMatchSetting',
              required: true,
              where: { challengeId },
            },
          ],
        });

        const finalSubmissionCount = await Submission.count({
          distinct: true,
          col: 'match_id',
          where: { isFinal: true },
          include: [
            {
              model: Match,
              as: 'match',
              required: true,
              attributes: [],
              include: [
                {
                  model: ChallengeMatchSetting,
                  as: 'challengeMatchSetting',
                  required: true,
                  attributes: [],
                  where: { challengeId },
                },
              ],
            },
          ],
        });

        const inFlightSubmissionsCount =
          getInFlightSubmissionsCount(challengeId);
        const pendingFinalCount = Math.max(
          0,
          totalMatches - finalSubmissionCount
        );
        const withinAutosubmitGrace = (() => {
          if (challenge.status !== ChallengeStatus.ENDED_CODING_PHASE)
            return false;
          if (!CODING_PHASE_AUTOSUBMIT_GRACE_MS) return false;
          if (!challenge.endCodingPhaseDateTime) return false;
          const endMs = new Date(challenge.endCodingPhaseDateTime).getTime();
          if (Number.isNaN(endMs)) return false;
          return Date.now() - endMs < CODING_PHASE_AUTOSUBMIT_GRACE_MS;
        })();
        const gracePendingCount = withinAutosubmitGrace ? 1 : 0;
        const pendingFinalizationCount =
          challenge.status === ChallengeStatus.ENDED_CODING_PHASE
            ? pendingFinalCount + inFlightSubmissionsCount + gracePendingCount
            : pendingFinalCount;
        const resultsReady = pendingFinalizationCount === 0;

        let studentSubmission = await Submission.findOne({
          where: { matchId: match.id, isFinal: true },
          order: [
            ['updatedAt', 'DESC'],
            ['id', 'DESC'],
          ],
        });

        if (!studentSubmission) {
          studentSubmission = await Submission.findOne({
            where: { matchId: match.id },
            order: [
              ['updatedAt', 'DESC'],
              ['id', 'DESC'],
            ],
          });
        }

        const manualSubmission = await Submission.findOne({
          where: { matchId: match.id, isAutomaticSubmission: false },
          order: [
            ['updatedAt', 'DESC'],
            ['id', 'DESC'],
          ],
        });

        const automaticSubmission = await Submission.findOne({
          where: { matchId: match.id, isAutomaticSubmission: true },
          order: [
            ['updatedAt', 'DESC'],
            ['id', 'DESC'],
          ],
        });

        const submissionSummary = {
          hasManualSubmission: Boolean(manualSubmission),
          hasAutomaticSubmission: Boolean(automaticSubmission),
          automaticStatus: automaticSubmission?.status || null,
          finalIsAutomatic: studentSubmission?.isAutomaticSubmission === true,
        };

        const peerReviewEndTimestamp = challenge.endPeerReviewDateTime
          ? new Date(challenge.endPeerReviewDateTime).getTime()
          : null;
        const hasPeerReviewEnded =
          peerReviewEndTimestamp !== null
            ? peerReviewEndTimestamp <= Date.now()
            : false;
        const isFullyEnded =
          challenge.status === ChallengeStatus.ENDED_PEER_REVIEW &&
          hasPeerReviewEnded;
        let otherSubmissions = [];
        if (isFullyEnded) {
          const submissions = await Submission.findAll({
            where: { isFinal: true },
            include: [
              {
                model: Match,
                as: 'match',
                where: {
                  challengeMatchSettingId: match.challengeMatchSettingId,
                },
                attributes: ['id', 'challengeMatchSettingId'],
              },
              {
                model: ChallengeParticipant,
                as: 'challengeParticipant',
                attributes: ['id'],
                include: [
                  {
                    model: User,
                    as: 'student',
                    attributes: ['id', 'username'],
                  },
                ],
              },
            ],
            order: [
              ['updatedAt', 'DESC'],
              ['id', 'DESC'],
            ],
          });

          otherSubmissions = submissions
            .filter(
              (submission) =>
                submission.challengeParticipantId !== participant.id
            )
            .map((submission) => ({
              id: submission.id,
              code: submission.code,
              createdAt: submission.createdAt,
              matchId: submission.matchId,
              student: submission.challengeParticipant?.student
                ? {
                    id: submission.challengeParticipant.student.id,
                    username: submission.challengeParticipant.student.username,
                  }
                : null,
            }));
        }

        let peerReviewTests = [];
        let scoreBreakdown = null;
        if (isFullyEnded && studentSubmission) {
          scoreBreakdown = await SubmissionScoreBreakdown.findOne({
            where: { submissionId: studentSubmission.id },
          });

          const assignments = await PeerReviewAssignment.findAll({
            where: { submissionId: studentSubmission.id },
            include: [
              {
                model: ChallengeParticipant,
                as: 'reviewer',
                attributes: ['id'],
                include: [
                  {
                    model: User,
                    as: 'student',
                    attributes: ['id', 'username'],
                  },
                ],
              },
            ],
          });
          peerReviewTests = assignments.map((assignment) => ({
            id: assignment.id,
            reviewer: assignment.reviewer?.student
              ? {
                  id: assignment.reviewer.student.id,
                  username: assignment.reviewer.student.username,
                }
              : null,
            tests: assignment.feedbackTests || [],
          }));
        }
        const challengeBadgeStatus =
          await awardChallengeMilestoneBadges(studentId);
        // Award and return review badges only after peer review is finalized and vote
        // results (e.g. is_vote_correct) are registered in the database.
        let reviewMilestoneBadges = [];
        let reviewQualityBadges = [];
        let reviewBadgesAlreadyEarned = [];
        if (challenge.scoringStatus === 'completed') {
          const milestone = await awardReviewMilestoneBadges(studentId);
          const quality = await awardReviewQualityBadges(studentId);
          reviewMilestoneBadges = milestone.newlyUnlocked;
          reviewQualityBadges = quality.newlyUnlocked;
          // Include review badges already earned (e.g. from finalize) so the result
          // page modal can show them; they are not "newly created" here.
          const peerReviewEnd = challenge.endPeerReviewDateTime
            ? new Date(challenge.endPeerReviewDateTime)
            : null;
          reviewBadgesAlreadyEarned = await getReviewBadgesEarnedSince(
            studentId,
            peerReviewEnd
          );
        }
        const reviewFromAward = [
          ...reviewMilestoneBadges,
          ...reviewQualityBadges,
        ];
        const awardIds = new Set(reviewFromAward.map((b) => b.id));
        const extraReview = reviewBadgesAlreadyEarned.filter(
          (b) => !awardIds.has(b.id)
        );
        const badgeStatus = {
          ...challengeBadgeStatus,
          newlyUnlocked: [
            ...challengeBadgeStatus.newlyUnlocked,
            ...reviewFromAward,
            ...extraReview,
          ],
        };
        logger.info(`BadgeStatus for student ${studentId}: ${badgeStatus}`);
        return res.json({
          success: true,
          data: {
            challenge: {
              id: challenge.id,
              title: challenge.title,
              status: challenge.status,
              endPeerReviewDateTime: challenge.endPeerReviewDateTime,
              scoringStatus: challenge.scoringStatus,
            },
            matchSetting: match.challengeMatchSetting?.matchSetting
              ? {
                  id: match.challengeMatchSetting.matchSetting.id,
                  problemTitle:
                    match.challengeMatchSetting.matchSetting.problemTitle,
                }
              : null,
            studentSubmission: studentSubmission
              ? {
                  id: studentSubmission.id,
                  code: studentSubmission.code,
                  status: studentSubmission.status,
                  isAutomaticSubmission:
                    studentSubmission.isAutomaticSubmission,
                  isFinal: studentSubmission.isFinal,
                  publicTestResults: parseTestResults(
                    studentSubmission.publicTestResults
                  ),
                  privateTestResults: parseTestResults(
                    studentSubmission.privateTestResults
                  ),
                  createdAt: studentSubmission.createdAt,
                }
              : null,
            submissionSummary,
            finalization: {
              totalMatches,
              finalSubmissionCount,
              pendingFinalCount: pendingFinalizationCount,
              resultsReady,
              inFlightSubmissionsCount,
              codingPhaseFinalizationCompletedAt:
                challenge.codingPhaseFinalizationCompletedAt,
            },
            otherSubmissions,
            peerReviewTests,
            scoreBreakdown,
            badges: {
              completedChallenges: badgeStatus.completedChallenges,
              newlyUnlocked: badgeStatus.newlyUnlocked,
            },
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengeStudentResultsRoutes;
