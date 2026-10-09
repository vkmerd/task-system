import { ActivityType, type Prisma, type Task, type TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { assertCustomerAccess, assertTaskAccess, commentVisibility, taskScope } from '../../lib/scope.js';
import { notify } from '../notifications/notifications.service.js';
import type { AuthUser } from '../../types/express.js';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './tasks.schemas.js';

const listSelect = {
  id: true,
  code: true,
  title: true,
  status: true,
  priority: true,
  estimatedHours: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  position: true,
  isBillable: true,
  isVisibleToCustomer: true,
  revisionCount: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, companyName: true, slug: true, logoUrl: true } },
  project: { select: { id: true, name: true, color: true } },
  service: { select: { id: true, serviceType: true } },
  assignee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      employeeProfile: { select: { jobTitle: { select: { name: true } } } },
    },
  },
  reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
  _count: { select: { comments: true, attachments: true, checklist: true } },
} satisfies Prisma.TaskSelect;

/** Musteri bazli artan is kodu uretir: ACME-142 */
async function nextTaskCode(tx: Prisma.TransactionClient, customerId: string, companyName: string) {
  const fallbackPrefix = (companyName.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü0-9]/g, '').slice(0, 4) || 'TASK').toUpperCase();
  const counter = await tx.taskCounter.upsert({
    where: { customerId },
    create: { customerId, prefix: fallbackPrefix, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { prefix: true, lastNumber: true },
  });
  return `${counter.prefix}-${counter.lastNumber}`;
}

async function logActivity(
  tx: Prisma.TransactionClient,
  taskId: string,
  actorId: string,
  type: ActivityType,
  meta?: Prisma.InputJsonValue,
) {
  await tx.taskActivity.create({ data: { taskId, actorId, type, ...(meta && { meta }) } });
}

// ---------------------------------------------------------------------------
// Listeleme
// ---------------------------------------------------------------------------

function buildFilters(query: ListTasksQuery): Prisma.TaskWhereInput {
  const status = Array.isArray(query.status) ? { in: query.status } : query.status;

  return {
    ...(query.customerId && { customerId: query.customerId }),
    ...(query.projectId && { projectId: query.projectId }),
    ...(query.assigneeId && { assigneeId: query.assigneeId }),
    ...(status && { status }),
    ...(query.priority && { priority: query.priority }),
    ...(query.serviceType && { service: { serviceType: query.serviceType } }),
    ...(query.unassigned && { assigneeId: null }),
    ...(query.overdue && {
      dueDate: { lt: new Date() },
      status: { notIn: ['DONE', 'CANCELLED'] as TaskStatus[] },
    }),
    ...((query.dueBefore || query.dueAfter) &&
      !query.overdue && {
        dueDate: {
          ...(query.dueAfter && { gte: query.dueAfter }),
          ...(query.dueBefore && { lte: query.dueBefore }),
        },
      }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { code: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
      ],
    }),
  };
}

export async function list(user: AuthUser, query: ListTasksQuery) {
  const scope = await taskScope(user);
  const where: Prisma.TaskWhereInput = { AND: [scope, buildFilters(query)] };

  // Oncelik siralamasi enum sirasina gore degil, is onemine gore olmali.
  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    query.sortBy === 'priority'
      ? [{ priority: query.sortDir === 'asc' ? 'desc' : 'asc' }, { dueDate: 'asc' }]
      : [{ [query.sortBy]: query.sortDir } as Prisma.TaskOrderByWithRelationInput];

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: listSelect,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

/** Kanban panosu: isleri duruma gore gruplayip sirali dondurur. */
export async function board(user: AuthUser, query: ListTasksQuery) {
  const scope = await taskScope(user);
  const tasks = await prisma.task.findMany({
    where: { AND: [scope, buildFilters(query), { status: { notIn: ['CANCELLED'] } }] },
    select: listSelect,
    orderBy: [{ position: 'asc' }, { dueDate: 'asc' }],
    take: 500,
  });

  const columns: TaskStatus[] = [
    'BACKLOG',
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'REVISION',
    'WAITING_CUSTOMER',
    'DONE',
  ];

  return columns.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }));
}

export async function getById(user: AuthUser, id: string) {
  await assertTaskAccess(user, id);

  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, companyName: true, slug: true, logoUrl: true } },
      project: { select: { id: true, name: true, color: true } },
      service: { select: { id: true, serviceType: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      assignee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          employeeProfile: { select: { jobTitle: { select: { name: true } } } },
        },
      },
      reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      checklist: { orderBy: { position: 'asc' } },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
      },
      comments: {
        where: commentVisibility(user),
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } } },
      },
      timeLogs: {
        orderBy: { workDate: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
      watchers: { select: { userId: true } },
      // Musteri ic hareketleri gormemeli
      activities:
        user.role === 'CUSTOMER'
          ? false
          : {
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: { actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
            },
    },
  });

  if (!task) throw notFound('Is bulunamadi');

  const loggedMinutes = task.timeLogs.reduce((sum, l) => sum + l.minutes, 0);

  return {
    ...task,
    loggedHours: Math.round((loggedMinutes / 60) * 10) / 10,
    remainingHours:
      task.estimatedHours != null
        ? Math.round((task.estimatedHours - loggedMinutes / 60) * 10) / 10
        : null,
  };
}

// ---------------------------------------------------------------------------
// Olusturma / guncelleme
// ---------------------------------------------------------------------------

export async function create(user: AuthUser, input: CreateTaskInput) {
  const customer = await assertCustomerAccess(user, input.customerId);

  if (input.assigneeId) await assertAssignable(input.customerId, input.assigneeId);

  const task = await prisma.$transaction(async (tx) => {
    const code = await nextTaskCode(tx, input.customerId, customer.companyName);

    const created = await tx.task.create({
      data: {
        code,
        title: input.title,
        description: input.description ?? null,
        customerId: input.customerId,
        projectId: input.projectId ?? null,
        serviceId: input.serviceId ?? null,
        createdById: user.id,
        assigneeId: input.assigneeId ?? null,
        reviewerId: input.reviewerId ?? null,
        status: input.status,
        priority: input.priority,
        estimatedHours: input.estimatedHours ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        isBillable: input.isBillable,
        isVisibleToCustomer: input.isVisibleToCustomer,
        tags: input.tags,
        checklist: {
          create: input.checklist.map((title, index) => ({ title, position: index })),
        },
      },
      select: listSelect,
    });

    await logActivity(tx, created.id, user.id, ActivityType.CREATED, { title: input.title });
    if (input.assigneeId) {
      await logActivity(tx, created.id, user.id, ActivityType.ASSIGNED, { to: input.assigneeId });
    }

    return created;
  });

  if (input.assigneeId) {
    await notify({
      userIds: [input.assigneeId],
      exceptUserId: user.id,
      type: 'TASK_ASSIGNED',
      title: `Yeni is atandi: ${task.code}`,
      body: `${customer.companyName} - ${task.title}`,
      link: `/tasks/${task.id}`,
    });
  }

  return task;
}

/** Atanacak kisi musterinin kadrosunda mi? Degilse operasyonel karisiklik olur. */
async function assertAssignable(customerId: string, assigneeId: string) {
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, deletedAt: null, role: { in: ['EMPLOYEE', 'ADMIN'] } },
    select: { id: true, role: true },
  });
  if (!assignee) throw badRequest('Is yalnizca calisan veya yoneticiye atanabilir');

  if (assignee.role === 'ADMIN') return;

  const inTeam = await prisma.customerTeamSeat.count({ where: { customerId, userId: assigneeId } });
  if (inTeam === 0) {
    throw badRequest('Bu kisi musterinin kadrosunda degil. Once musteri ekibine ekleyin.');
  }
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Baslik',
  description: 'Aciklama',
  priority: 'Oncelik',
  dueDate: 'Termin',
  startDate: 'Baslangic',
  estimatedHours: 'Tahmini sure',
  reviewerId: 'Onaylayan',
  projectId: 'Proje',
  serviceId: 'Hizmet',
};

export async function update(user: AuthUser, id: string, input: UpdateTaskInput) {
  const current = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      customerId: true,
      assigneeId: true,
      reviewerId: true,
      createdById: true,
      startedAt: true,
      watchers: { select: { userId: true } },
    },
  });
  if (!current) throw notFound('Is bulunamadi');

  await assertTaskAccess(user, id);
  assertCanEdit(user, current);

  if (input.assigneeId) await assertAssignable(current.customerId, input.assigneeId);

  const data: Prisma.TaskUpdateInput = { ...(input as Prisma.TaskUpdateInput) };
  const statusChanged = input.status && input.status !== current.status;

  if (statusChanged) {
    if (input.status === 'IN_PROGRESS' && !current.startedAt) data.startedAt = new Date();
    if (input.status === 'DONE') data.completedAt = new Date();
    if (input.status !== 'DONE' && current.status === 'DONE') data.completedAt = null;
    if (input.status === 'REVISION') data.revisionCount = { increment: 1 };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const task = await tx.task.update({ where: { id }, data, select: listSelect });

    if (statusChanged) {
      await logActivity(
        tx,
        id,
        user.id,
        input.status === 'DONE'
          ? ActivityType.COMPLETED
          : input.status === 'REVISION'
            ? ActivityType.REVISION_REQUESTED
            : current.status === 'DONE'
              ? ActivityType.REOPENED
              : ActivityType.STATUS_CHANGED,
        { from: current.status, to: input.status },
      );
    }

    if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
      await logActivity(tx, id, user.id, ActivityType.ASSIGNED, {
        from: current.assigneeId,
        to: input.assigneeId,
      });
    }

    if (input.priority && input.priority !== current.priority) {
      await logActivity(tx, id, user.id, ActivityType.PRIORITY_CHANGED, {
        from: current.priority,
        to: input.priority,
      });
    }

    const changedFields = Object.keys(input).filter(
      (k) => k in FIELD_LABELS && k !== 'priority' && k !== 'status',
    );
    if (changedFields.length > 0) {
      await logActivity(tx, id, user.id, ActivityType.UPDATED, {
        fields: changedFields.map((f) => FIELD_LABELS[f] ?? f),
      });
    }

    return task;
  });

  const watchers = current.watchers.map((w) => w.userId);

  if (statusChanged) {
    await notify({
      userIds: [current.assigneeId, current.reviewerId, current.createdById, ...watchers],
      exceptUserId: user.id,
      type: input.status === 'REVISION' ? 'REVISION_REQUESTED' : 'TASK_STATUS_CHANGED',
      title: `${current.code} durumu degisti`,
      body: `${current.title}: ${current.status} -> ${input.status}`,
      link: `/tasks/${id}`,
    });
  }

  if (input.assigneeId && input.assigneeId !== current.assigneeId) {
    await notify({
      userIds: [input.assigneeId],
      exceptUserId: user.id,
      type: 'TASK_ASSIGNED',
      title: `Yeni is atandi: ${current.code}`,
      body: current.title,
      link: `/tasks/${id}`,
    });
  }

  return updated;
}

/**
 * Duzenleme kurallari:
 * - TASK_UPDATE yetkisi olan admin her isi duzenler
 * - Calisan yalnizca kendisine atanan / onayladigi / actigi isi duzenler
 * - Musteri isi duzenleyemez (yalnizca yorum yazar, onay verir)
 */
function assertCanEdit(
  user: AuthUser,
  task: { assigneeId: string | null; reviewerId: string | null; createdById: string },
) {
  if (user.role === 'CUSTOMER') throw forbidden('Musteri hesabi is kaydini duzenleyemez');
  if (user.permissions.includes(PERMISSIONS.TASK_ASSIGN)) return;
  const involved = [task.assigneeId, task.reviewerId, task.createdById].includes(user.id);
  if (!involved) throw forbidden('Yalnizca size atanan isleri duzenleyebilirsiniz');
}

export async function assign(user: AuthUser, id: string, assigneeId: string | null) {
  return update(user, id, { assigneeId });
}

/** Kanban surukle-birak: durum + sutun ici sira */
export async function move(user: AuthUser, id: string, status: TaskStatus, position: number) {
  await assertTaskAccess(user, id);
  await update(user, id, { status });
  return prisma.task.update({ where: { id }, data: { position }, select: listSelect });
}

export async function softDelete(user: AuthUser, id: string) {
  await assertTaskAccess(user, id);
  if (!user.permissions.includes(PERMISSIONS.TASK_DELETE)) {
    throw forbidden('Is silme yetkiniz yok');
  }
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Yorum / zaman / kontrol listesi
// ---------------------------------------------------------------------------

export async function addComment(user: AuthUser, taskId: string, body: string, isInternal: boolean) {
  const task = await assertTaskAccess(user, taskId);

  // Musteri ic yazisma acamaz.
  const internal = user.role === 'CUSTOMER' ? false : isInternal;

  const [comment] = await prisma.$transaction([
    prisma.taskComment.create({
      data: { taskId, authorId: user.id, body, isInternal: internal },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } } },
    }),
    prisma.taskActivity.create({
      data: { taskId, actorId: user.id, type: ActivityType.COMMENTED },
    }),
  ]);

  const watchers = await prisma.taskWatcher.findMany({ where: { taskId }, select: { userId: true } });

  await notify({
    userIds: [task.assigneeId, task.reviewerId, task.createdById, ...watchers.map((w) => w.userId)],
    exceptUserId: user.id,
    type: 'TASK_COMMENTED',
    title: 'Yeni yorum',
    body: body.slice(0, 120),
    link: `/tasks/${taskId}`,
  });

  return comment;
}

export async function addTimeLog(
  user: AuthUser,
  taskId: string,
  input: { minutes: number; workDate: Date; note?: string | null; isBillable: boolean },
) {
  await assertTaskAccess(user, taskId);
  if (user.role === 'CUSTOMER') throw forbidden('Musteri hesabi sure girisi yapamaz');

  const [log] = await prisma.$transaction([
    prisma.timeLog.create({
      data: {
        taskId,
        userId: user.id,
        minutes: input.minutes,
        workDate: input.workDate,
        note: input.note ?? null,
        isBillable: input.isBillable,
      },
    }),
    prisma.taskActivity.create({
      data: { taskId, actorId: user.id, type: ActivityType.TIME_LOGGED, meta: { minutes: input.minutes } },
    }),
  ]);

  return log;
}

export async function addChecklistItem(user: AuthUser, taskId: string, title: string) {
  await assertTaskAccess(user, taskId);
  const count = await prisma.taskChecklistItem.count({ where: { taskId } });
  return prisma.taskChecklistItem.create({ data: { taskId, title, position: count } });
}

export async function updateChecklistItem(
  user: AuthUser,
  taskId: string,
  itemId: string,
  data: { title?: string; isDone?: boolean },
) {
  await assertTaskAccess(user, taskId);
  return prisma.taskChecklistItem.update({ where: { id: itemId }, data });
}

export async function removeChecklistItem(user: AuthUser, taskId: string, itemId: string) {
  await assertTaskAccess(user, taskId);
  await prisma.taskChecklistItem.delete({ where: { id: itemId } });
}

export async function toggleWatch(user: AuthUser, taskId: string) {
  await assertTaskAccess(user, taskId);
  const existing = await prisma.taskWatcher.findUnique({
    where: { taskId_userId: { taskId, userId: user.id } },
  });
  if (existing) {
    await prisma.taskWatcher.delete({ where: { id: existing.id } });
    return { watching: false };
  }
  await prisma.taskWatcher.create({ data: { taskId, userId: user.id } });
  return { watching: true };
}

export type TaskListItem = Prisma.TaskGetPayload<{ select: typeof listSelect }>;
export type { Task };
