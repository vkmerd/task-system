import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { badRequest } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/** Zod semasi ile dogrular ve ayristirilmis degeri geri yazar. */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        // Express 5'te req.query getter-only; ayri bir alanda tasiyoruz.
        (req as Request & { validatedQuery?: unknown }).validatedQuery = parsed;
      } else {
        req[source] = parsed as never;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        return next(badRequest('Gonderilen veri gecersiz', details));
      }
      next(err);
    }
  };
}

/** validate(..., 'query') ile dogrulanmis query'yi tipli okumak icin yardimci. */
export function getQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}
