import {
  type ArgumentsHost,
  BadRequestException,
  GoneException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ZodValidationException } from 'nestjs-zod';
import { NotFoundError } from 'objection';
import { z } from 'zod';
import { Poll } from '../../database/models/poll.model.js';
import { foreignKeyViolation, postgresError, uniqueViolation } from '../../testing/fixtures.js';
import type { ErrorResponse } from '../errors/error-response.dto.js';
import { RateLimitExceededException } from '../errors/rate-limit-exceeded.exception.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function httpHost(path = '/api/polls') {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl: path }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function wsHost(ack?: jest.Mock) {
  const client = { nsp: { name: '/polls' }, emit: jest.fn() };
  const host = {
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => client, getPattern: () => 'subscribe' }),
    getArgByIndex: (index: number) => (index === 2 ? ack : undefined),
  } as unknown as ArgumentsHost;
  return { host, client };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let logError: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
  });

  function respond(exception: unknown): {
    status: unknown;
    body: ErrorResponse;
    response: ReturnType<typeof httpHost>['response'];
  } {
    const { host, response } = httpHost();
    filter.catch(exception, host);
    return {
      status: response.status.mock.calls[0]?.[0],
      body: response.json.mock.calls[0]?.[0] as ErrorResponse,
      response,
    };
  }

  it('renders http exceptions in the common error format', () => {
    const { status, body } = respond(new GoneException('Poll is closed'));

    expect(status).toBe(410);
    expect(body).toEqual({
      statusCode: 410,
      error: 'Gone',
      message: 'Poll is closed',
      path: '/api/polls',
      timestamp: expect.any(String),
    });
  });

  it('lists every validation problem', () => {
    const schema = z.object({ question: z.string().min(3), options: z.array(z.string()).min(2) });
    const { error } = schema.safeParse({ question: 'a', options: [] });

    const { status, body } = respond(new ZodValidationException(error));

    expect(status).toBe(400);
    expect(body.message).toEqual([
      expect.stringMatching(/^question: /),
      expect.stringMatching(/^options: /),
    ]);
  });

  it('hides json parser details', () => {
    const { body } = respond(
      new BadRequestException('Unexpected end of JSON input', { cause: new SyntaxError('x') }),
    );

    expect(body.message).toBe('Malformed JSON body');
  });

  it('adds Retry-After to rate limit errors', () => {
    const { status, response } = respond(new RateLimitExceededException(17));

    expect(status).toBe(429);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '17');
  });

  it.each([
    ['unique violation', uniqueViolation, 409, 'Conflict'],
    ['foreign key violation', foreignKeyViolation, 400, 'Bad Request'],
    ['invalid data', () => postgresError('22P02'), 400, 'Bad Request'],
    ['missing row', () => new NotFoundError({ modelClass: Poll }), 404, 'Not Found'],
  ])('maps a database %s', (_name, createError, statusCode, error) => {
    const { body } = respond(createError());

    expect(body).toMatchObject({ statusCode, error });
  });

  it('answers unexpected errors with 500 without leaking details', () => {
    const { status, body } = respond(new Error('password=secret'));

    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('does not log expected http errors', () => {
    respond(new NotFoundException());

    expect(logError).not.toHaveBeenCalled();
  });

  it('acknowledges websocket errors in the same format', () => {
    const ack = jest.fn();
    const { host, client } = wsHost(ack);

    filter.catch(new NotFoundException('Poll not found'), host);

    expect(ack).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Poll not found',
      path: '/polls:subscribe',
      timestamp: expect.any(String),
    });
    expect(client.emit).not.toHaveBeenCalled();
  });

  it('emits an exception event when the client sent no acknowledgement', () => {
    const { host, client } = wsHost();

    filter.catch(new NotFoundException('Poll not found'), host);

    expect(client.emit).toHaveBeenCalledWith(
      'exception',
      expect.objectContaining({ statusCode: 404 }),
    );
  });
});
