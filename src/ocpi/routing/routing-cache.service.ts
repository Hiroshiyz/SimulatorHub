import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class RoutingCacheService implements OnModuleInit {
  private readonly logger = new Logger(RoutingCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    await this.syncAllRulesToRedis();
  }

  private getRedisKey(cpoCountryCode: string, cpoPartyId: string): string {
    return `hub:routing:${cpoCountryCode.toUpperCase()}:${cpoPartyId.toUpperCase()}`;
  }

  private getRedisField(emspCountryCode: string, emspPartyId: string): string {
    return `${emspCountryCode.toUpperCase()}:${emspPartyId.toUpperCase()}`;
  }

  async syncRuleToRedis(rule: any): Promise<void> {
    const key = this.getRedisKey(rule.cpoCountryCode, rule.cpoPartyId);
    const field = this.getRedisField(rule.emspCountryCode, rule.emspPartyId);
    const value = JSON.stringify(rule);

    this.logger.log(`Syncing routing rule to Redis cache: Key=${key}, Field=${field}`);
    await this.redis.getClient().hset(key, field, value);
  }

  async deleteRuleFromRedis(
    cpoCountryCode: string,
    cpoPartyId: string,
    emspCountryCode: string,
    emspPartyId: string,
  ): Promise<void> {
    const key = this.getRedisKey(cpoCountryCode, cpoPartyId);
    const field = this.getRedisField(emspCountryCode, emspPartyId);

    this.logger.log(`Deleting routing rule from Redis cache: Key=${key}, Field=${field}`);
    await this.redis.getClient().hdel(key, field);
  }

  async syncAllRulesToRedis(): Promise<void> {
    this.logger.log("Syncing all database routing rules to Redis cache...");
    const rules = await this.prisma.hubRoutingRule.findMany();

    if (rules.length === 0) {
      this.logger.log("No routing rules found in database to sync.");
      return;
    }

    const cpoGroups: Record<string, Record<string, string>> = {};
    for (const rule of rules) {
      const key = this.getRedisKey(rule.cpoCountryCode, rule.cpoPartyId);
      const field = this.getRedisField(rule.emspCountryCode, rule.emspPartyId);
      if (!cpoGroups[key]) {
        cpoGroups[key] = {};
      }
      cpoGroups[key][field] = JSON.stringify(rule);
    }

    const pipeline = this.redis.getClient().pipeline();
    for (const [key, fields] of Object.entries(cpoGroups)) {
      pipeline.del(key);
      pipeline.hset(key, fields);
    }
    await pipeline.exec();
    this.logger.log("Finished syncing all routing rules to Redis cache.");
  }

  async getActiveRules(cpoCountryCode: string, cpoPartyId: string): Promise<any[]> {
    const key = this.getRedisKey(cpoCountryCode, cpoPartyId);

    // Fetch from Redis Hash
    const cachedData = await this.redis.getClient().hgetall(key);

    if (cachedData && Object.keys(cachedData).length > 0) {
      return Object.values(cachedData).map((val) => JSON.parse(val));
    }

    // Cache miss: query Database
    this.logger.log(`Cache miss for key ${key}. Querying database...`);
    const dbRules = await this.prisma.hubRoutingRule.findMany({
      where: {
        cpoCountryCode: cpoCountryCode.toUpperCase(),
        cpoPartyId: cpoPartyId.toUpperCase(),
      },
    });

    if (dbRules.length > 0) {
      const fields: Record<string, string> = {};
      for (const rule of dbRules) {
        const field = this.getRedisField(rule.emspCountryCode, rule.emspPartyId);
        fields[field] = JSON.stringify(rule);
      }
      await this.redis.getClient().hset(key, fields);
    }

    return dbRules;
  }
}
