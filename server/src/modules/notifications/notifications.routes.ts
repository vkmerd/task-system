import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as service from './notifications.service.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    service.list(req.user!.id, req.query.unread === 'true'),
    service.unreadCount(req.user!.id),
  ]);
  res.json({ items, unread });
});

router.post('/:id/read', async (req, res) => {
  await service.markRead(req.user!.id, req.params.id);
  res.status(204).end();
});

router.post('/read-all', async (req, res) => {
  await service.markAllRead(req.user!.id);
  res.status(204).end();
});

export default router;
