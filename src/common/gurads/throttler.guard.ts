import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

interface RateLimitRecord {
  timestamps: number[];
}

@Injectable()
export class ThrottlerGuard implements CanActivate {
  // Store request timestamps per IP: Map<ip, RateLimitRecord>
  private clients = new Map<string, RateLimitRecord>();

  // Limit: max 30 requests per 60 seconds (1 minute)
  private readonly ttl = 60 * 1000; // time-to-live in ms
  private readonly limit = 30;     // max requests within TTL

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Get client IP address (handling proxies if configured)
    const ip = 
      request.ip || 
      request.headers["x-forwarded-for"] || 
      "unknown";

    const now = Date.now();
    let record = this.clients.get(ip);

    if (!record) {
      record = { timestamps: [] };
      this.clients.set(ip, record);
    }

    // Clean up timestamps older than the TTL window
    record.timestamps = record.timestamps.filter(
      (timestamp) => now - timestamp < this.ttl,
    );

    if (record.timestamps.length >= this.limit) {
      throw new HttpException(
        "Too Many Requests - Rate limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Record the current request timestamp
    record.timestamps.push(now);
    return true;
  }
}
