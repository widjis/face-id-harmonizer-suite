import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, 500, true, 'DATABASE_ERROR', details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = 'External service error', details?: any) {
    super(message, 502, true, 'EXTERNAL_SERVICE_ERROR', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
  stack?: string;
}

// Generate unique request ID for error tracking
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Main error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = generateRequestId();
  
  // Add request ID to request for logging
  (req as any).requestId = requestId;

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Internal server error';
  let details: any = undefined;

  // Handle custom AppError instances
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code || 'APP_ERROR';
    message = error.message;
    details = error.details;
  }
  // Handle JWT errors
  else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }
  else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }
  // Handle validation errors from express-validator
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = (error as any).errors;
  }
  // Handle database connection errors
  else if (error.message.includes('ECONNREFUSED') || error.message.includes('ConnectionError')) {
    statusCode = 503;
    errorCode = 'DATABASE_CONNECTION_ERROR';
    message = 'Database connection failed';
  }
  // Handle SQL errors
  else if (error.message.includes('Invalid column name') || error.message.includes('Incorrect syntax')) {
    statusCode = 500;
    errorCode = 'DATABASE_QUERY_ERROR';
    message = 'Database query error';
  }
  // Handle file upload errors
  else if (error.message.includes('File too large')) {
    statusCode = 413;
    errorCode = 'FILE_TOO_LARGE';
    message = 'File size exceeds limit';
  }
  else if (error.message.includes('Unexpected field')) {
    statusCode = 400;
    errorCode = 'INVALID_FILE_FIELD';
    message = 'Invalid file field in upload';
  }

  // Log error with context
  const errorContext = {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.userId,
    statusCode,
    errorCode,
    message: error.message,
    stack: error.stack
  };

  if (statusCode >= 500) {
    logger.error('Server error:', errorContext);
  } else {
    logger.warn('Client error:', errorContext);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler for unmatched routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// Validation error formatter
export const formatValidationErrors = (errors: any[]): any => {
  return errors.reduce((acc, error) => {
    const field = error.path || error.param;
    if (!acc[field]) {
      acc[field] = [];
    }
    acc[field].push({
      message: error.msg || error.message,
      value: error.value,
      location: error.location
    });
    return acc;
  }, {});
};

// Helper function to create validation error
export const createValidationError = (message: string, errors: any[]): ValidationError => {
  return new ValidationError(message, formatValidationErrors(errors));
};

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  formatValidationErrors,
  createValidationError
};