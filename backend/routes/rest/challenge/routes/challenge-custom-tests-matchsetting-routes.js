const registerChallengeCustomTestsMatchSettingRoutes = (router, deps) => {
  const {
    Challenge,
    MatchSetting,
    Match,
    ChallengeMatchSetting,
    ChallengeParticipant,
    Submission,
    ChallengeStatus,
    SubmissionStatus,
    handleException,
    executeCodeTests,
    validateImportsBlock,
    Op,
    requireAuthenticatedUser,
    shouldHidePrivate,
    normalizeCustomTests,
    resolveStudentIdFromRequest,
  } = deps;
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  router.post(
    '/challenges/:challengeId/custom-tests/run',
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

        const {
          code,
          language = 'cpp',
          tests,
          input,
          expectedOutput,
        } = req.body;
        const requestedStudentId = Number(req.body?.studentId);
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
        if (typeof code !== 'string' || code.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Code is required',
          });
        }

        const importValidationError = validateImportsBlock(code, language);
        if (importValidationError) {
          return res.status(400).json({
            success: false,
            error: importValidationError,
          });
        }

        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge) {
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }
        if (challenge.status !== ChallengeStatus.STARTED_CODING_PHASE) {
          return res.status(409).json({
            success: false,
            error: 'Custom tests are only available during the coding phase.',
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

        let rawTests = Array.isArray(tests) ? tests : [];
        if (rawTests.length === 0 && hasOwn(req.body, 'input')) {
          rawTests = [
            {
              input,
              output: hasOwn(req.body, 'expectedOutput')
                ? expectedOutput
                : null,
            },
          ];
        }

        const normalizedTests = normalizeCustomTests(rawTests);
        if (normalizedTests.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'At least one custom test case is required.',
          });
        }

        const executionResult = await executeCodeTests({
          code,
          language,
          testCases: normalizedTests,
          userId: req.user?.id,
        });

        if (!executionResult.isCompiled) {
          const errorMessage =
            executionResult.errors?.[0]?.error || 'Compilation failed.';
          return res.status(400).json({
            success: false,
            error: errorMessage,
            results: executionResult.testResults,
          });
        }

        return res.json({
          success: true,
          data: {
            isCompiled: executionResult.isCompiled,
            isPassed: executionResult.isPassed,
            results: executionResult.testResults,
            summary: executionResult.summary,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );
  //read Match(assigned matchsettng for joind student)
  router.get(
    '/challenges/:challengeId/matchSetting',
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
          return res.status(404).json({
            success: false,
            message: 'Challenge not found',
          });
        }
        if (shouldHidePrivate(req) && challenge.status === 'private') {
          return res.status(403).json({
            success: false,
            message: 'Challenge is private',
          });
        }
        const canAccessMatchData = [
          ChallengeStatus.STARTED_CODING_PHASE,
          ChallengeStatus.ENDED_CODING_PHASE,
          ChallengeStatus.STARTED_PEER_REVIEW,
          ChallengeStatus.ENDED_PEER_REVIEW,
        ].includes(challenge.status);
        if (!canAccessMatchData) {
          return res.status(409).json({
            success: false,
            message: 'Challenge has not started yet.',
            status: challenge.status,
          });
        }

        const participant = await ChallengeParticipant.findOne({
          where: { challengeId, studentId },
        });

        if (!participant) {
          return res.status(404).json({
            success: false,
            message: 'Participant not found for this challenge and student',
          });
        }

        const match = await Match.findOne({
          where: { challengeParticipantId: participant.id },
        });

        if (!match) {
          return res.status(404).json({
            success: false,
            message: 'Match not found for the given participant',
          });
        }
        const challengeMatchSetting = await ChallengeMatchSetting.findOne({
          where: {
            id: match.challengeMatchSettingId,
          },
        });

        if (!challengeMatchSetting) {
          return res.status(404).json({
            success: false,
            message: 'ChallengeMatchSetting not found for the given match',
          });
        }

        const matchSetting = await MatchSetting.findOne({
          where: { id: challengeMatchSetting.matchSettingId },
        });

        if (!matchSetting) {
          return res.status(404).json({
            success: false,
            message: 'MatchSetting not found for the given match',
          });
        }

        const matchRows = await Match.findAll({
          attributes: ['id'],
          where: { challengeMatchSettingId: challengeMatchSetting.id },
          raw: true,
        });
        const matchIds = matchRows.map((row) => row.id);
        let validSubmissionsCount = 0;
        if (matchIds.length > 0) {
          validSubmissionsCount = await Submission.count({
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
          });
        }

        const peerReviewBlocked =
          challenge.status === ChallengeStatus.ENDED_CODING_PHASE &&
          validSubmissionsCount <= 1;
        const peerReviewBlockedMessage = peerReviewBlocked
          ? 'Thanks for your effort. Peer review will not start because there are not enough submissions to review.'
          : null;

        return res.json({
          success: true,
          data: {
            ...matchSetting.toJSON(),
            validSubmissionsCount,
            peerReviewBlockedMessage,
          },
        });
      } catch (error) {
        handleException(res, error);
      }
    }
  );

  //read Match(assigned match for joind student)
};

export default registerChallengeCustomTestsMatchSettingRoutes;
