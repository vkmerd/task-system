export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg = 'Gecersiz istek', details?: unknown) =>
  new AppError(400, msg, 'BAD_REQUEST', details);

export const unauthorized = (msg = 'Oturum acmaniz gerekiyor') =>
  new AppError(401, msg, 'UNAUTHORIZED');

export const forbidden = (msg = 'Bu islem icin yetkiniz yok') =>
  new AppError(403, msg, 'FORBIDDEN');

export const notFound = (msg = 'Kayit bulunamadi') => new AppError(404, msg, 'NOT_FOUND');

export const conflict = (msg = 'Kayit zaten mevcut') => new AppError(409, msg, 'CONFLICT');
