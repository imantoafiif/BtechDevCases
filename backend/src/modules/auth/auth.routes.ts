import { loginSchema, registerSchema } from '@btech/shared';
import { Router } from 'express';
import type { Config } from '../../config/env';
import { loginRateLimit, registerRateLimit } from '../../middleware/rate-limit';
import { getAuth, requireAuth } from '../../middleware/require-auth';
import { validateBody } from '../../middleware/validate-body';
import type { AuthService } from './auth.service';
import type { TokenService } from './token.service';

export function createAuthRouter(auth: AuthService, tokens: TokenService, config: Config) {
  const router = Router();

  router.post(
    '/register',
    registerRateLimit(config.rateLimit.register),
    validateBody(registerSchema),
    async (req, res) => {
      res.status(201).json(await auth.register(req.body));
    },
  );

  router.post(
    '/login',
    loginRateLimit(config.rateLimit.login),
    validateBody(loginSchema),
    async (req, res) => {
      res.json(await auth.login(req.body));
    },
  );

  router.post('/refresh', requireAuth(tokens), async (_req, res) => {
    res.json(await auth.renew(getAuth(res)));
  });

  return router;
}
