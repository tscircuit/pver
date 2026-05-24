import assert from "node:assert/strict"
import {
  getAuthenticatedGithubOriginUrl,
  getReleaseGithubToken,
} from "../src/release/configure-origin"

assert.equal(
  getAuthenticatedGithubOriginUrl("git@github.com:owner/repo.git\n", "tok en"),
  "https://oauth2:tok%20en@github.com/owner/repo.git"
)

assert.equal(
  getAuthenticatedGithubOriginUrl("ssh://git@github.com/owner/repo.git", "token"),
  "https://oauth2:token@github.com/owner/repo.git"
)

assert.equal(
  getAuthenticatedGithubOriginUrl("https://github.com/owner/repo.git", "token"),
  "https://oauth2:token@github.com/owner/repo.git"
)

assert.equal(
  getAuthenticatedGithubOriginUrl(
    "https://oauth2:old-token@github.com/owner/repo.git",
    "new-token"
  ),
  "https://oauth2:new-token@github.com/owner/repo.git"
)

assert.equal(
  getAuthenticatedGithubOriginUrl("https://example.com/owner/repo.git", "token"),
  "https://example.com/owner/repo.git"
)

const originalPverGithubToken = process.env.PVER_GITHUB_TOKEN
const originalGithubToken = process.env.GITHUB_TOKEN

process.env.GITHUB_TOKEN = "github-token"
delete process.env.PVER_GITHUB_TOKEN
assert.equal(getReleaseGithubToken(), "github-token")

process.env.PVER_GITHUB_TOKEN = "pver-token"
assert.equal(getReleaseGithubToken(), "pver-token")

if (originalPverGithubToken === undefined) {
  delete process.env.PVER_GITHUB_TOKEN
} else {
  process.env.PVER_GITHUB_TOKEN = originalPverGithubToken
}

if (originalGithubToken === undefined) {
  delete process.env.GITHUB_TOKEN
} else {
  process.env.GITHUB_TOKEN = originalGithubToken
}

console.log("configure-origin tests passed")
