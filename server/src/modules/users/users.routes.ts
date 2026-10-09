import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { getQuery, validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  createUserSchema,
  listUsersSchema,
  resetPasswordSchema,
  updateUserSchema,
  type ListUsersQuery,
} from './users.schemas.js';
import * as service from './users.service.js';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.USER_READ),
  validate(listUsersSchema, 'query'),
  async (req, res) => {
    res.json(await service.list(getQuery<ListUsersQuery>(req)));
  },
);

/** Ekip doluluk tablosu - is atamasi yapilirken kime yuk binebilecegini gosterir */
router.get('/workload', requirePermission(PERMISSIONS.USER_READ), async (_req, res) => {
  res.json(await service.workload());
});

router.get('/:id', requirePermission(PERMISSIONS.USER_READ), async (req, res) => {
  res.json(await service.getById(req.params.id as string));
});

router.post('/', requirePermission(PERMISSIONS.USER_WRITE), validate(createUserSchema), async (req, res) => {
  res.status(201).json(await service.create(req.body));
});

router.patch('/:id', requirePermission(PERMISSIONS.USER_WRITE), validate(updateUserSchema), async (req, res) => {
  res.json(await service.update(req.user!, req.params.id as string, req.body));
});

router.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.USER_WRITE),
  validate(resetPasswordSchema),
  async (req, res) => {
    await service.resetPassword(req.params.id as string, req.body.newPassword);
    res.json({ message: 'Sifre sifirlandi' });
  },
);

router.delete('/:id', requirePermission(PERMISSIONS.USER_DELETE), async (req, res) => {
  await service.softDelete(req.user!, req.params.id as string);
  res.status(204).end();
});

export default router;
