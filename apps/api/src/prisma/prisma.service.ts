import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * The only database access point in the system (PRD section 41).
 * Connects lazily so the API can boot, and /health can report, before the database is up.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch {
      // Health endpoint reports database status; don't crash the process on boot.
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
