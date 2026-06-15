import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static pgPool: Pool;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set in environment variables");
    }

    // Initialize the PostgreSQL connection pool if not already initialized
    if (!PrismaService.pgPool) {
      PrismaService.pgPool = new Pool({
        connectionString: databaseUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }

    const adapter = new PrismaPg(PrismaService.pgPool);
    super({ adapter });
  }

  async onModuleInit() {
    this.logger.log("Connecting Prisma Client via pg adapter...");
    await this.$connect();
  }

  async onModuleDestroy() {
    this.logger.log("Disconnecting Prisma Client...");
    await this.$disconnect();
  }
}
