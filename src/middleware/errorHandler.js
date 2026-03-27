/**
 * errorHandler.js
 * Centralized error handling middleware.
 * Catches all errors thrown via next(err) in any controller.
 */
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // ── Mongoose Validation Error 
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const errors = Object.values(err.errors).map((e) => e.message);
        message = errors.join(', ');
    }

    // ── Mongoose Duplicate Key Error
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists. Please use a different value.`;
    }

    // ── Mongoose Cast Error (invalid ObjectId) 
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }
    

    // ── JWT Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token. Please log in again.';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token has expired. Please log in again.';
    }

    // ── Log using Winston 
    if (statusCode >= 500) {
        logger.error(`[${req.method} ${req.originalUrl}] ${statusCode} - ${message}`, { stack: err.stack });
    } else {
        logger.warn(`[${req.method} ${req.originalUrl}] ${statusCode} - ${message}`);
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

/**
 * Helper to create structured errors with status codes.
 * Usage: throw createError(404, 'Customer not found')
 */
const createError = (statusCode, message) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
};

module.exports = { errorHandler, createError };
