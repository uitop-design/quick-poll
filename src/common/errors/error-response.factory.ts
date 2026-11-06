import { STATUS_CODES } from 'node:http';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import {
  CheckViolationError,
  DataError,
  ForeignKeyViolationError,
  NotFoundError,
  NotNullViolationError,
  UniqueViolationError,
} from 'objection';
import type { z } from 'zod';
import type { ErrorResponse } from './error-response.dto.js';

interface ResolvedError {
  statusCode: number;
  message: string | string[];
}

export const INTERNAL_ERROR_MESSAGE = 'Internal server error';

export function createErrorResponse(exception: unknown, path: string): ErrorResponse {
  const { statusCode, message } = resolveError(exception);
  return {
    statusCode,
    error: STATUS_CODES[statusCode] ?? 'Error',
    message,
    path,
    timestamp: new Date().toISOString(),
  };
}

function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof ZodValidationException) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      message: formatZodIssues(exception.getZodError() as z.ZodError),
    };
  }
  if (exception instanceof HttpException) {
    return { statusCode: exception.getStatus(), message: extractHttpMessage(exception) };
  }
  if (exception instanceof UniqueViolationError) {
    return { statusCode: HttpStatus.CONFLICT, message: 'Resource already exists' };
  }
  if (exception instanceof ForeignKeyViolationError) {
    return { statusCode: HttpStatus.BAD_REQUEST, message: 'Referenced resource does not exist' };
  }
  if (exception instanceof NotFoundError) {
    return { statusCode: HttpStatus.NOT_FOUND, message: 'Resource not found' };
  }
  if (
    exception instanceof DataError ||
    exception instanceof CheckViolationError ||
    exception instanceof NotNullViolationError
  ) {
    return { statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid data' };
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_ERROR_MESSAGE };
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
  );
}

function extractHttpMessage(exception: HttpException): string | string[] {
  if (exception.cause instanceof SyntaxError) {
    return 'Malformed JSON body';
  }
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const { message } = response;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message;
    }
  }
  return exception.message;
}
