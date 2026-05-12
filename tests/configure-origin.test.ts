import * as assert from "node:assert/strict"

import { configureOrigin } from "../src/release/configure-origin"

type RemoteCall = ["get-url", "origin"]

class FakeGit {
  public urls: string[] = []
  public removed = 0

  constructor(initialUrl: string) {
    this.urls.push(initialUrl)
  }

  async remote(args: RemoteCall) {
    assert.deepEqual(args, ["get-url", "origin"])
    return this.urls[this.urls.length - 1]
  }

  async removeRemote(name: string) {
    assert.equal(name, "origin")
    this.removed += 1
  }

  async addRemote(name: string, url: string) {
    assert.equal(name, "origin")
    this.urls.push(url)
  }
}

async function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const previous: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(env)) {
    previous[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    return await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function testUsesPverGithubTokenForHttpsOrigins() {
  await withEnv({ PVER_GITHUB_TOKEN: "pver test/value", GITHUB_TOKEN: undefined }, async () => {
    const git = new FakeGit("https://github.com/owner/repo.git")

    await configureOrigin(git)

    assert.equal(git.urls.at(-1), "https://x-access-token:pver%20test%2Fvalue@github.com/owner/repo.git")
    assert.equal(git.removed, 1)
  })
}

async function testConvertsSshGithubOriginsBeforeAddingToken() {
  await withEnv({ PVER_GITHUB_TOKEN: "github_app_test_value", GITHUB_TOKEN: undefined }, async () => {
    const git = new FakeGit("git@github.com:owner/repo.git")

    await configureOrigin(git)

    assert.equal(git.urls.at(-1), "https://x-access-token:github_app_test_value@github.com/owner/repo.git")
  })
}

async function testPverTokenTakesPrecedenceOverGithubToken() {
  await withEnv({ PVER_GITHUB_TOKEN: "preferred_test_value", GITHUB_TOKEN: "default_test_value" }, async () => {
    const git = new FakeGit("https://github.com/owner/repo.git")

    await configureOrigin(git)

    assert.equal(git.urls.at(-1), "https://x-access-token:preferred_test_value@github.com/owner/repo.git")
  })
}

async function main() {
  await testUsesPverGithubTokenForHttpsOrigins()
  await testConvertsSshGithubOriginsBeforeAddingToken()
  await testPverTokenTakesPrecedenceOverGithubToken()
  console.log("configure-origin tests passed")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
