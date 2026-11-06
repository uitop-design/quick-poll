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

interface HttpErrorLike {
  statusCode: number;
  expose: boolean;
  type?: string;
  message: string;
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
  if (isClientHttpError(exception)) {
    return {
      statusCode: exception.statusCode,
      message: exception.type === 'entity.parse.failed' ? 'Malformed JSON body' : exception.message,
    };
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: INTERNAL_ERROR_MESSAGE };
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) =>
    issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
  );
}

function extractHttpMessage(exception: HttpException): string | string[] {
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

function isClientHttpError(exception: unknown): exception is HttpErrorLike {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  const candidate = exception as Partial<HttpErrorLike>;
  return (
    candidate.expose === true &&
    typeof candidate.statusCode === 'number' &&
    candidate.statusCode >= 400 &&
    candidate.statusCode < 500
  );
}
