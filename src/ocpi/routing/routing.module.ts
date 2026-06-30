import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaModule } from "../../prisma/prisma.module";
import { RedisModule } from "../../redis/redis.module";
import { RoutingCacheService } from "./routing-cache.service";
import { RoutingFilterEngine } from "./filtering/filter.strategy";
import { RoutingProducerService } from "./routing-producer.service";
import { OcpiRoutingWorker } from "./routing.worker";

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HttpModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL") || "redis://localhost:6379";
        try {
          const parsed = new URL(redisUrl);
          const connection: any = {
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port, 10) : 6379,
            // BullMQ / ioredis requires maxRetriesPerRequest to be null or not set for Worker connections
            maxRetriesPerRequest: null,
          };
          if (parsed.password) {
            connection.password = decodeURIComponent(parsed.password);
          } else if (parsed.username) {
            connection.password = decodeURIComponent(parsed.username);
          }
          return { connection };
        } catch (err) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: null,
            },
          };
        }
      },
    }),
    BullModule.registerQueue({
      name: "ocpi-routing-queue",
    }),
  ],
  providers: [
    RoutingCacheService,
    RoutingFilterEngine,
    RoutingProducerService,
    OcpiRoutingWorker,
  ],
  exports: [
    RoutingCacheService,
    RoutingFilterEngine,
    RoutingProducerService,
  ],
})
export class RoutingModule {}
