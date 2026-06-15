import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }

    // Parse format "Token <token>" or "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || (parts[0] !== "Token" && parts[0] !== "Bearer")) {
      throw new UnauthorizedException("Invalid Authorization header format");
    }

    const token = parts[1];

    //  Try to fetch validated party from Redis cache
    const cacheKey = `token:${token}`;
    try {
      const cachedParty = await this.redis.getClient().get(cacheKey);
      if (cachedParty) {
        request.party = JSON.parse(cachedParty);
        return true;
      }
    } catch (err) {
      // Log and fall back to database if Redis fails
      console.error("Redis read error in ApiKeyGuard:", err);
    }

    //  Query Postgres via Prisma on cache miss
    const credential = await this.prisma.credential.findFirst({
      where: {
        OR: [{ tokenA: token }, { tokenB: token }, { tokenC: token }],
      },
      include: {
        party: true,
      },
    });

    if (!credential) {
      throw new UnauthorizedException("Invalid OCPI credentials");
    }

    const partyContext = {
      id: credential.party.id,
      countryCode: credential.party.countryCode,
      partyId: credential.party.partyId,
      role: credential.party.role,
      name: credential.party.name || undefined,
    };

    //  Cache the validated party in Redis (TTL: 1 hour)
    try {
      await this.redis
        .getClient()
        .setex(cacheKey, 3600, JSON.stringify(partyContext));
    } catch (err) {
      console.error("Redis write error in ApiKeyGuard:", err);
    }

    request.party = partyContext;
    return true;
  }
}
