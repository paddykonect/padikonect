import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiExcludeController } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../database/redis.module';

// Version-neutral (lives at /api/health, not /api/v1/health) — infra tooling
// (load balancer/orchestrator health probes) shouldn't have to track API versions.
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        await this.prisma.$queryRaw`SELECT 1`;
        return { database: { status: 'up' } };
      },
      async (): Promise<HealthIndicatorResult> => {
        const pong = await this.redis.ping();
        return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
      },
    ]);
  }
}
