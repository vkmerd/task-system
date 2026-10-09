import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { assertCustomerAccess, customerScope } from '../../lib/scope.js';
import type { AuthUser } from '../../types/express.js';
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  TeamSeatInput,
  UpdateCustomerInput,
} from './customers.schemas.js';

function slugify(value: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
  return value
    .toLowerCase()
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || 'musteri';
  let candidate = root;
  let n = 1;
  while (await prisma.customer.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${++n}`;
  }
  return candidate;
}

/** Is kodu on eki: "Acme Dijital" -> "ACME" */
function codePrefix(name: string): string {
  const cleaned = slugify(name).replace(/-/g, '').toUpperCase();
  return (cleaned.slice(0, 4) || 'MUST').padEnd(3, 'X');
}

export async function list(user: AuthUser, query: ListCustomersQuery) {
  const scope = await customerScope(user);
  const where: Prisma.CustomerWhereInput = {
    AND: [
      scope,
      {
        ...(query.status && { status: query.status }),
        ...(query.accountManagerId && { accountManagerId: query.accountManagerId }),
        ...(query.serviceType && { services: { some: { serviceType: query.serviceType, isActive: true } } }),
        ...(query.search && {
          OR: [
            { companyName: { contains: query.search, mode: 'insensitive' } },
            { legalName: { contains: query.search, mode: 'insensitive' } },
            { sector: { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      },
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ status: 'asc' }, { companyName: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        accountManager: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        services: { where: { isActive: true }, select: { serviceType: true } },
        _count: { select: { team: true, contacts: true, projects: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  // Acik / geciken is sayilarini tek sorguda topla
  const ids = rows.map((r) => r.id);
  const [open, overdue] = await Promise.all([
    prisma.task.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: ids },
        deletedAt: null,
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { lt: new Date() },
      },
      _count: { _all: true },
    }),
  ]);

  const openMap = new Map(open.map((o) => [o.customerId, o._count._all]));
  const overdueMap = new Map(overdue.map((o) => [o.customerId, o._count._all]));

  return {
    items: rows.map((c) => ({
      ...c,
      serviceTypes: c.services.map((s) => s.serviceType),
      openTaskCount: openMap.get(c.id) ?? 0,
      overdueTaskCount: overdueMap.get(c.id) ?? 0,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getById(user: AuthUser, id: string) {
  await assertCustomerAccess(user, id);

  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      accountManager: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      services: { orderBy: { serviceType: 'asc' } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] },
      team: {
        orderBy: [{ isLead: 'desc' }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              employeeProfile: {
                select: {
                  jobTitle: { select: { name: true } },
                  department: { select: { name: true, color: true } },
                },
              },
            },
          },
        },
      },
      projects: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!customer) throw notFound('Musteri bulunamadi');

  const statusCounts = await prisma.task.groupBy({
    by: ['status'],
    where: { customerId: id, deletedAt: null },
    _count: { _all: true },
  });

  const loggedMinutes = await prisma.timeLog.aggregate({
    where: { task: { customerId: id } },
    _sum: { minutes: true },
  });

  return {
    ...customer,
    stats: {
      tasksByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
      totalTasks: statusCounts.reduce((sum, s) => sum + s._count._all, 0),
      loggedHours: Math.round(((loggedMinutes._sum.minutes ?? 0) / 60) * 10) / 10,
    },
  };
}

export async function create(input: CreateCustomerInput) {
  const slug = await uniqueSlug(input.companyName);

  const customer = await prisma.customer.create({
    data: { ...input, slug },
  });

  await prisma.taskCounter.create({
    data: { customerId: customer.id, prefix: codePrefix(input.companyName) },
  });

  return customer;
}

export async function update(user: AuthUser, id: string, input: UpdateCustomerInput) {
  await assertCustomerAccess(user, id);
  return prisma.customer.update({ where: { id }, data: input });
}

export async function softDelete(id: string) {
  const openTasks = await prisma.task.count({
    where: { customerId: id, deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } },
  });
  if (openTasks > 0) throw badRequest(`Musterinin ${openTasks} acik isi var, once bunlari kapatin`);

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'CHURNED' },
  });
}

// --- Hizmet kalemleri -------------------------------------------------------

export async function upsertService(
  user: AuthUser,
  customerId: string,
  input: { serviceType: Prisma.CustomerServiceCreateInput['serviceType'] } & Record<string, unknown>,
) {
  await assertCustomerAccess(user, customerId);
  const { serviceType, ...rest } = input;
  return prisma.customerService.upsert({
    where: { customerId_serviceType: { customerId, serviceType } },
    create: { customerId, serviceType, ...rest },
    update: rest,
  });
}

export async function removeService(user: AuthUser, customerId: string, serviceId: string) {
  await assertCustomerAccess(user, customerId);
  const used = await prisma.task.count({ where: { serviceId, deletedAt: null } });
  if (used > 0) throw badRequest(`Bu hizmete bagli ${used} is var, once onlari tasiyin`);
  await prisma.customerService.delete({ where: { id: serviceId } });
}

// --- Kadro (is dagilimi) ----------------------------------------------------

export async function addTeamSeat(user: AuthUser, customerId: string, input: TeamSeatInput) {
  await assertCustomerAccess(user, customerId);

  const employee = await prisma.user.findFirst({
    where: { id: input.userId, deletedAt: null, role: { in: ['EMPLOYEE', 'ADMIN'] } },
    select: { id: true },
  });
  if (!employee) throw badRequest('Secilen kisi calisan olarak bulunamadi');

  return prisma.customerTeamSeat.create({
    data: {
      customerId,
      userId: input.userId,
      service: input.service ?? null,
      allocatedHours: input.allocatedHours,
      isLead: input.isLead,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          employeeProfile: { select: { jobTitle: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function updateTeamSeat(user: AuthUser, customerId: string, seatId: string, data: Partial<TeamSeatInput>) {
  await assertCustomerAccess(user, customerId);
  return prisma.customerTeamSeat.update({ where: { id: seatId }, data });
}

export async function removeTeamSeat(user: AuthUser, customerId: string, seatId: string) {
  await assertCustomerAccess(user, customerId);
  await prisma.customerTeamSeat.delete({ where: { id: seatId } });
}

// --- Musteri tarafi kisiler -------------------------------------------------

export async function addContact(user: AuthUser, customerId: string, data: Record<string, unknown>) {
  await assertCustomerAccess(user, customerId);
  return prisma.customerContact.create({
    data: { ...(data as Prisma.CustomerContactUncheckedCreateInput), customerId },
  });
}

export async function updateContact(user: AuthUser, customerId: string, contactId: string, data: Record<string, unknown>) {
  await assertCustomerAccess(user, customerId);
  return prisma.customerContact.update({ where: { id: contactId }, data: data as never });
}

export async function removeContact(user: AuthUser, customerId: string, contactId: string) {
  await assertCustomerAccess(user, customerId);
  await prisma.customerContact.delete({ where: { id: contactId } });
}
