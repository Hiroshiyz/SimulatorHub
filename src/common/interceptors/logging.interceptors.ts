import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { error } from "console";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("OCPI-Logger");
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const { method, url, headers, body } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((resData) => {
        const time = Date.now() - startTime;
        const response = httpContext.getResponse();
        const statusCode = response.statusCode;
        this.logger.log(
          `[HTTP SUCCESS]${method} ${url} Status: ${statusCode} - ${time}ms` +
            `\nRequest Headers: ${JSON.stringify(this.sanitizeHeaders(headers))}` +
            `\n Request Body: ${JSON.stringify(body || {})}` +
            `\n Response Body: ${JSON.stringify(resData || {})}`,
        );
      }),
      catchError((err) => {
        const time = Date.now() - startTime;
        const statusCode = err.statusCode;
        const message = err.message || err;
        this.logger.error(
          `[HTTP ERROR]${method} ${url} Status: ${statusCode} - ${time}ms` +
            `\nRequest Headers: ${JSON.stringify(
              this.sanitizeHeaders(headers),
            )}` +
            `\n Request Body: ${JSON.stringify(body || {})}` +
            `\n Error Message: ${message}`,
        );
        return throwError(() => err);
      }),
    );
  }
  private sanitizeHeaders(headers: any) {
    const sanitized = { ...headers };
    if (sanitized["authorization"]) {
      sanitized["authorization"] = "******************";
    }
    return {
      authorization: sanitized["authorization"],
      "ocpi-from-party-id": sanitized["ocpi-from-party-id"],
      "ocpi-from-country-code": sanitized["ocpi-from-country-code"],
      "ocpi-to-party-id": sanitized["ocpi-to-party-id"],
      "ocpi-to-country-code": sanitized["ocpi-to-country-code"],
    };
  }
}
