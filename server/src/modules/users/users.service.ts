import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { resolvePermissions } from '../../config/permissions.js';
import type { AuthUser } from '../../types/express.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schemas.js';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  adminType: true,
  status: true,
  extraPermissions: true,
  deniedPermissions: true,
  lastLoginAt: true,
  createdAt: true,
  employeeProfile: {
    select: {
      id: true,
      employeeCode: true,
      weeklyCapacityHours: true,
      workMode: true,
      hourlyCost: true,
      hireDate: true,
      skills: true,
      bio: true,
      jobTitle: { select: { id: true, name: true, level: true } },
      department: { select: { id: true, name: true, color: true } },
    },
  },
  customerContact: {
    select: {
      id: true,
      position: true,
      isPrimary: true,
      customer: { select: { id: true, companyName: true, slug: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function present(user: UserRow) {
  return {
    ...user,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    permissions: resolvePermissions(user),
  };
}

export async function list(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role && { role: query.role }),
    ...(query.status && { status: query.status }),
    ...(query.departmentId && { employeeProfile: { departmentId: query.departmentId } }),
    ...(query.jobTitleId && { employeeProfile: { jobTitleId: query.jobTitleId } }),
    ...(query.search && {
      OR: [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: items.map(present), total, page: query.page, pageSize: query.pageSize };
}

export async function getById(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: userSelect });
  if (!user) throw notFound('Kullanici bulunamadi');
  return present(user);
}

export async function create(input: CreateUserInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw conflict('Bu e-posta adresi zaten kayitli');

  if (input.role === 'EMPLOYEE' && input.employeeProfile) {
    const title = await prisma.jobTitle.findUnique({
      where: { id: input.employeeProfile.jobTitleId },
      select: { departmentId: true },
    });
    if (!title) throw badRequest('Secilen unvan bulunamadi');
    if (title.departmentId !== input.employeeProfile.departmentId) {
      throw badRequest('Secilen unvan bu departmana ait degil');
    }
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: input.role,
      adminType: input.role === 'ADMIN' ? (input.adminType ?? null) : null,
      status: input.status,
      extraPermissions: input.extraPermissions,
      deniedPermissions: input.deniedPermissions,
      ...(input.role === 'EMPLOYEE' &&
        input.employeeProfile && {
          employeeProfile: {
            create: {
              jobTitleId: input.employeeProfile.jobTitleId,
              departmentId: input.employeeProfile.departmentId,
              employeeCode: input.employeeProfile.employeeCode ?? null,
              weeklyCapacityHours: input.employeeProfile.weeklyCapacityHours,
              workMode: input.employeeProfile.workMode,
              hourlyCost: input.employeeProfile.hourlyCost,
              hireDate: input.employeeProfile.hireDate ?? null,
              skills: input.employeeProfile.skills,
              bio: input.employeeProfile.bio ?? null,
            },
          },
        }),
      ...(input.role === 'CUSTOMER' &&
        input.customerId && {
          customerContact: {
            create: {
              customerId: input.customerId,
              fullName: `${input.firstName} ${input.lastName}`.trim(),
              email: input.email,
              phone: input.phone ?? null,
              position: input.position ?? null,
            },
          },
        }),
    },
    select: userSelect,
  });

  return present(user);
}

export async function update(actor: AuthUser, id: string, input: UpdateUserInput) {
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, adminType: true, employeeProfile: { select: { id: true } } },
  });
  if (!target) throw notFound('Kullanici bulunamadi');

  // Admin yetkilerini yalnizca SUPER_ADMIN degistirebilir.
  const touchesPrivileges =
    input.adminType !== undefined ||
    input.extraPermissions !== undefined ||
    input.deniedPermissions !== undefined;
  if (touchesPrivileges && actor.adminType !== 'SUPER_ADMIN') {
    throw forbidden('Yetki ve admin tipi degisikligini yalnizca sistem yoneticisi yapabilir');
  }

  const { employeeProfile, ...rest } = input;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.adminType !== undefined && target.role !== 'ADMIN' && { adminType: null }),
      ...(employeeProfile &&
        target.employeeProfile && {
          employeeProfile: { update: employeeProfile },
        }),
    },
    select: userSelect,
  });

  return present(user);
}

export async function softDelete(actor: AuthUser, id: string) {
  if (actor.id === id) throw badRequest('Kendi hesabinizi silemezsiniz');

  const openTasks = await prisma.task.count({
    where: { assigneeId: id, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } },
  });
  if (openTasks > 0) {
    throw badRequest(`Bu kullanicinin ${openTasks} adet acik isi var. Once bu isleri devredin.`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'SUSPENDED' },
    }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function resetPassword(id: string, newPassword: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

/**
 * Ekip doluluk tablosu: her calisanin acik is sayisi, tahmini saati ve
 * haftalik kapasitesine gore doluluk yuzdesi.
 * "Kime is verebilirim?" sorusunun cevabi budur.
 */
export async function workload() {
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', deletedAt: null, status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      employeeProfile: {
        select: {
          weeklyCapacityHours: true,
          jobTitle: { select: { name: true } },
          department: { select: { name: true, color: true } },
        },
      },
    },
    orderBy: { firstName: 'asc' },
  });

  const openTasks = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: { deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] }, assigneeId: { not: null } },
    _count: { _all: true },
    _sum: { estimatedHours: true },
  });

  const overdue = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: {
      deletedAt: null,
      status: { notIn: ['DONE', 'CANCELLED'] },
      dueDate: { lt: new Date() },
      assigneeId: { not: null },
    },
    _count: { _all: true },
  });

  const openMap = new Map(openTasks.map((t) => [t.assigneeId, t]));
  const overdueMap = new Map(overdue.map((t) => [t.assigneeId, t._count._all]));

  return employees.map((e) => {
    const open = openMap.get(e.id);
    const capacity = e.employeeProfile?.weeklyCapacityHours ?? 40;
    const plannedHours = open?._sum.estimatedHours ?? 0;
    return {
      id: e.id,
      fullName: `${e.firstName} ${e.lastName}`.trim(),
      avatarUrl: e.avatarUrl,
      jobTitle: e.employeeProfile?.jobTitle.name ?? '-',
      department: e.employeeProfile?.department.name ?? '-',
      departmentColor: e.employeeProfile?.department.color ?? '#90a4ae',
      weeklyCapacityHours: capacity,
      openTaskCount: open?._count._all ?? 0,
      overdueTaskCount: overdueMap.get(e.id) ?? 0,
      plannedHours,
      utilization: capacity > 0 ? Math.round((plannedHours / capacity) * 100) : 0,
    };
  });
}
