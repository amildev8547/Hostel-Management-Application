import { NextFunction, Request, RequestHandler, Response } from 'express';

export function asyncHandler(handler: (req: any, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
