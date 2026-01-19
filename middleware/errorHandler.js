// middleware/errorHandler.js
/**
 * Global Error Handler Middleware
 * Catches and formats all errors in the application
 * Provides consistent error responses across all routes
 */

/**
 * Not Found Middleware
 * Handles 404 errors for undefined routes
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Global Error Handler
 * Formats and sends error responses
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('🔥 Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query
    });
  }

  // Default status code and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let errors = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = {};
    Object.keys(err.errors).forEach(key => {
      errors[key] = err.errors[key].message;
    });
  }

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate key error';
    const field = Object.keys(err.keyPattern)[0];
    errors = { [field]: `This ${field} already exists` };
  }

  // Handle JWT errors (for future authentication)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    message: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Include errors object if available
  if (errors) {
    errorResponse.errors = errors;
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

module.exports = { notFound, errorHandler };
