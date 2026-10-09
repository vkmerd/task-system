import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} bulunamadi` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'alan';
      res.status(409).json({
        error: { code: 'CONFLICT', message: `Bu ${target} degeri zaten kayitli` },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kayit bulunamadi' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({
        error: { code: 'FK_CONSTRAINT', message: 'Iliskili kayit bulunamadi veya silinemiyor' },
      });
      return;
    }
  }

  console.error('[error]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Beklenmeyen bir hata olustu',
      ...(isProd ? {} : { details: err instanceof Error ? err.message : String(err) }),
    },
  });
}
