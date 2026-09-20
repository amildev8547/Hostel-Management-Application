import { NextFunction, Request, Response } from 'express';

type Attempt = { count: number; resetAt: number };

export function rateLimit(windowMs: number, maxAttempts: number) {
  const attempts = new Map<string, Attempt>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`;
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= maxAttempts) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
    }
    current.count += 1;
    if (attempts.size > 5000) {
      for (const [storedKey, value] of attempts) if (value.resetAt <= now) attempts.delete(storedKey);
    }
    return next();
  };
}
