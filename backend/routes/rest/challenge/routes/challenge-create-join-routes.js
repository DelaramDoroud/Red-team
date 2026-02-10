const registerChallengeCreateJoinRoutes = (router, deps) => {
  const {
    sequelize,
    Challenge,
    validateChallengeData,
    MatchSetting,
    ChallengeParticipant,
    ChallengeStatus,
    handleException,
    getValidator,
    joinChallenge,
    broadcastEvent,
    Op,
    requirePrivilegedUser,
    emitChallengeUpdate,
  } = deps;

  router.post('/challenges', requirePrivilegedUser, async (req, res) => {
    const trimmedTitle =
      typeof req.body.title === 'string'
        ? req.body.title.trim()
        : req.body.title;
    const payload = {
      title: trimmedTitle,
      duration: req.body.duration,
      startDatetime: req.body.startDatetime,
      endDatetime: req.body.endDatetime,
      durationPeerReview: req.body.durationPeerReview,
      allowedNumberOfReview: req.body.allowedNumberOfReview ?? 5,
      status: req.body.status || 'private',
    };
    const matchSettingIds = req.body.matchSettingIds || [];
    if (matchSettingIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'At least one match setting is required.' },
      });
    }
    let transaction;
    try {
      await validateChallengeData(payload, {
        validatorKey: 'challenge',
      });

      // Check if duration fits within the time window
      const start = new Date(payload.startDatetime);
      const end = new Date(payload.endDatetime);
      const durationInMs = payload.duration * 60 * 1000; // duration is in minutes
      const windowInMs = end.getTime() - start.getTime();

      if (windowInMs < durationInMs) {
        return res.status(400).json({
          success: false,
          error: {
            message:
              'The time window (endDatetime - startDatetime) must be greater than or equal to the duration.',
          },
        });
      }

      // Validate matchSettingIds before checking overlaps
      // This ensures we return the correct error for invalid matchSettingIds
      const settings = await MatchSetting.findAll({
        where: { id: matchSettingIds },
      });
      if (settings.length !== matchSettingIds.length) {
        const foundIds = settings.map((s) => s.id);
        const missingIds = matchSettingIds.filter(
          (id) => !foundIds.includes(id)
        );
        return res.status(400).json({
          success: false,
          error: {
            message: 'One or more match settings not found.',
            missingIds,
          },
        });
      }

      if (payload.status === ChallengeStatus.PUBLIC) {
        // Check for overlapping challenges only when publishing
        const overlappingChallenge = await Challenge.findOne({
          where: {
            startDatetime: { [Op.lt]: payload.endDatetime },
            endDatetime: { [Op.gt]: payload.startDatetime },
          },
        });

        const allowOverlap = Boolean(req.body.allowOverlap);
        if (overlappingChallenge && !allowOverlap) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Challenge time overlaps with an existing challenge.',
              code: 'challenge_overlap',
            },
          });
        }
        if (overlappingChallenge && allowOverlap) {
          payload.status = ChallengeStatus.PRIVATE;
        }
      }

      transaction = await sequelize.transaction();
      const challenge = await Challenge.create(payload, { transaction });
      await challenge.addMatchSettings(settings, { transaction });
      await transaction.commit();
      const createdChallenge = await Challenge.findByPk(challenge.id, {
        include: [
          {
            model: MatchSetting,
            as: 'matchSettings',
            through: { attributes: [] },
          },
        ],
      });
      emitChallengeUpdate(createdChallenge);
      res.status(201).json({
        success: true,
        challenge: createdChallenge,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test')
        console.error('Create Challenge Error:', error);
      if (transaction) await transaction.rollback();
      handleException(res, error);
    }
  });

  const validateJoinChallenge = getValidator('join-challenge');
  router.post('/challenges/:challengeId/join', async (req, res) => {
    try {
      if (!validateJoinChallenge) {
        return res.status(500).json({
          success: false,
          error: 'Join-challenge validator not found',
        });
      }
      const valid = validateJoinChallenge(req.body);
      if (!valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid join payload',
          details: validateJoinChallenge.errors,
        });
      }

      const { studentId } = req.body;

      const { challengeId: rawChallengeId } = req.params;

      const challengeId = Number(rawChallengeId);
      if (!Number.isInteger(challengeId) || challengeId < 1) {
        return res.status(400).json({
          success: false,
          error: 'Invalid challengeId',
        });
      }
      const { status, participation } = await joinChallenge({
        studentId: Number(studentId),
        challengeId,
      });

      if (status === 'challenge_not_found') {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found',
        });
      }

      if (status === 'challenge_private') {
        return res.status(403).json({
          success: false,
          error: 'Challenge is private',
        });
      }

      if (status === 'student_not_found') {
        return res.status(404).json({
          success: false,
          error: 'Student not found',
        });
      }

      if (status === 'already_joined') {
        return res.status(409).json({
          success: false,
          error: 'Student already joined this challenge',
        });
      }

      if (status === 'ok') {
        const participantsCount = await ChallengeParticipant.count({
          where: { challengeId },
        });
        broadcastEvent({
          event: 'challenge-participant-joined',
          data: {
            challengeId,
            count: participantsCount,
          },
        });
      }

      return res.json({
        success: true,
        result: participation,
      });
    } catch (error) {
      handleException(res, error);
    }
  });
};

export default registerChallengeCreateJoinRoutes;
