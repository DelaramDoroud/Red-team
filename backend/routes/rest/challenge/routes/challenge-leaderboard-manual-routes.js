const registerChallengeLeaderboardManualRoutes = (router, deps) => {
  const {
    Challenge,
    ChallengeParticipant,
    User,
    Submission,
    SubmissionScoreBreakdown,
    StudentBadge,
    Badge,
    Title,
    ChallengeStatus,
    handleException,
    Op,
    calculateChallengeScores,
    getRequestUser,
    shouldHidePrivate,
  } = deps;

  router.get('/challenges/:challengeId/leaderboard', async (req, res) => {
    try {
      const challengeId = Number(req.params.challengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid challengeId' });
      }

      const challenge = await Challenge.findByPk(challengeId, {
        attributes: [
          'id',
          'title',
          'status',
          'endPeerReviewDateTime',
          'scoringStatus',
        ],
      });
      if (!challenge) {
        return res
          .status(404)
          .json({ success: false, error: 'Challenge not found' });
      }

      if (
        shouldHidePrivate(req) &&
        challenge.status === ChallengeStatus.PRIVATE
      ) {
        return res.status(403).json({
          success: false,
          error: 'Challenge is private',
        });
      }

      const scoringReady =
        challenge.status === ChallengeStatus.ENDED_PEER_REVIEW &&
        challenge.scoringStatus === 'completed';

      if (!scoringReady) {
        return res.json({
          success: true,
          data: {
            challenge: {
              id: challenge.id,
              title: challenge.title,
              scoringStatus: challenge.scoringStatus,
            },
            summary: {
              totalParticipants: 0,
              averageScore: 0,
              yourRank: null,
            },
            leaderboard: [],
            personalSummary: null,
          },
        });
      }

      const scoreRows = await SubmissionScoreBreakdown.findAll({
        include: [
          {
            model: Submission,
            as: 'submission',
            attributes: ['id', 'challengeParticipantId'],
            required: true,
            include: [
              {
                model: ChallengeParticipant,
                as: 'challengeParticipant',
                attributes: ['id', 'studentId', 'challengeId'],
                required: true,
                where: { challengeId },
                include: [
                  {
                    model: User,
                    as: 'student',
                    attributes: ['id', 'username', 'titleId'],
                    include: [
                      {
                        model: Title,
                        as: 'title',
                        attributes: ['id', 'name'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      const safeNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const normalizeName = (value) =>
        typeof value === 'string' ? value.toLowerCase() : '';

      const entries = scoreRows
        .map((row) => {
          const submission = row.submission;
          const participant = submission?.challengeParticipant;
          const student = participant?.student;
          if (!student || !participant) return null;
          return {
            submissionId: submission.id,
            participantId: participant.id,
            studentId: student.id,
            username: student.username,
            skillTitle: student.title?.name || null,
            totalScore: safeNumber(row.totalScore),
            implementationScore: safeNumber(row.implementationScore),
            codeReviewScore: safeNumber(row.codeReviewScore),
          };
        })
        .filter(Boolean);

      entries.sort((a, b) => {
        const totalDiff = safeNumber(b.totalScore) - safeNumber(a.totalScore);
        if (totalDiff !== 0) return totalDiff;
        const nameDiff = normalizeName(a.username).localeCompare(
          normalizeName(b.username)
        );
        if (nameDiff !== 0) return nameDiff;
        return safeNumber(a.studentId) - safeNumber(b.studentId);
      });

      const requestUser = getRequestUser(req);
      const requestUserIdRaw = req.query?.studentId ?? requestUser?.id ?? null;
      const requestUserId = Number(requestUserIdRaw);
      const requestUserIdFinal = Number.isFinite(requestUserId)
        ? requestUserId
        : null;
      const studentIds = Array.from(
        new Set(entries.map((entry) => entry.studentId))
      );

      const studentBadges = studentIds.length
        ? await StudentBadge.findAll({
            where: { studentId: { [Op.in]: studentIds } },
            include: [
              {
                model: Badge,
                as: 'badge',
                attributes: ['key', 'name', 'iconKey', 'level', 'category'],
              },
            ],
          })
        : [];

      const badgesByStudent = new Map();
      studentBadges.forEach((row) => {
        const badge = row.badge;
        if (!badge) return;
        const list = badgesByStudent.get(row.studentId) ?? [];
        list.push({
          key: badge.key,
          name: badge.name,
          iconKey: badge.iconKey,
          level: badge.level,
          category: badge.category,
        });
        badgesByStudent.set(row.studentId, list);
      });

      const leaderboard = entries.map((entry, index) => {
        const rank = index + 1;
        const previous = index > 0 ? entries[index - 1] : null;
        const gapFromPrevious =
          previous && previous.totalScore !== null
            ? Math.max(
                0,
                safeNumber(previous.totalScore) - safeNumber(entry.totalScore)
              )
            : null;
        return {
          ...entry,
          rank,
          gapFromPrevious,
          isCurrentUser: requestUserIdFinal
            ? Number(entry.studentId) === Number(requestUserIdFinal)
            : false,
          skillTitle: entry.skillTitle ?? null,
          badges: badgesByStudent.get(entry.studentId) ?? [],
        };
      });

      const totalParticipants = leaderboard.length;
      const averageScoreRaw =
        totalParticipants > 0
          ? leaderboard.reduce(
              (sum, row) => sum + safeNumber(row.totalScore),
              0
            ) / totalParticipants
          : 0;
      const averageScore = Number(averageScoreRaw.toFixed(1));

      const currentRow = requestUserIdFinal
        ? leaderboard.find(
            (row) => Number(row.studentId) === Number(requestUserIdFinal)
          )
        : null;

      const personalSummary = currentRow
        ? {
            studentId: currentRow.studentId,
            rank: currentRow.rank,
            totalScore: currentRow.totalScore,
            implementationScore: currentRow.implementationScore,
            codeReviewScore: currentRow.codeReviewScore,
            gapToPrevious: currentRow.gapFromPrevious,
          }
        : null;

      return res.json({
        success: true,
        data: {
          challenge: {
            id: challenge.id,
            title: challenge.title,
            scoringStatus: challenge.scoringStatus,
          },
          summary: {
            totalParticipants,
            averageScore,
            yourRank: currentRow?.rank ?? null,
          },
          leaderboard,
          personalSummary,
        },
      });
    } catch (error) {
      handleException(res, error);
    }
  });

  router.post(
    '/challenges/:challengeId/test-scoring-manual',
    async (req, res) => {
      try {
        const challengeId = Number(req.params.challengeId);
        console.log(`Manual trigger scoring for challenge ${challengeId}...`);

        const scores = await calculateChallengeScores(challengeId);

        if (scores && scores.length > 0) {
          await Promise.all(
            scores.map(async (scoreItem) => {
              if (scoreItem.submissionId) {
                const [breakdown, created] =
                  await SubmissionScoreBreakdown.findOrCreate({
                    where: { submissionId: scoreItem.submissionId },
                    defaults: {
                      codeReviewScore: scoreItem.codeReviewScore,
                      implementationScore: 0,
                      totalScore: 0,
                    },
                  });
                if (!created) {
                  await breakdown.update({
                    codeReviewScore: scoreItem.codeReviewScore,
                  });
                }
              }
            })
          );
        }

        return res.json({
          success: true,
          message: 'Calculation executed',
          results: scores,
        });
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
      }
    }
  );
};

export default registerChallengeLeaderboardManualRoutes;
