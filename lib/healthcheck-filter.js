/**
 * Filter out health check logs from ELB at info level
 */

function shouldIgnoreHealthCheck (req) {
  const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase()
  const isVerbose = logLevel === 'debug' || logLevel === 'trace'

  if (isVerbose) {
    return false
  }

  const isHealthCheckPath = req.url === '/' || req.url === '/probot' || req.url === '/health'
  const userAgent = req.headers?.['user-agent'] || ''
  const isELBHealthCheck = userAgent.includes('ELB-HealthChecker')

  return isHealthCheckPath && isELBHealthCheck
}

module.exports = { shouldIgnoreHealthCheck }
