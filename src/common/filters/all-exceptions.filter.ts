import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Socket } from 'socket.io';
import type { ErrorResponse } from '../errors/error-response.dto.js';
import { createErrorResponse } from '../errors/error-response.factory.js';
import { RateLimitExceededException } from '../errors/rate-limit-exceeded.exception.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'ws') {
      this.replyToSocket(exception, host);
      return;
    }
    this.replyToHttp(exception, host);
  }

  private replyToHttp(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const body = this.buildBody(exception, request.originalUrl);
    if (exception instanceof RateLimitExceededException) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    response.status(body.statusCode).json(body);
  }

  private replyToSocket(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToWs();
    const client = context.getClient<Socket>();
    const body = this.buildBody(exception, `${client.nsp.name}:${context.getPattern()}`);
    const ack: unknown = host.getArgByIndex(2);
    if (typeof ack === 'function') {
      ack(body);
      return;
    }
    client.emit('exception', body);
  }

  private buildBody(exception: unknown, path: string): ErrorResponse {
    const body = createErrorResponse(exception, path);
    if (
      body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR &&
      !(exception instanceof HttpException)
    ) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    return body;
  }
}
