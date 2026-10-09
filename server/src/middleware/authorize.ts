import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { Permission } from '../config/permissions.js';

/** Verilen yetkilerden en az birine sahip olmayi sart kosar. */
export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    const ok = required.some((p) => req.user!.permissions.includes(p));
    if (!ok) return next(forbidden(`Gerekli yetki: ${required.join(' veya ')}`));
    next();
  };
}

/** Rol bazli kaba filtre (kapsam kontrolu servis katmaninda yapilir). */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
