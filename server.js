#!/usr/bin/env node
/**
 * Custom server entry point for safe-settings
 * This replaces the default 'probot run' command to configure custom logging
 * Fixes issue #878: Excessive logging verbosity in v2.1.17
 */

const { run } = require('probot')
const { getLoggingOptions, getLogLevel } = require('./lib/logging')

// Configure custom serializers for pino
const pinoOptions = {
  level: getLogLevel(),
  ...getLoggingOptions()
}

// Run the app with custom logging configuration
run(require('./index'), {
  logOptions: pinoOptions
}).catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
