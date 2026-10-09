import { prisma } from '../../lib/prisma.js';
import { badRequest, unauthorized } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiryDate,
  signAccessToken,
} from '../../lib/tokens.js';
import {
  ADMIN_DASHBOARDS,
  CUSTOMER_DASHBOARD,
  EMPLOYEE_DASHBOARD,
  resolvePermissions,
  type DashboardLayout,
} from '../../config/permissions.js';

const sessionUserSelect = {
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
  employeeProfile: {
    select: {
      id: true,
      weeklyCapacityHours: true,
      jobTitle: { select: { id: true, name: true, level: true } },
      department: { select: { id: true, name: true, color: true } },
    },
  },
  customerContact: {
    select: {
      id: true,
      position: true,
      customer: { select: { id: true, companyName: true, slug: true, logoUrl: true } },
    },
  },
} as const;

type SessionUser = Awaited<ReturnType<typeof findSessionUser>>;

async function findSessionUser(userId: string) {
  return prisma.user.findFirstOrThrow({
    where: { id: userId, deletedAt: null },
    select: sessionUserSelect,
  });
}

export function dashboardFor(user: {
  role: SessionUser['role'];
  adminType: SessionUser['adminType'];
}): DashboardLayout {
  if (user.role === 'ADMIN') return ADMIN_DASHBOARDS[user.adminType ?? 'OPERATIONS_ADMIN'];
  if (user.role === 'EMPLOYEE') return EMPLOYEE_DASHBOARD;
  return CUSTOMER_DASHBOARD;
}

/** Frontend'e gonderilen oturum gosterimi: kullanici + yetkiler + panel duzeni */
export function presentSession(user: SessionUser) {
  const { extraPermissions, deniedPermissions, ...rest } = user;
  return {
    user: {
      ...rest,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
    },
    permissions: resolvePermissions(user),
    dashboard: dashboardFor(user),
  };
}

export async function getSession(userId: string) {
  return presentSession(await findSessionUser(userId));
}

interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

async function issueTokens(userId: string, info: ClientInfo) {
  const user = await findSessionUser(userId);
  const permissions = resolvePermissions(user);

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    adminType: user.adminType,
    permissions,
  });

  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiryDate(),
      userAgent: info.userAgent?.slice(0, 255),
      ip: info.ip,
    },
  });

  return { accessToken, refreshToken, session: presentSession(user) };
}

/**
 * Var olmayan e-postalarda da gercek bir argon2 dogrulamasi calistirmak icin
 * kullanilan kukla hash. Boylece "kullanici var mi" bilgisi yanit suresinden
 * anlasilamaz.
 */
const dummyHash = hashPassword('bilinmeyen-kullanici-icin-kukla-parola');

export async function login(email: string, password: string, info: ClientInfo) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
    select: { id: true, passwordHash: true, status: true },
  });

  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);

  if (!user || !user.passwordHash || !ok) {
    throw unauthorized('E-posta veya sifre hatali');
  }
  if (user.status === 'SUSPENDED') {
    throw unauthorized('Hesabiniz askiya alinmis, yoneticinizle gorusun');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), status: user.status === 'INVITED' ? 'ACTIVE' : user.status },
  });

  return issueTokens(user.id, info);
}

/**
 * Refresh token rotasyonu: kullanilan token iptal edilir, yenisi uretilir.
 * Iptal edilmis bir token tekrar kullanilirsa hirsizlik varsayilip kullanicinin
 * tum oturumlari kapatilir.
 */
export async function refresh(token: string | undefined, info: ClientInfo) {
  if (!token) throw unauthorized('Oturum bulunamadi');

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });

  if (!stored) throw unauthorized('Oturum gecersiz');

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Guvenlik nedeniyle tum oturumlar kapatildi, tekrar giris yapin');
  }

  if (stored.expiresAt < new Date()) throw unauthorized('Oturum suresi doldu');

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(stored.userId, info);
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function logoutAll(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, current))) {
    throw badRequest('Mevcut sifreniz hatali');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next) },
  });

  // Sifre degisince diger cihazlardaki oturumlar dusurulur.
  await logoutAll(userId);
}
