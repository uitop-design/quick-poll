import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many votes, try again later', HttpStatus.TOO_MANY_REQUESTS);
  }
}
