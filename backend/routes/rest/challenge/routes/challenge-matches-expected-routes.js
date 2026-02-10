const registerChallengeMatchesExpectedRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    Match,
    ChallengeMatchSetting,
    ChallengeParticipant,
    User,
    Submission,
    PeerReviewAssignment,
    ChallengeStatus,
    SubmissionStatus,
    handleException,
    Op,
    CODING_PHASE_AUTOSUBMIT_GRACE_MS,
    getInFlightSubmissionsCount,
    requirePrivilegedUser,
    shouldHidePrivate,
  } = deps;

  router.get('/challenges/:challengeId/matches', async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }

      const challenge = await Challenge.findByPk(challengeId);
      if (!challenge) {
        return res
          .status(404)
          .json({ success: false, error: 'Challenge not found' });
      }
      if (shouldHidePrivate(req) && challenge.status === 'private') {
        return res.status(403).json({
          success: false,
          error: 'Challenge is private',
        });
      }

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
          ['id', 'ASC'],
          [{ model: ChallengeMatchSetting, as: 'challengeMatchSetting' }, 'id'],
        ],
      });

      const matchIds = matches.map((matchRow) => matchRow.id);
      const matchSettingByMatchId = new Map(
        matches.map((matchRow) => [
          matchRow.id,
          matchRow.challengeMatchSettingId,
        ])
      );
      const participantById = new Map();
      matches.forEach((matchRow) => {
        const student = matchRow.challengeParticipant?.student;
        if (!student) return;
        participantById.set(matchRow.challengeParticipantId, {
          participantId: matchRow.challengeParticipantId,
          studentId: student.id,
          username: student.username,
        });
      });

      const validSubmissionCounts = {};
      const validSubmissionIds = [];
      let totalSubmissionsCount = 0;
      let finalSubmissionCount = 0;
      const totalMatches = matches.length;

      if (matchIds.length > 0) {
        finalSubmissionCount = await Submission.count({
          where: {
            matchId: { [Op.in]: matchIds },
            isFinal: true,
          },
        });

        totalSubmissionsCount = await Submission.count({
          where: {
            matchId: { [Op.in]: matchIds },
            isFinal: true,
            code: { [Op.ne]: '' },
          },
        });

        const validSubmissions = await Submission.findAll({
          attributes: ['id', 'matchId', 'challengeParticipantId'],
          where: {
            matchId: { [Op.in]: matchIds },
            isFinal: true,
            status: {
              [Op.in]: [
                SubmissionStatus.IMPROVABLE,
                SubmissionStatus.PROBABLY_CORRECT,
              ],
            },
          },
          raw: true,
        });

        validSubmissions.forEach(({ id, matchId }) => {
          const cmsId = matchSettingByMatchId.get(matchId);
          if (!cmsId) return;
          validSubmissionIds.push(id);
          validSubmissionCounts[cmsId] =
            (validSubmissionCounts[cmsId] || 0) + 1;
        });
      }

      const peerReviewAssignmentsByCms = {};
      const peerReviewAssignmentsCountByCms = {};

      if (validSubmissionIds.length > 0) {
        const peerAssignments = await PeerReviewAssignment.findAll({
          where: { submissionId: { [Op.in]: validSubmissionIds } },
          include: [
            {
              model: Submission,
              as: 'submission',
              attributes: ['id', 'matchId', 'challengeParticipantId'],
            },
            {
              model: ChallengeParticipant,
              as: 'reviewer',
              attributes: ['id'],
              include: [
                { model: User, as: 'student', attributes: ['id', 'username'] },
              ],
            },
          ],
        });

        const reviewerMaps = new Map();

        peerAssignments.forEach((assignment) => {
          const submission = assignment.submission;
          if (!submission) return;
          const cmsId = matchSettingByMatchId.get(submission.matchId);
          if (!cmsId) return;

          if (!reviewerMaps.has(cmsId)) {
            reviewerMaps.set(cmsId, new Map());
          }

          const reviewerMap = reviewerMaps.get(cmsId);
          const reviewerParticipantId = assignment.reviewerId;
          const reviewerInfo = participantById.get(reviewerParticipantId) || {
            participantId: reviewerParticipantId,
            studentId: assignment.reviewer?.student?.id ?? null,
            username:
              assignment.reviewer?.student?.username ||
              `Student ${reviewerParticipantId}`,
          };

          if (!reviewerMap.has(reviewerParticipantId)) {
            reviewerMap.set(reviewerParticipantId, {
              reviewer: reviewerInfo,
              reviewees: [],
            });
          }

          const revieweeInfo = participantById.get(
            submission.challengeParticipantId
          ) || {
            participantId: submission.challengeParticipantId,
            studentId: null,
            username: `Student ${submission.challengeParticipantId}`,
          };

          reviewerMap.get(reviewerParticipantId).reviewees.push({
            ...revieweeInfo,
            submissionId: submission.id,
            isExtra: assignment.isExtra,
          });

          peerReviewAssignmentsCountByCms[cmsId] =
            (peerReviewAssignmentsCountByCms[cmsId] || 0) + 1;
        });

        reviewerMaps.forEach((reviewerMap, cmsId) => {
          peerReviewAssignmentsByCms[cmsId] = Array.from(reviewerMap.values());
        });
      }

      const eligibleGroupIds = Object.entries(validSubmissionCounts)
        .filter(([, count]) => count > 1)
        .map(([cmsId]) => Number(cmsId));
      const peerReviewReady =
        eligibleGroupIds.length > 0 &&
        eligibleGroupIds.every(
          (cmsId) => (peerReviewAssignmentsCountByCms[cmsId] || 0) > 0
        );
      const totalValidSubmissions = validSubmissionIds.length;

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
            validSubmissionsCount: validSubmissionCounts[cmsId] || 0,
            peerReviewAssignments: peerReviewAssignmentsByCms[cmsId] || [],
            matches: [],
          };
        }

        grouped[cmsId].matches.push({
          id: matchRow.id,
          student: matchRow.challengeParticipant?.student
            ? {
                id: matchRow.challengeParticipant.student.id,
                username: matchRow.challengeParticipant.student.username,
              }
            : null,
        });
      });

      const inFlightSubmissionsCount = getInFlightSubmissionsCount(challengeId);
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

      return res.json({
        success: true,
        challenge: {
          id: challenge.id,
          title: challenge.title,
          status: challenge.status,
          startDatetime: challenge.startDatetime,
          startCodingPhaseDateTime: challenge.startCodingPhaseDateTime,
          endCodingPhaseDateTime: challenge.endCodingPhaseDateTime,
          startPeerReviewDateTime: challenge.startPeerReviewDateTime,
          endPeerReviewDateTime: challenge.endPeerReviewDateTime,
          duration: challenge.duration,
          durationPeerReview: challenge.durationPeerReview,
          allowedNumberOfReview: challenge.allowedNumberOfReview,
          totalMatches,
          finalSubmissionCount,
          pendingFinalCount: pendingFinalizationCount,
          resultsReady,
          inFlightSubmissionsCount,
          codingPhaseFinalizationCompletedAt:
            challenge.codingPhaseFinalizationCompletedAt,
          validSubmissionsCount: totalValidSubmissions,
          totalSubmissionsCount,
          peerReviewReady,
        },
        assignments: Object.values(grouped),
      });
    } catch (error) {
      handleException(res, error);
    }
  });

  router.patch(
    '/challenges/:challengeId/expected-reviews',
    requirePrivilegedUser,
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const expectedReviews = Number(
          req.body?.expectedReviewsPerSubmission ??
            req.body?.allowedNumberOfReview
        );
        if (!Number.isInteger(expectedReviews) || expectedReviews < 2) {
          return res.status(400).json({
            success: false,
            error:
              'Expected reviews per submission must be an integer greater than or equal to 2.',
          });
        }

        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (shouldHidePrivate(req) && challenge.status === 'private') {
          return res.status(403).json({
            success: false,
            error: 'Challenge is private',
          });
        }

        if (
          challenge.status === ChallengeStatus.STARTED_PEER_REVIEW ||
          challenge.status === ChallengeStatus.ENDED_PEER_REVIEW
        ) {
          return res.status(409).json({
            success: false,
            error:
              'Expected reviews cannot be updated after peer review starts.',
            currentStatus: challenge.status,
          });
        }

        if (challenge.allowedNumberOfReview !== expectedReviews) {
          await challenge.update({ allowedNumberOfReview: expectedReviews });
        }

        return res.json({
          success: true,
          challenge: {
            id: challenge.id,
            allowedNumberOfReview: challenge.allowedNumberOfReview,
            status: challenge.status,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
};

export default registerChallengeMatchesExpectedRoutes;
