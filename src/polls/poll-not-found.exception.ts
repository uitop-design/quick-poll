import { NotFoundException } from '@nestjs/common';

export class PollNotFoundException extends NotFoundException {
  constructor(pollId: string) {
    super(`Poll ${pollId} not found`);
  }
}
