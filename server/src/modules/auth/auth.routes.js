import { Router } from 'express';
import { ok } from '../../utils/http.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authService } from './auth.service.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    return ok(
      res,
      await authService.login(req.body, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      }),
      200
    );
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    return ok(res, await authService.getCurrentUser(req.auth));
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    return ok(
      res,
      await authService.logout(req.authToken, req.auth, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      })
    );
  } catch (error) {
    return next(error);
  }
});

export default router;
