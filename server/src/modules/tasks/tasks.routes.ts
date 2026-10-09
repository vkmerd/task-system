import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { getQuery, validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  assignTaskSchema,
  checklistItemSchema,
  commentSchema,
  createTaskSchema,
  listTasksSchema,
  moveTaskSchema,
  timeLogSchema,
  updateTaskSchema,
  type ListTasksQuery,
} from './tasks.schemas.js';
import * as service from './tasks.service.js';

const router = Router();
router.use(authenticate);

router.get('/', validate(listTasksSchema, 'query'), async (req, res) => {
  res.json(await service.list(req.user!, getQuery<ListTasksQuery>(req)));
});

router.get('/board', validate(listTasksSchema, 'query'), async (req, res) => {
  res.json(await service.board(req.user!, getQuery<ListTasksQuery>(req)));
});

router.post('/', requirePermission(PERMISSIONS.TASK_CREATE), validate(createTaskSchema), async (req, res) => {
  res.status(201).json(await service.create(req.user!, req.body));
});

router.get('/:id', async (req, res) => {
  res.json(await service.getById(req.user!, req.params.id as string));
});

router.patch('/:id', validate(updateTaskSchema), async (req, res) => {
  res.json(await service.update(req.user!, req.params.id as string, req.body));
});

router.post('/:id/assign', requirePermission(PERMISSIONS.TASK_ASSIGN), validate(assignTaskSchema), async (req, res) => {
  res.json(await service.assign(req.user!, req.params.id as string, req.body.assigneeId));
});

router.post('/:id/move', validate(moveTaskSchema), async (req, res) => {
  res.json(await service.move(req.user!, req.params.id as string, req.body.status, req.body.position));
});

router.delete('/:id', requirePermission(PERMISSIONS.TASK_DELETE), async (req, res) => {
  await service.softDelete(req.user!, req.params.id as string);
  res.status(204).end();
});

router.post('/:id/comments', validate(commentSchema), async (req, res) => {
  res.status(201).json(await service.addComment(req.user!, req.params.id as string, req.body.body, req.body.isInternal));
});

router.post('/:id/time-logs', validate(timeLogSchema), async (req, res) => {
  res.status(201).json(await service.addTimeLog(req.user!, req.params.id as string, req.body));
});

router.post('/:id/checklist', validate(checklistItemSchema), async (req, res) => {
  res.status(201).json(await service.addChecklistItem(req.user!, req.params.id as string, req.body.title));
});

router.patch('/:id/checklist/:itemId', validate(checklistItemSchema), async (req, res) => {
  res.json(await service.updateChecklistItem(req.user!, req.params.id as string, req.params.itemId as string, req.body));
});

router.delete('/:id/checklist/:itemId', async (req, res) => {
  await service.removeChecklistItem(req.user!, req.params.id as string, req.params.itemId as string);
  res.status(204).end();
});

router.post('/:id/watch', async (req, res) => {
  res.json(await service.toggleWatch(req.user!, req.params.id as string));
});

export default router;