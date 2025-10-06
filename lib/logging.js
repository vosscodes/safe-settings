/**
 * Custom logging configuration for safe-settings
 * Fixes issue #878: Verbose logging in v2.1.17
 *
 * This module provides custom serializers for HTTP request/response objects
 * to prevent excessive logging that occurred after upgrading to probot 13.
 */

/**
 * Get the current log level from environment or default
 */
function getLogLevel () {
  return process.env.LOG_LEVEL || 'info'
}

/**
 * Check if we should include verbose details based on log level
 */
function shouldIncludeVerboseDetails () {
  const level = getLogLevel().toLowerCase()
  return level === 'debug' || level === 'trace'
}

/**
 * Custom request serializer that only includes essential fields
 */
function requestSerializer (req) {
  if (!req) return req

  const serialized = {
    id: req.id,
    method: req.method,
    url: req.url,
    query: req.query,
    params: req.params,
    headers: {
      host: req.headers?.host,
      'user-agent': req.headers?.['user-agent'],
      'content-type': req.headers?.['content-type'],
      'content-length': req.headers?.['content-length'],
      'x-github-event': req.headers?.['x-github-event'],
      'x-github-delivery': req.headers?.['x-github-delivery'],
      'x-hub-signature-256': req.headers?.['x-hub-signature-256'] ? '[REDACTED]' : undefined
    },
    remoteAddress: req.socket?.remoteAddress || req.connection?.remoteAddress,
    remotePort: req.socket?.remotePort || req.connection?.remotePort
  }

  // Only include body and raw headers in debug/trace mode
  if (shouldIncludeVerboseDetails()) {
    serialized.body = req.body
    serialized.rawHeaders = req.rawHeaders
  }

  // Remove undefined values
  Object.keys(serialized.headers).forEach(key => {
    if (serialized.headers[key] === undefined) {
      delete serialized.headers[key]
    }
  })

  return serialized
}

/**
 * Custom response serializer that only includes essential fields
 */
function responseSerializer (res) {
  if (!res) return res

  const serialized = {
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    headers: {
      'content-type': res.getHeader?.('content-type'),
      'content-length': res.getHeader?.('content-length'),
      'x-powered-by': res.getHeader?.('x-powered-by'),
      location: res.getHeader?.('location')
    }
  }

  // Only include additional details in debug/trace mode
  if (shouldIncludeVerboseDetails()) {
    serialized.responseTime = res.responseTime
  }

  // Remove undefined values
  Object.keys(serialized.headers).forEach(key => {
    if (serialized.headers[key] === undefined) {
      delete serialized.headers[key]
    }
  })

  return serialized
}

/**
 * Get logging options for pino-http
 * These options should be passed to createProbot
 */
function getLoggingOptions () {
  return {
    serializers: {
      req: requestSerializer,
      res: responseSerializer,
      // Prevent serialization of these objects that can cause circular references
      err: (err) => {
        if (!err) return err
        return {
          type: err.constructor?.name || 'Error',
          message: err.message,
          stack: shouldIncludeVerboseDetails() ? err.stack : undefined,
          code: err.code,
          status: err.status || err.statusCode
        }
      }
    },
    // Don't log health checks at info level
    autoLogging: {
      ignore: (req) => {
        const isHealthCheck = req.url === '/' || req.url === '/probot' || req.url === '/health'
        const userAgent = req.headers?.['user-agent'] || ''
        const isELBHealthCheck = userAgent.includes('ELB-HealthChecker')

        // At info level, ignore health checks
        if (!shouldIncludeVerboseDetails() && isHealthCheck && isELBHealthCheck) {
          return true
        }
        return false
      }
    }
  }
}

/**
 * Create a properly configured Probot instance with custom logging
 */
function createProbotWithLogging (options = {}) {
  const { createProbot } = require('probot')

  const loggingOptions = getLoggingOptions()

  return createProbot({
    ...options,
    defaults: {
      ...options.defaults,
      logLevel: getLogLevel()
    },
    // Pass logging options that will be used by pino-http
    log: {
      ...options.log,
      level: getLogLevel(),
      serializers: loggingOptions.serializers
    },
    // Override the getRouter to pass our logging options
    overrides: {
      ...options.overrides,
      log: {
        level: getLogLevel(),
        serializers: loggingOptions.serializers
      }
    }
  })
}

module.exports = {
  requestSerializer,
  responseSerializer,
  getLoggingOptions,
  createProbotWithLogging,
  getLogLevel,
  shouldIncludeVerboseDetails
}
