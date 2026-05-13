import assert from "node:assert/strict"
import { __test__ } from "../src/release/configure-origin"

const { addGithubTokenToRemoteUrl, normalizeGithubRemoteUrl } = __test__

assert.equal(
  normalizeGithubRemoteUrl("git@github.com:owner/repo.git\n"),
  "https://github.com/owner/repo.git"
)

assert.equal(
  normalizeGithubRemoteUrl("ssh://git@github.com/owner/repo.git"),
  "https://github.com/owner/repo.git"
)

assert.equal(
  addGithubTokenToRemoteUrl("https://github.com/owner/repo.git", "pver-token"),
  "https://x-access-token:pver-token@github.com/owner/repo.git"
)

assert.equal(
  addGithubTokenToRemoteUrl(
    "https://old-user:old-token@github.com/owner/repo.git",
    "new-token"
  ),
  "https://x-access-token:new-token@github.com/owner/repo.git"
)

assert.equal(
  addGithubTokenToRemoteUrl("https://example.com/owner/repo.git", "token"),
  "https://example.com/owner/repo.git"
)

assert.equal(
  addGithubTokenToRemoteUrl("git@gitlab.com:owner/repo.git", "token"),
  "git@gitlab.com:owner/repo.git"
)

console.log("configure-origin tests passed")
