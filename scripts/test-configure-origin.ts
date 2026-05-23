import assert from "node:assert/strict"
import {
  addGithubTokenToRemoteUrl,
  configureOrigin,
  getGithubToken,
  normalizeGithubRemoteUrl,
} from "../src/release/configure-origin"

assert.equal(
  normalizeGithubRemoteUrl("git@github.com:owner/repo.git\n"),
  "https://github.com/owner/repo.git"
)
assert.equal(
  normalizeGithubRemoteUrl("ssh://git@github.com/owner/repo.git"),
  "https://github.com/owner/repo.git"
)
assert.equal(
  addGithubTokenToRemoteUrl("https://github.com/owner/repo.git", "ghp_test:token"),
  "https://oauth2:ghp_test%3Atoken@github.com/owner/repo.git"
)
assert.equal(
  addGithubTokenToRemoteUrl("https://example.com/owner/repo.git", "ghp_test"),
  "https://example.com/owner/repo.git"
)

process.env.GITHUB_TOKEN = "github-token"
process.env.PVER_GITHUB_TOKEN = "pver-token"
assert.equal(getGithubToken(), "pver-token")
process.env.PVER_GITHUB_TOKEN = ""
assert.equal(getGithubToken(), "github-token")
delete process.env.PVER_GITHUB_TOKEN
delete process.env.GITHUB_TOKEN

const remoteUpdates: string[] = []

async function main() {
  process.env.PVER_GITHUB_TOKEN = "branch-protection-token"
  await configureOrigin({
    remote: async () => "git@github.com:owner/repo.git\n",
    removeRemote: async (remoteName: string) => {
      remoteUpdates.push(`remove:${remoteName}`)
    },
    addRemote: async (remoteName: string, remoteUrl: string) => {
      remoteUpdates.push(`add:${remoteName}:${remoteUrl}`)
    },
  })
  delete process.env.PVER_GITHUB_TOKEN

  assert.deepEqual(remoteUpdates, [
    "remove:origin",
    "add:origin:https://oauth2:branch-protection-token@github.com/owner/repo.git",
  ])
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
