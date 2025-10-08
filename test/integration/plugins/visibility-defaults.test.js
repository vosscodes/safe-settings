const { OK } = require('http-status-codes')
const any = require('@travi/any')
const settings = require('../../../lib/settings')
const { buildTriggerEvent, initializeNock, loadInstance, repository, teardownNock } = require('../common')

describe('visibility defaults', function () {
  let probot, githubScope

  beforeEach(() => {
    githubScope = initializeNock()
    probot = loadInstance()
  })

  afterEach(() => {
    teardownNock(githubScope)
  })

  it('applies public visibility defaults to public repository', async () => {
    const config = `
defaults:
  public:
    teams:
      - name: everyone
        permission: push

teams:
  - name: core
    permission: admin
`
    const encodedConfig = Buffer.from(config).toString('base64')
    const publicRepo = { ...repository, visibility: 'public' }
    const coreTeamId = any.integer()
    const everyoneTeamId = any.integer()

    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/contents/${settings.FILE_PATH}`)
      .reply(OK, { content: encodedConfig, name: 'settings.yml', type: 'file' })
    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/teams`)
      .reply(OK, [])
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/core`)
      .reply(OK, { id: coreTeamId })
    githubScope
      .put(`/teams/${coreTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'admin' })
        return true
      })
      .reply(OK)
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/everyone`)
      .reply(OK, { id: everyoneTeamId })
    githubScope
      .put(`/teams/${everyoneTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'push' })
        return true
      })
      .reply(OK)

    await probot.receive(buildTriggerEvent(publicRepo))
  })

  it('does not apply public defaults to private repository', async () => {
    const config = `
defaults:
  public:
    teams:
      - name: everyone
        permission: push

teams:
  - name: core
    permission: admin
`
    const encodedConfig = Buffer.from(config).toString('base64')
    const privateRepo = { ...repository, visibility: 'private' }
    const coreTeamId = any.integer()

    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/contents/${settings.FILE_PATH}`)
      .reply(OK, { content: encodedConfig, name: 'settings.yml', type: 'file' })
    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/teams`)
      .reply(OK, [])
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/core`)
      .reply(OK, { id: coreTeamId })
    githubScope
      .put(`/teams/${coreTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'admin' })
        return true
      })
      .reply(OK)

    await probot.receive(buildTriggerEvent(privateRepo))
  })

  it('applies internal visibility defaults to internal repository', async () => {
    const config = `
defaults:
  internal:
    teams:
      - name: employees
        permission: push

teams:
  - name: core
    permission: admin
`
    const encodedConfig = Buffer.from(config).toString('base64')
    const internalRepo = { ...repository, visibility: 'internal' }
    const coreTeamId = any.integer()
    const employeesTeamId = any.integer()

    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/contents/${settings.FILE_PATH}`)
      .reply(OK, { content: encodedConfig, name: 'settings.yml', type: 'file' })
    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/teams`)
      .reply(OK, [])
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/core`)
      .reply(OK, { id: coreTeamId })
    githubScope
      .put(`/teams/${coreTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'admin' })
        return true
      })
      .reply(OK)
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/employees`)
      .reply(OK, { id: employeesTeamId })
    githubScope
      .put(`/teams/${employeesTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'push' })
        return true
      })
      .reply(OK)

    await probot.receive(buildTriggerEvent(internalRepo))
  })

  it('falls back to private field when visibility not present', async () => {
    const config = `
defaults:
  private:
    teams:
      - name: restricted
        permission: pull

teams:
  - name: core
    permission: admin
`
    const encodedConfig = Buffer.from(config).toString('base64')
    const legacyPrivateRepo = { ...repository, private: true }
    delete legacyPrivateRepo.visibility
    const coreTeamId = any.integer()
    const restrictedTeamId = any.integer()

    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/contents/${settings.FILE_PATH}`)
      .reply(OK, { content: encodedConfig, name: 'settings.yml', type: 'file' })
    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/teams`)
      .reply(OK, [])
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/core`)
      .reply(OK, { id: coreTeamId })
    githubScope
      .put(`/teams/${coreTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'admin' })
        return true
      })
      .reply(OK)
    githubScope
      .get(`/orgs/${repository.owner.name}/teams/restricted`)
      .reply(OK, { id: restrictedTeamId })
    githubScope
      .put(`/teams/${restrictedTeamId}/repos/${repository.owner.name}/${repository.name}`, body => {
        expect(body).toMatchObject({ permission: 'pull' })
        return true
      })
      .reply(OK)

    await probot.receive(buildTriggerEvent(legacyPrivateRepo))
  })
})
