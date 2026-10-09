import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from '../../lib/tokens.js';
import { changePasswordSchema, loginSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Cok fazla deneme yaptiniz, 10 dakika sonra tekrar deneyin' } },
});

const clientInfo = (req: { headers: Record<string, unknown>; ip?: string }) => ({
  userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  ip: req.ip,
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const { accessToken, refreshToken, session } = await authService.login(email, password, clientInfo(req));
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, ...session });
});

router.post('/refresh', async (req, res) => {
  const { accessToken, refreshToken, session } = await authService.refresh(
    req.cookies?.[REFRESH_COOKIE],
    clientInfo(req),
  );
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, ...session });
});

router.post('/logout', async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.status(204).end();
});

router.get('/me', authenticate, async (req, res) => {
  res.json(await authService.getSession(req.user!.id));
});

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res) => {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  clearRefreshCookie(res);
  res.json({ message: 'Sifreniz guncellendi, lutfen tekrar giris yapin' });
});

export default router;
