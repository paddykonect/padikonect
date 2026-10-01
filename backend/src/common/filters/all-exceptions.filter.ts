import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

interface ErrorBody {
  success: false;
  message: string;
  code: string;
  params?: Record<string, unknown>;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { id?: string }).id;

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';
    let params: Record<string, unknown> | undefined;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      params = exception.params;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = Array.isArray(b.message)
          ? b.message.join(', ')
          : ((b.message as string) ?? message);
      }
      code = HttpStatus[status] ?? 'HTTP_ERROR';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_ENTRY';
        message = 'A record with this value already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'The requested resource was not found.';
      }
    }

    if (status >= 500) {
      // Never log request bodies here — may contain passwords/OTPs/tokens.
      this.logger.error(
        `[${requestId ?? 'no-request-id'}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      success: false,
      message,
      code,
      params,
      requestId,
    };
    response.status(status).json(body);
  }
}
