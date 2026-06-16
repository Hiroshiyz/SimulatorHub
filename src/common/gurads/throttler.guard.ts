import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class ThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(ThrottlerGuard.name);

  // Default limits for unauthenticated/simulator traffic
  private readonly defaultLimit = 30;
  private readonly defaultWindowSeconds = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Bypass rate limiting for local simulator API endpoints
    if (
      request.url &&
      (request.url.startsWith("/simulator") ||
        request.url.startsWith("simulator"))
    ) {
      return true;
    }

    // Get client IP address (handling proxies if configured)
    const ip = request.ip || request.headers["x-forwarded-for"] || "unknown";

    let key = `rate_limit:ip:${ip}`;
    let limit = this.defaultLimit;
    let windowSeconds = this.defaultWindowSeconds;

    // Check if the request carries a valid registered tenant token
    const authHeader = request.headers["authorization"];
    if (authHeader) {
      const parts = authHeader.split(" ");
      if (
        parts.length === 2 &&
        (parts[0] === "Token" || parts[0] === "Bearer")
      ) {
        const token = parts[1];
        const cacheKey = `token:${token}`;

        let partyContext = null;
        try {
          const cached = await this.redis.getClient().get(cacheKey);
          if (cached) {
            partyContext = JSON.parse(cached);
          } else {
            const credential = await this.prisma.credential.findFirst({
              where: {
                OR: [{ tokenA: token }, { tokenB: token }, { tokenC: token }],
              },
              include: {
                party: true,
              },
            });
            if (credential) {
              partyContext = {
                id: credential.party.id,
                countryCode: credential.party.countryCode,
                partyId: credential.party.partyId,
                role: credential.party.role,
                name: credential.party.name || undefined,
                rateLimit: credential.party.rateLimit,
                rateLimitWindow: credential.party.rateLimitWindow,
              };
              // Cache validation result (TTL: 1 hour)
              await this.redis
                .getClient()
                .setex(cacheKey, 3600, JSON.stringify(partyContext));
            }
          }
        } catch (err) {
          this.logger.error(
            "Error reading/writing token cache in ThrottlerGuard",
            err,
          );
        }

        if (partyContext) {
          // If we found a registered tenant, rate limit by tenant identity
          key = `rate_limit:party:${partyContext.countryCode}:${partyContext.partyId}:${partyContext.role}`;
          limit = partyContext.rateLimit ?? 100;
          windowSeconds = partyContext.rateLimitWindow ?? 60;

          // Pre-populate request.party so ApiKeyGuard can reuse it without re-fetching
          request.party = partyContext;
        }
      }
    }

    // Perform atomic sliding window check in Redis
    try {
      const isLimited = await this.redis.isRateLimited(
        key,
        limit,
        windowSeconds,
      );
      if (isLimited) {
        this.logger.warn(
          `Rate limit exceeded for key: ${key} (Limit: ${limit}/${windowSeconds}s)`,
        );
        throw new HttpException(
          "Too Many Requests - Rate limit exceeded",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(
        `Failed to execute rate limit checks in Redis for key ${key}:`,
        err,
      );
    }

    return true;
  }
}
