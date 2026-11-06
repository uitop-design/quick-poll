import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { RedisService } from '../redis/redis.service.js';
import type { PollResults } from './dto/poll-results.dto.js';

const SET_IF_NOT_STALE = `
local current = redis.call('GET', KEYS[1])
if current then
  local ok, cached = pcall(cjson.decode, current)
  if ok and tonumber(cached.totalVotes) > tonumber(ARGV[2]) then
    return 0
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
return 1
`;

const KEY_PATTERN = 'poll:*:results';

@Injectable()
export class PollResultsCache implements OnModuleInit {
  private readonly logger = new Logger(PollResultsCache.name);
  private readonly defaultTtlMs: number;

  constructor(
    private readonly redis: RedisService,
    config: AppConfigService,
  ) {
    this.defaultTtlMs = config.get('RESULTS_CACHE_TTL_SECONDS') * 1000;
  }

  static key(pollId: string): string {
    return `poll:${pollId}:results`;
  }

  onModuleInit(): void {
    this.redis.onRecovery(() => this.clear());
  }

  async clear(): Promise<void> {
    try {
      const stream = this.redis.client.scanStream({ match: KEY_PATTERN, count: 500 });
      for await (const keys of stream as AsyncIterable<string[]>) {
        if (keys.length > 0) {
          await this.redis.client.unlink(...keys);
        }
      }
      this.logger.log('Results cache cleared');
    } catch (error) {
      this.logFailure('clear', error);
    }
  }

  async get(pollId: string): Promise<PollResults | null> {
    try {
      const cached = await this.redis.client.get(PollResultsCache.key(pollId));
      return cached === null ? null : (JSON.parse(cached) as PollResults);
    } catch (error) {
      this.logFailure('read', error);
      return null;
    }
  }

  async set(results: PollResults, now: Date): Promise<void> {
    try {
      await this.redis.client.eval(
        SET_IF_NOT_STALE,
        1,
        PollResultsCache.key(results.id),
        JSON.stringify(results),
        results.totalVotes,
        this.ttlFor(results, now),
      );
    } catch (error) {
      this.logFailure('write', error);
    }
  }

  async delete(pollId: string): Promise<void> {
    try {
      await this.redis.client.del(PollResultsCache.key(pollId));
    } catch (error) {
      this.logFailure('delete', error);
    }
  }

  private ttlFor(results: PollResults, now: Date): number {
    if (results.closesAt === null) {
      return this.defaultTtlMs;
    }
    const remainingMs = new Date(results.closesAt).getTime() - now.getTime();
    return remainingMs > 0 ? Math.min(this.defaultTtlMs, remainingMs) : this.defaultTtlMs;
  }

  private logFailure(operation: string, error: unknown): void {
    this.logger.debug(
      `Cache ${operation} skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
