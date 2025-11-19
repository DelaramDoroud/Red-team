import { Router } from 'express';
import sequelize from '#root/services/sequelize.mjs';
import Challenge, { validateChallengeData } from '#root/models/challenge.mjs';
import { handleException } from '#root/services/error.mjs';

const router = Router();

/**
 * GET /challenges
 */
router.get('/challenges', async (_req, res) => {
  try {
    // const id = Number(req.params.id);

    // const response = await Blueprint.get(Challenge, id, {
    //   include: Challenge.getDefaultIncludes
    //     ? Challenge.getDefaultIncludes()
    //     : [],
    // });

    res.json({ success: true });
  } catch (error) {
    handleException(res, error);
  }
});

/**
 * POST /challenge
 * Create a new challenge (typically in "draft" status).
 * Shows how to:
 * - validate the payload
 * - use an explicit transaction for the insert
 */
router.post('/challenge', async (req, res) => {
  const payload = {
    title: req.body.title,
    duration: req.body.duration,
    startDatetime: req.body.startDatetime,
    // we assume "status" exists on the model and defaults to "draft",
    // but you can set it explicitly if you want:
    status: req.body.status || 'draft',
  };

  let transaction;

  try {
    // 1) Validate payload with AJV (or similar) through our shared validator.
    await validateChallengeData(payload, {
      validatorKey: 'challenge_create',
    });

    // 2) Start a transaction.
    //    This ensures that all DB operations inside either:
    //    - succeed together (COMMIT)
    //    - or fail together (ROLLBACK)
    transaction = await sequelize.transaction();

    // 3) Perform DB operations inside the transaction.
    const challenge = await Challenge.create(payload, { transaction });

    // 4) If everything was successful, commit the transaction.
    await transaction.commit();

    res.status(201).json({
      success: true,
      challenge,
    });
  } catch (error) {
    // 5) On any error, roll back the transaction (if it was opened).
    if (transaction) await transaction.rollback();
    handleException(res, error);
  }
});

/**
 * POST /challenge/:id/publish
 * Publish a draft challenge.
 * Demonstrates:
 * - row locking with "FOR UPDATE"
 * - business rule checks inside the same transaction
 */
router.post('/challenge/:id/publish', async (req, res) => {
  const id = Number(req.params.id);
  let transaction;

  try {
    transaction = await sequelize.transaction();

    // Lock the row FOR UPDATE to avoid race conditions (e.g. double publish)
    const challenge = await Challenge.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!challenge) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Challenge not found',
      });
    }

    if (challenge.status === 'published') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Challenge is already published',
      });
    }

    // Example of additional business rule:
    // you could block publishing if the start date is in the past, etc.
    // if (new Date(challenge.startDatetime) < new Date()) { ... }

    challenge.status = 'published';
    await challenge.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      challenge,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    handleException(res, error);
  }
});

/**
 * POST /challenge/:id/unpublish
 * Move a published challenge back to "draft".
 */
router.post('/challenge/:id/unpublish', async (req, res) => {
  const id = Number(req.params.id);
  let transaction;

  try {
    transaction = await sequelize.transaction();

    const challenge = await Challenge.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!challenge) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Challenge not found',
      });
    }

    if (challenge.status === 'draft') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Challenge is already in draft state',
      });
    }

    challenge.status = 'draft';
    await challenge.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      challenge,
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    handleException(res, error);
  }
});

/**
 * Example of using the "managed" transaction style:
 * (this is just an example endpoint, you can remove or adapt it)
 *
 * router.post('/challenge/:id/something-complex', async (req, res) => {
 *   try {
 *     const result = await sequelize.transaction(async (transaction) => {
 *       const challenge = await Challenge.findByPk(req.params.id, { transaction });
 *       // ... do multiple queries using the same transaction ...
 *       await challenge.save({ transaction });
 *       return challenge;
 *     });
 *
 *     res.json({ success: true, challenge: result });
 *   } catch (error) {
 *     handleException(res, error);
 *   }
 * });
 */

export default router;
