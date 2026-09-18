import { Router } from 'express';
import { getAuth, requireAuth } from '../../middleware/require-auth';
import type { AuthService } from '../auth/auth.service';
import type { TokenService } from '../auth/token.service';

export function createMeRouter(auth: AuthService, tokens: TokenService) {
  const router = Router();

  router.get('/me', requireAuth(tokens), async (_req, res) => {
    res.json(await auth.me(getAuth(res)));
  });

  return router;
}
