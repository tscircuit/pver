import assert from "node:assert/strict"
import { configureOrigin } from "../src/release/configure-origin"

type FakeGit = {
  remoteUrl: string
  calls: string[]
  remote: (args: string[]) => Promise<string>
  removeRemote: (name: string) => Promise<void>
  addRemote: (name: string, url: string) => Promise<void>
}

const makeFakeGit = (remoteUrl: string): FakeGit => ({
  remoteUrl,
  calls: [],
  async remote(args: string[]) {
    assert.deepEqual(args, ["get-url", "origin"])
    this.calls.push(`remote:${args.join(" ")}`)
    return this.remoteUrl
  },
  async removeRemote(name: string) {
    assert.equal(name, "origin")
    this.calls.push(`removeRemote:${name}`)
  },
  async addRemote(name: string, url: string) {
    assert.equal(name, "origin")
    this.calls.push(`addRemote:${url}`)
    this.remoteUrl = url
  },
})

const withGitHubEnv = async (
  env: { PVER_GITHUB_TOKEN?: string; GITHUB_TOKEN?: string },
  callback: () => Promise<void>
) => {
  const original = {
    PVER_GITHUB_TOKEN: process.env.PVER_GITHUB_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  }

  for (const key of ["PVER_GITHUB_TOKEN", "GITHUB_TOKEN"] as const) {
    const value = env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    await callback()
  } finally {
    for (const key of ["PVER_GITHUB_TOKEN", "GITHUB_TOKEN"] as const) {
      const value = original[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

const main = async () => {
  await withGitHubEnv({ PVER_GITHUB_TOKEN: "pver_secret" }, async () => {
    const git = makeFakeGit("git@github.com:owner/repo.git")

    await configureOrigin(git)

    assert.equal(
      git.remoteUrl,
      "https://oauth2:pver_secret@github.com/owner/repo.git"
    )
  })

  await withGitHubEnv(
    { PVER_GITHUB_TOKEN: "pver_secret", GITHUB_TOKEN: "github_secret" },
    async () => {
      const git = makeFakeGit("https://github.com/owner/repo.git")

      await configureOrigin(git)

      assert.equal(
        git.remoteUrl,
        "https://oauth2:pver_secret@github.com/owner/repo.git"
      )
    }
  )

  await withGitHubEnv({ PVER_GITHUB_TOKEN: "new_secret" }, async () => {
    const git = makeFakeGit(
      "https://oauth2:old_secret@github.com/owner/repo.git"
    )

    await configureOrigin(git)

    assert.equal(
      git.remoteUrl,
      "https://oauth2:new_secret@github.com/owner/repo.git"
    )
  })

  await withGitHubEnv({}, async () => {
    const git = makeFakeGit("https://github.com/owner/repo.git")

    await configureOrigin(git)

    assert.deepEqual(git.calls, [])
    assert.equal(git.remoteUrl, "https://github.com/owner/repo.git")
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
