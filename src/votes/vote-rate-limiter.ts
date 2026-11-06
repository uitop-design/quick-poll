import { Injectable, Logger } from '@nestjs/common';
import { RateLimitExceededException } from '../common/errors/rate-limit-exceeded.exception.js';
import { AppConfigService } from '../config/app-config.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class VoteRateLimiter {
  private readonly logger = new Logger(VoteRateLimiter.name);
  private readonly maxVotes: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: AppConfigService,
  ) {
    this.maxVotes = config.get('VOTE_RATE_LIMIT_MAX');
    this.windowSeconds = config.get('VOTE_RATE_LIMIT_WINDOW_SECONDS');
  }

  static key(clientIp: string): string {
    return `rate-limit:votes:${clientIp}`;
  }

  async consume(clientIp: string): Promise<void> {
    const usage = await this.increment(VoteRateLimiter.key(clientIp));
    if (usage && usage.count > this.maxVotes) {
      throw new RateLimitExceededException(Math.max(1, Math.ceil(usage.ttlMs / 1000)));
    }
  }

  private async increment(key: string): Promise<{ count: number; ttlMs: number } | null> {
    try {
      const replies = await this.redis.client
        .multi()
        .incr(key)
        .expire(key, this.windowSeconds, 'NX')
        .pttl(key)
        .exec();
      if (!replies || replies.some(([error]) => error)) {
        return null;
      }
      return { count: Number(replies[0][1]), ttlMs: Number(replies[2][1]) };
    } catch (error) {
      this.logger.debug(
        `Rate limit skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
