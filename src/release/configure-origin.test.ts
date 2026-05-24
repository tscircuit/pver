import assert from "node:assert/strict"
import {
  getAuthenticatedOriginUrl,
  normalizeGithubRemoteUrl,
} from "./configure-origin"

assert.equal(
  normalizeGithubRemoteUrl("git@github.com:owner/repo.git"),
  "https://github.com/owner/repo.git"
)
assert.equal(
  normalizeGithubRemoteUrl("ssh://git@github.com/owner/repo.git"),
  "https://github.com/owner/repo.git"
)
assert.equal(
  normalizeGithubRemoteUrl("https://oauth2:old-token@github.com/owner/repo.git"),
  "https://github.com/owner/repo.git"
)
assert.equal(
  getAuthenticatedOriginUrl("https://github.com/owner/repo.git", "ghp_test"),
  "https://oauth2:ghp_test@github.com/owner/repo.git"
)
assert.equal(
  getAuthenticatedOriginUrl("git@github.com:owner/repo.git", "ghp_test+/="),
  "https://oauth2:ghp_test%2B%2F%3D@github.com/owner/repo.git"
)
assert.equal(
  getAuthenticatedOriginUrl("https://gitlab.com/owner/repo.git", "ghp_test"),
  "https://gitlab.com/owner/repo.git"
)

console.log("configure-origin URL tests passed")
