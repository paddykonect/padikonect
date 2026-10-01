import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    req.id =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  }
}
