import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { PERMISSIONS } from '../config/permissions.js';
import { forbidden } from './errors.js';
import type { AuthUser } from '../types/express.js';

/**
 * Kapsam (scope) katmani: bir kullanicinin hangi musteri ve isleri gorebilecegini
 * Prisma "where" parcasi olarak uretir. Tum listeleme/okuma sorgulari bu
 * filtrelerden gecer, boylece yetki kontrolu tek yerde toplanir.
 */

/** Musteri rolundeki kullanicinin bagli oldugu musteri id'si */
export async function customerIdOfContact(userId: string): Promise<string | null> {
  const contact = await prisma.customerContact.findUnique({
    where: { userId },
    select: { customerId: true },
  });
  return contact?.customerId ?? null;
}

export async function customerScope(user: AuthUser): Promise<Prisma.CustomerWhereInput> {
  const base: Prisma.CustomerWhereInput = { deletedAt: null };

  if (user.permissions.includes(PERMISSIONS.CUSTOMER_READ_ALL)) return base;

  if (user.role === 'CUSTOMER') {
    const customerId = await customerIdOfContact(user.id);
    return { ...base, id: customerId ?? '__none__' };
  }

  // Calisan: kadrosunda oldugu veya temsilcisi oldugu musteriler
  return {
    ...base,
    OR: [{ team: { some: { userId: user.id } } }, { accountManagerId: user.id }],
  };
}

export async function taskScope(user: AuthUser): Promise<Prisma.TaskWhereInput> {
  const base: Prisma.TaskWhereInput = { deletedAt: null };

  if (user.permissions.includes(PERMISSIONS.TASK_READ_ALL)) return base;

  if (user.role === 'CUSTOMER') {
    const customerId = await customerIdOfContact(user.id);
    return {
      ...base,
      customerId: customerId ?? '__none__',
      isVisibleToCustomer: true,
    };
  }

  return {
    ...base,
    OR: [
      { assigneeId: user.id },
      { reviewerId: user.id },
      { createdById: user.id },
      { watchers: { some: { userId: user.id } } },
      { customer: { team: { some: { userId: user.id } } } },
      { customer: { accountManagerId: user.id } },
    ],
  };
}

/** Tek bir isi kapsam kontrolu ile getirir; erisim yoksa 403 firlatir. */
export async function assertTaskAccess(user: AuthUser, taskId: string) {
  const scope = await taskScope(user);
  const task = await prisma.task.findFirst({
    where: { AND: [{ id: taskId }, scope] },
    select: { id: true, customerId: true, assigneeId: true, reviewerId: true, createdById: true, status: true },
  });
  if (!task) throw forbidden('Bu ise erisim yetkiniz yok');
  return task;
}

export async function assertCustomerAccess(user: AuthUser, customerId: string) {
  const scope = await customerScope(user);
  const customer = await prisma.customer.findFirst({
    where: { AND: [{ id: customerId }, scope] },
    select: { id: true, companyName: true, slug: true },
  });
  if (!customer) throw forbidden('Bu musteriye erisim yetkiniz yok');
  return customer;
}

/** Ic yazismalar musteriye kapali; yorum filtresi. */
export function commentVisibility(user: AuthUser): Prisma.TaskCommentWhereInput {
  return user.role === 'CUSTOMER' ? { isInternal: false, deletedAt: null } : { deletedAt: null };
}
