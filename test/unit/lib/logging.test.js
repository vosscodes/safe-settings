const {
  requestSerializer,
  responseSerializer,
  getLoggingOptions,
  getLogLevel,
  shouldIncludeVerboseDetails
} = require('../../../lib/logging')

describe('logging configuration', () => {
  let originalLogLevel

  beforeEach(() => {
    originalLogLevel = process.env.LOG_LEVEL
  })

  afterEach(() => {
    if (originalLogLevel) {
      process.env.LOG_LEVEL = originalLogLevel
    } else {
      delete process.env.LOG_LEVEL
    }
  })

  describe('getLogLevel', () => {
    it('returns info by default', () => {
      delete process.env.LOG_LEVEL
      expect(getLogLevel()).toBe('info')
    })

    it('returns LOG_LEVEL from environment', () => {
      process.env.LOG_LEVEL = 'debug'
      expect(getLogLevel()).toBe('debug')
    })
  })

  describe('shouldIncludeVerboseDetails', () => {
    it('returns false for info level', () => {
      process.env.LOG_LEVEL = 'info'
      expect(shouldIncludeVerboseDetails()).toBe(false)
    })

    it('returns false for warn level', () => {
      process.env.LOG_LEVEL = 'warn'
      expect(shouldIncludeVerboseDetails()).toBe(false)
    })

    it('returns true for debug level', () => {
      process.env.LOG_LEVEL = 'debug'
      expect(shouldIncludeVerboseDetails()).toBe(true)
    })

    it('returns true for trace level', () => {
      process.env.LOG_LEVEL = 'trace'
      expect(shouldIncludeVerboseDetails()).toBe(true)
    })
  })

  describe('requestSerializer', () => {
    const mockReq = {
      id: 'req-123',
      method: 'GET',
      url: '/test',
      query: { foo: 'bar' },
      params: { id: '1' },
      headers: {
        host: 'example.com',
        'user-agent': 'test-agent',
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-123',
        'x-hub-signature-256': 'secret-signature'
      },
      socket: {
        remoteAddress: '127.0.0.1',
        remotePort: 12345
      },
      body: { test: 'data' },
      rawHeaders: ['Host', 'example.com']
    }

    it('serializes request with essential fields at info level', () => {
      process.env.LOG_LEVEL = 'info'
      const serialized = requestSerializer(mockReq)

      expect(serialized.id).toBe('req-123')
      expect(serialized.method).toBe('GET')
      expect(serialized.url).toBe('/test')
      expect(serialized.query).toEqual({ foo: 'bar' })
      expect(serialized.params).toEqual({ id: '1' })
      expect(serialized.headers.host).toBe('example.com')
      expect(serialized.headers['x-hub-signature-256']).toBe('[REDACTED]')
      expect(serialized.remoteAddress).toBe('127.0.0.1')
      expect(serialized.remotePort).toBe(12345)

      // Should not include verbose details
      expect(serialized.body).toBeUndefined()
      expect(serialized.rawHeaders).toBeUndefined()
    })

    it('includes verbose details at debug level', () => {
      process.env.LOG_LEVEL = 'debug'
      const serialized = requestSerializer(mockReq)

      expect(serialized.body).toEqual({ test: 'data' })
      expect(serialized.rawHeaders).toEqual(['Host', 'example.com'])
    })

    it('handles missing request gracefully', () => {
      expect(requestSerializer(null)).toBeNull()
      expect(requestSerializer(undefined)).toBeUndefined()
    })

    it('does not include circular references', () => {
      const reqWithCircular = {
        ...mockReq,
        circular: null
      }
      reqWithCircular.circular = reqWithCircular

      const serialized = requestSerializer(reqWithCircular)
      // Should not throw and should not include circular reference
      expect(serialized.circular).toBeUndefined()
    })
  })

  describe('responseSerializer', () => {
    const mockRes = {
      statusCode: 200,
      statusMessage: 'OK',
      responseTime: 123,
      getHeader: (name) => {
        const headers = {
          'content-type': 'application/json',
          'content-length': '42',
          'x-powered-by': 'Express',
          location: '/redirect'
        }
        return headers[name]
      }
    }

    it('serializes response with essential fields at info level', () => {
      process.env.LOG_LEVEL = 'info'
      const serialized = responseSerializer(mockRes)

      expect(serialized.statusCode).toBe(200)
      expect(serialized.statusMessage).toBe('OK')
      expect(serialized.headers['content-type']).toBe('application/json')
      expect(serialized.headers['content-length']).toBe('42')

      // Should not include verbose details
      expect(serialized.responseTime).toBeUndefined()
    })

    it('includes verbose details at debug level', () => {
      process.env.LOG_LEVEL = 'debug'
      const serialized = responseSerializer(mockRes)

      expect(serialized.responseTime).toBe(123)
    })

    it('handles missing response gracefully', () => {
      expect(responseSerializer(null)).toBeNull()
      expect(responseSerializer(undefined)).toBeUndefined()
    })
  })

  describe('getLoggingOptions', () => {
    it('returns logging options with serializers', () => {
      const options = getLoggingOptions()

      expect(options.serializers).toBeDefined()
      expect(options.serializers.req).toBeDefined()
      expect(options.serializers.res).toBeDefined()
      expect(options.serializers.err).toBeDefined()
      expect(options.autoLogging).toBeDefined()
    })

    it('ignores health checks from ELB at info level', () => {
      process.env.LOG_LEVEL = 'info'
      const options = getLoggingOptions()

      const healthCheckReq = {
        url: '/',
        headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
      }

      expect(options.autoLogging.ignore(healthCheckReq)).toBe(true)
    })

    it('does not ignore health checks at debug level', () => {
      process.env.LOG_LEVEL = 'debug'
      const options = getLoggingOptions()

      const healthCheckReq = {
        url: '/',
        headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
      }

      expect(options.autoLogging.ignore(healthCheckReq)).toBe(false)
    })

    it('does not ignore non-health-check requests', () => {
      process.env.LOG_LEVEL = 'info'
      const options = getLoggingOptions()

      const normalReq = {
        url: '/api/webhook',
        headers: { 'user-agent': 'GitHub-Hookshot/abc123' }
      }

      expect(options.autoLogging.ignore(normalReq)).toBe(false)
    })
  })

  describe('error serializer', () => {
    it('serializes errors with essential fields at info level', () => {
      process.env.LOG_LEVEL = 'info'
      const options = getLoggingOptions()
      const error = new Error('Test error')
      error.code = 'TEST_ERROR'
      error.status = 500

      const serialized = options.serializers.err(error)

      expect(serialized.type).toBe('Error')
      expect(serialized.message).toBe('Test error')
      expect(serialized.code).toBe('TEST_ERROR')
      expect(serialized.status).toBe(500)
      expect(serialized.stack).toBeUndefined()
    })

    it('includes stack trace at debug level', () => {
      process.env.LOG_LEVEL = 'debug'
      const options = getLoggingOptions()
      const error = new Error('Test error')

      const serialized = options.serializers.err(error)

      expect(serialized.stack).toBeDefined()
      expect(serialized.stack).toContain('Test error')
    })
  })
})
