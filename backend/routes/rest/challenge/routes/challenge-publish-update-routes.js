const registerChallengePublishUpdateRoutes = (router, deps) => {
  const {
    sequelize,
    Challenge,
    validateChallengeData,
    MatchSetting,
    ChallengeParticipant,
    ChallengeStatus,
    handleException,
    Op,
    requirePrivilegedUser,
    emitChallengeUpdate,
  } = deps;

  router.post(
    '/challenges/:challengeId/publish',
    requirePrivilegedUser,
    async (req, res) => {
      let transaction;
      try {
        const toIsoString = (value) =>
          value instanceof Date ? value.toISOString() : value;
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        transaction = await sequelize.transaction();
        const challenge = await Challenge.findByPk(challengeId, {
          include: [
            {
              model: MatchSetting,
              as: 'matchSettings',
              through: { attributes: [] },
            },
          ],
          transaction,
        });
        if (!challenge) {
          await transaction.rollback();
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (challenge.status === ChallengeStatus.PUBLIC) {
          await transaction.commit();
          return res.json({ success: true, challenge });
        }

        if (challenge.status !== ChallengeStatus.PRIVATE) {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            error: 'Challenge can only be published from private status.',
          });
        }

        const matchSettingIds = (challenge.matchSettings || [])
          .map((setting) => setting?.id)
          .filter((id) => Number.isInteger(id));
        if (matchSettingIds.length === 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: { message: 'At least one match setting is required.' },
          });
        }

        const payload = {
          title: challenge.title,
          duration: challenge.duration,
          startDatetime: toIsoString(challenge.startDatetime),
          endDatetime: toIsoString(challenge.endDatetime),
          durationPeerReview: challenge.durationPeerReview,
          allowedNumberOfReview: challenge.allowedNumberOfReview ?? 5,
          status: ChallengeStatus.PUBLIC,
          matchSettingIds,
        };

        await validateChallengeData(payload, {
          validatorKey: 'challenge-public',
        });

        const overlappingChallenge = await Challenge.findOne({
          where: {
            id: { [Op.ne]: challengeId },
            status: ChallengeStatus.PUBLIC,
            startDatetime: { [Op.lt]: payload.endDatetime },
            endDatetime: { [Op.gt]: payload.startDatetime },
          },
          transaction,
        });
        if (overlappingChallenge) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            error: {
              message: 'Challenge time overlaps with an existing challenge.',
              code: 'challenge_overlap',
            },
          });
        }

        await challenge.update(
          { status: ChallengeStatus.PUBLIC },
          { transaction }
        );
        await transaction.commit();
        emitChallengeUpdate(challenge);
        return res.json({ success: true, challenge });
      } catch (error) {
        if (transaction) {
          try {
            await transaction.rollback();
          } catch (rollbackError) {
            console.error('Failed to rollback challenge publish transaction', {
              rollbackError,
            });
          }
        }
        handleException(res, error);
      }
    }
  );

  router.post(
    '/challenges/:challengeId/unpublish',
    requirePrivilegedUser,
    async (req, res) => {
      const transaction = await sequelize.transaction();
      try {
        const challengeId = Number(req.params.challengeId);
        if (!Number.isInteger(challengeId) || challengeId < 1) {
          await transaction.rollback();
          return res
            .status(400)
            .json({ success: false, error: 'Invalid challengeId' });
        }

        const challenge = await Challenge.findByPk(challengeId, {
          transaction,
        });
        if (!challenge) {
          await transaction.rollback();
          return res
            .status(404)
            .json({ success: false, error: 'Challenge not found' });
        }

        if (challenge.status === ChallengeStatus.PRIVATE) {
          await transaction.commit();
          return res.json({ success: true, challenge });
        }

        if (challenge.status !== ChallengeStatus.PUBLIC) {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            error: 'Challenge can only be unpublished before it starts.',
          });
        }

        await ChallengeParticipant.destroy({
          where: { challengeId: challenge.id },
          transaction,
        });
        await challenge.update(
          { status: ChallengeStatus.PRIVATE },
          { transaction }
        );
        await transaction.commit();
        emitChallengeUpdate(challenge);

        return res.json({ success: true, challenge });
      } catch (error) {
        if (transaction) {
          try {
            await transaction.rollback();
          } catch (rollbackError) {
            console.error(
              'Failed to rollback challenge unpublish transaction',
              {
                rollbackError,
              }
            );
          }
        }
        handleException(res, error);
      }
    }
  );

  router.patch(
    '/challenges/:challengeId',
    requirePrivilegedUser,
    async (req, res) => {
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
        allowedNumberOfReview: req.body.allowedNumberOfReview,
        status: req.body.status,
        matchSettingIds: req.body.matchSettingIds,
      };
      const matchSettingIds = Array.isArray(req.body.matchSettingIds)
        ? req.body.matchSettingIds
        : [];
      let transaction;
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

        if (challenge.status !== ChallengeStatus.PRIVATE) {
          return res.status(409).json({
            success: false,
            error:
              'Challenge must be private to be edited. Unpublish it first.',
            currentStatus: challenge.status,
          });
        }

        payload.status = req.body.status || challenge.status;
        payload.allowedNumberOfReview =
          req.body.allowedNumberOfReview ??
          challenge.allowedNumberOfReview ??
          5;
        payload.matchSettingIds = matchSettingIds;

        if (matchSettingIds.length === 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'At least one match setting is required.' },
          });
        }

        await validateChallengeData(payload, { validatorKey: 'challenge' });

        const start = new Date(payload.startDatetime);
        const end = new Date(payload.endDatetime);
        const durationInMs = payload.duration * 60 * 1000;
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

        const settings = await MatchSetting.findAll({
          where: { id: matchSettingIds },
        });
        if (settings.length !== matchSettingIds.length) {
          const foundIds = settings.map((setting) => setting.id);
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
          const overlappingChallenge = await Challenge.findOne({
            where: {
              id: { [Op.ne]: challengeId },
              status: ChallengeStatus.PUBLIC,
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
        await challenge.update(
          {
            title: payload.title,
            duration: payload.duration,
            startDatetime: payload.startDatetime,
            endDatetime: payload.endDatetime,
            durationPeerReview: payload.durationPeerReview,
            allowedNumberOfReview: payload.allowedNumberOfReview,
            status: payload.status || challenge.status,
          },
          { transaction }
        );
        await challenge.setMatchSettings(settings, { transaction });
        await transaction.commit();

        const updatedChallenge = await Challenge.findByPk(challengeId, {
          include: [
            {
              model: MatchSetting,
              as: 'matchSettings',
              through: { attributes: [] },
            },
          ],
        });
        emitChallengeUpdate(updatedChallenge);
        return res.json({ success: true, challenge: updatedChallenge });
      } catch (error) {
        if (transaction) await transaction.rollback();
        handleException(res, error);
      }
    }
  );
};

export default registerChallengePublishUpdateRoutes;
