import { Router } from 'express';
import { getUserInfo } from '#root/services/session.mjs';

const router = Router();

router.get('/userinfo', async (req, res) => {
  if (!req.session.user) return res.json({ isLoggedIn: false });
  const userInfo = await getUserInfo(req, req.session.user.id);
  res.json({
    isLoggedIn: true,
    ...userInfo,
  });
});

export default router;
