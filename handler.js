const {
  createLambdaFunction
} = require('@probot/adapter-aws-lambda-serverless')
const { getProbotOctoKit } = require('./lib/proxyAwareProbotOctokit')
const { createProbotWithLogging } = require('./lib/logging')

const appFn = require('./')

module.exports.webhooks = createLambdaFunction(appFn, {
  probot: createProbotWithLogging({ overrides: { Octokit: getProbotOctoKit() } })
})

module.exports.scheduler = function () {
  const probot = createProbotWithLogging({ overrides: { Octokit: getProbotOctoKit() } })
  const app = appFn(probot, {})
  return app.syncInstallation()
}
