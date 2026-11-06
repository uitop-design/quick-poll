import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../config/app-config.service.js';

type ConnectionState = 'unknown' | 'up' | 'down';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private state: ConnectionState = 'unknown';

  constructor(config: AppConfigService) {
    this.client = new Redis(config.get('REDIS_URL'), {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 1000,
      retryStrategy: (attempt) => Math.min(attempt * 250, 3000),
    });
    this.client.on('ready', () => this.updateState('up'));
    this.client.on('error', (error: Error) => this.updateState('down', error.message));
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private updateState(next: Exclude<ConnectionState, 'unknown'>, reason?: string): void {
    if (this.state === next) {
      return;
    }
    this.state = next;
    if (next === 'up') {
      this.logger.log('Redis connection is ready');
    } else {
      this.logger.warn(`Redis is unavailable (${reason}), falling back to PostgreSQL only`);
    }
  }
}
