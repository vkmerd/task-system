import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { badRequest } from '../../lib/errors.js';

/** Departman ve unvan (ünvan) yonetimi - calisan kadrosunun iskeleti */
const router = Router();
router.use(authenticate);

const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Departman adi zorunlu').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Renk #RRGGBB formatinda olmali').default('#1976d2'),
});

const jobTitleSchema = z.object({
  name: z.string().trim().min(2, 'Unvan adi zorunlu').max(80),
  departmentId: z.string().cuid('Departman secilmeli'),
  level: z.number().int().min(1).max(5).default(2),
});

router.get('/departments', async (_req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: {
      jobTitles: { orderBy: [{ level: 'desc' }, { name: 'asc' }] },
      _count: { select: { employees: true } },
    },
  });
  res.json(departments);
});

router.post(
  '/departments',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.USER_WRITE),
  validate(departmentSchema),
  async (req, res) => {
    res.status(201).json(await prisma.department.create({ data: req.body }));
  },
);

router.patch(
  '/departments/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.USER_WRITE),
  validate(departmentSchema.partial()),
  async (req, res) => {
    res.json(await prisma.department.update({ where: { id: req.params.id as string }, data: req.body }));
  },
);

router.delete(
  '/departments/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req, res) => {
    const count = await prisma.employeeProfile.count({ where: { departmentId: req.params.id as string } });
    if (count > 0) throw badRequest(`Bu departmanda ${count} calisan var, once onlari tasiyin`);
    await prisma.department.delete({ where: { id: req.params.id as string } });
    res.status(204).end();
  },
);

router.get('/job-titles', async (_req, res) => {
  const titles = await prisma.jobTitle.findMany({
    orderBy: [{ departmentId: 'asc' }, { level: 'desc' }],
    include: {
      department: { select: { id: true, name: true, color: true } },
      _count: { select: { employees: true } },
    },
  });
  res.json(titles);
});

router.post(
  '/job-titles',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.USER_WRITE),
  validate(jobTitleSchema),
  async (req, res) => {
    res.status(201).json(await prisma.jobTitle.create({ data: req.body }));
  },
);

router.patch(
  '/job-titles/:id',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.USER_WRITE),
  validate(jobTitleSchema.partial()),
  async (req, res) => {
    res.json(await prisma.jobTitle.update({ where: { id: req.params.id as string }, data: req.body }));
  },
);

router.delete('/job-titles/:id', requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
  const count = await prisma.employeeProfile.count({ where: { jobTitleId: req.params.id as string } });
  if (count > 0) throw badRequest(`Bu unvana sahip ${count} calisan var`);
  await prisma.jobTitle.delete({ where: { id: req.params.id as string } });
  res.status(204).end();
});

export default router;
