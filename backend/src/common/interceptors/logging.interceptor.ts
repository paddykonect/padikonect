import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<
      Request & { id?: string; user?: { id?: string } }
    >();
    const response = httpContext.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, start),
        error: () => this.log(request, response, start),
      }),
    );
  }

  private log(
    request: Request & { id?: string; user?: { id?: string } },
    response: Response,
    start: number,
  ) {
    const duration = Date.now() - start;
    this.logger.log(
      `[${request.id ?? '-'}] ${request.method} ${request.originalUrl} ${response.statusCode} ${duration}ms user=${request.user?.id ?? 'anonymous'}`,
    );
  }
}
