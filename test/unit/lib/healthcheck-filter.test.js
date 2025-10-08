const { shouldIgnoreHealthCheck } = require('../../../lib/healthcheck-filter')

describe('healthcheck-filter', () => {
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

  it('ignores ELB health checks at info level', () => {
    process.env.LOG_LEVEL = 'info'
    const req = {
      url: '/',
      headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(true)
  })

  it('ignores ELB health checks on /probot path', () => {
    process.env.LOG_LEVEL = 'info'
    const req = {
      url: '/probot',
      headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(true)
  })

  it('ignores ELB health checks on /health path', () => {
    process.env.LOG_LEVEL = 'info'
    const req = {
      url: '/health',
      headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(true)
  })

  it('does not ignore regular requests', () => {
    process.env.LOG_LEVEL = 'info'
    const req = {
      url: '/api/webhook',
      headers: { 'user-agent': 'GitHub-Hookshot/abc123' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(false)
  })

  it('does not ignore health checks at debug level', () => {
    process.env.LOG_LEVEL = 'debug'
    const req = {
      url: '/',
      headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(false)
  })

  it('does not ignore health checks at trace level', () => {
    process.env.LOG_LEVEL = 'trace'
    const req = {
      url: '/',
      headers: { 'user-agent': 'ELB-HealthChecker/2.0' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(false)
  })

  it('does not ignore health checks from non-ELB user agents', () => {
    process.env.LOG_LEVEL = 'info'
    const req = {
      url: '/',
      headers: { 'user-agent': 'curl/7.64.1' }
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(false)
  })

  it('handles missing user-agent header', () => {
    process.env.LOG_LEVEL = 'info'
    const req = {
      url: '/',
      headers: {}
    }
    expect(shouldIgnoreHealthCheck(req)).toBe(false)
  })
})
