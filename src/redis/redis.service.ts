import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../config/app-config.service.js';

type ConnectionState = 'unknown' | 'up' | 'down';

type RecoveryListener = () => Promise<void>;

@Injectable()
export class RedisService implements OnApplicationShutdown {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private readonly recoveryListeners: RecoveryListener[] = [];
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

  onRecovery(listener: RecoveryListener): void {
    this.recoveryListeners.push(listener);
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private updateState(next: Exclude<ConnectionState, 'unknown'>, reason?: string): void {
    const previous = this.state;
    if (previous === next) {
      return;
    }
    this.state = next;
    if (next === 'down') {
      this.logger.warn(`Redis is unavailable (${reason}), falling back to PostgreSQL only`);
      return;
    }
    this.logger.log('Redis connection is ready');
    if (previous === 'down') {
      this.notifyRecovery();
    }
  }

  private notifyRecovery(): void {
    for (const listener of this.recoveryListeners) {
      listener().catch((error: unknown) =>
        this.logger.warn(
          `Redis recovery handler failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}
