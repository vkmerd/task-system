import type { NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

interface NotifyInput {
  userIds: (string | null | undefined)[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** Bu kullaniciya bildirim gonderilmez (islemi yapan kisi) */
  exceptUserId?: string;
}

/** Bildirim yazar. Hata durumunda asil islemi dusurmez, sadece loglar. */
export async function notify({ userIds, type, title, body, link, exceptUserId }: NotifyInput) {
  const targets = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== exceptUserId))];
  if (targets.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: targets.map((userId) => ({ userId, type, title, body, link })),
    });
  } catch (err) {
    console.error('[notification] yazilamadi:', err);
  }
}

export async function list(userId: string, onlyUnread = false) {
  return prisma.notification.findMany({
    where: { userId, ...(onlyUnread && { readAt: null }) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
