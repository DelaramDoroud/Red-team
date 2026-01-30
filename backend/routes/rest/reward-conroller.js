import { Router } from 'express';
import { handleException } from '#root/services/error.js';
import getRules from '#root/services/rules.js';

const router = Router();

router.get('/rules', async (_req, res) => {
  try {
    const data = await getRules();
    return res.json({ success: true, data });
  } catch (error) {
    return handleException(res, error);
  }
});

export default router;
