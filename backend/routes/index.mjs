import { Router } from 'express';
import userRouter from '#root/routes/api/user-controller.mjs';
import configRouter from '#root/routes/api/config-controller.mjs';
import researchItemRouter from '#root/routes/rest/challenge-controller.mjs';
import schemaRouter from '#root/routes/rest/schema-controller.mjs';

const router = Router();

router.use('/api', userRouter);
router.use('/api', configRouter);

const restApiPrefix = '/api/rest';
router.use(restApiPrefix, researchItemRouter);
router.use(restApiPrefix, schemaRouter);

router.all(/\/api\/(.*)/, (_req, res) => {
  res.status(404);
  res.json({ status: 404, message: 'Not Found' });
});
export default router;
