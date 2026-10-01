import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessBody<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Wraps every successful controller return value in { success, data } so the
 * response envelope is consistent across the whole API — errors get the same
 * shape (success:false) from AllExceptionsFilter.
 */
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<
  T,
  SuccessBody<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessBody<T>> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
