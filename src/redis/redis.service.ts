import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisClient: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.logger.log(`Connecting to Redis at: ${redisUrl}`);
    this.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
    });

    this.redisClient.on("error", (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  getClient(): Redis {
    return this.redisClient;
  }

  async onModuleDestroy() {
    this.logger.log("Disconnecting from Redis...");
    await this.redisClient.quit();
  }

  /**
   * Sliding Window Rate Limiting using Redis ZSET (Sorted Set)
   * Prevents race conditions under concurrent requests.
   *
   * @param key The Redis key tracking rate limits (e.g. rate_limit:ip:127.0.0.1 or rate_limit:party:TW:NPT)
   * @param limit The maximum number of requests allowed in the window
   * @param ttlSeconds The sliding window duration in seconds
   * @returns boolean True if the request is rate-limited, false otherwise
   */
  async isRateLimited(
    key: string,
    limit: number,
    ttlSeconds: number,
  ): Promise<boolean> {
    const now = Date.now();
    const clearBefore = now - ttlSeconds * 1000;

    // Use Redis Transaction to ensure atomic sliding window operations
    const multi = this.redisClient.multi();

    //  Remove timestamps older than the sliding window
    multi.zremrangebyscore(key, 0, clearBefore);
    //  Add current request timestamp
    multi.zadd(key, now, `${now}-${Math.random()}`);
    //  Count total requests in the window
    multi.zcard(key);
    //  Update TTL on the rate limit key
    multi.expire(key, ttlSeconds);

    const results = await multi.exec();
    if (!results) {
      this.logger.warn(`Redis transaction exec returned null for key: ${key}`);
      return false;
    }

    // ZCARD is the 3rd command in multi (index 2)
    // In ioredis, multi.exec() returns an array of [error, result] pairs
    const zcardResult = results[2];
    if (zcardResult && zcardResult[0] === null) {
      const count = zcardResult[1] as number;
      return count > limit;
    }

    return false;
  }
}
