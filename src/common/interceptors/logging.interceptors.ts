import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("OCPI-Logger");
  private readonly isProduction = process.env.NODE_ENV === "production";

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
        
        if (this.isProduction) {
          this.logger.log(
            `[HTTP SUCCESS] ${method} ${url} Status: ${statusCode} - ${time}ms`,
          );
        } else {
          this.logger.log(
            `[HTTP SUCCESS] ${method} ${url} Status: ${statusCode} - ${time}ms` +
              `\nRequest Headers: ${JSON.stringify(this.sanitizeHeaders(headers))}` +
              `\n Request Body: ${JSON.stringify(body || {})}` +
              `\n Response Body: ${JSON.stringify(resData || {})}`,
          );
        }
      }),
      catchError((err) => {
        const time = Date.now() - startTime;
        const statusCode = err.status || err.statusCode || 500;
        const message = err.message || err;
        
        if (this.isProduction) {
          this.logger.error(
            `[HTTP ERROR] ${method} ${url} Status: ${statusCode} - ${time}ms` +
              `\n Error Message: ${message}`,
          );
        } else {
          this.logger.error(
            `[HTTP ERROR] ${method} ${url} Status: ${statusCode} - ${time}ms` +
              `\nRequest Headers: ${JSON.stringify(
                this.sanitizeHeaders(headers),
              )}` +
              `\n Request Body: ${JSON.stringify(body || {})}` +
              `\n Error Message: ${message}`,
          );
        }
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
