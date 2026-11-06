import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../database/database.constants.js';
import { RedisService } from '../redis/redis.service.js';
import type { HealthStatus } from './dto/health-status.dto.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(KNEX) private readonly knex: Knex,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [postgres, redis] = await Promise.all([this.isPostgresUp(), this.redis.ping()]);
    const unavailable = [!postgres && 'postgres', !redis && 'redis'].filter(Boolean);
    if (unavailable.length > 0) {
      throw new ServiceUnavailableException(`Unavailable dependencies: ${unavailable.join(', ')}`);
    }
    return { status: 'ok', checks: { postgres: 'up', redis: 'up' } };
  }

  private async isPostgresUp(): Promise<boolean> {
    try {
      await this.knex.raw('select 1');
      return true;
    } catch {
      return false;
    }
  }
}
