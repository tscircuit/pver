import assert from "node:assert/strict"
import { AppContext } from "../src/app-context"
import { configureOrigin } from "../src/release/configure-origin"
import { getBaseBranch, getPushBranch } from "../src/release/get-branch-targets"

class FakeGit {
  public removed = false
  public added: Array<[string, string]> = []

  constructor(private remoteUrl: string) {}

  async remote(args: Array<string>) {
    if (args[0] !== "get-url" || args[1] !== "origin") {
      throw new Error(`unexpected remote command: ${args.join(" ")}`)
    }
    return this.remoteUrl
  }

  async removeRemote(name: string) {
    assert.equal(name, "origin")
    this.removed = true
  }

  async addRemote(name: string, url: string) {
    assert.equal(name, "origin")
    this.added.push([name, url])
    this.remoteUrl = url
  }
}

const makeContext = (overrides: Partial<AppContext> = {}): AppContext =>
  ({
    current_method: "auto",
    transition_method: "auto",
    release_methods: [],
    readme_files: [],
    base_branch: "main",
    ...overrides,
  }) as AppContext

const withEnv = async (
  env: Record<string, string | undefined>,
  run: () => Promise<void>
) => {
  const original = {
    GH_TOKEN: process.env.GH_TOKEN,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  }

  if (env.GH_TOKEN === undefined) {
    delete process.env.GH_TOKEN
  } else {
    process.env.GH_TOKEN = env.GH_TOKEN
  }

  if (env.GITHUB_TOKEN === undefined) {
    delete process.env.GITHUB_TOKEN
  } else {
    process.env.GITHUB_TOKEN = env.GITHUB_TOKEN
  }

  try {
    await run()
  } finally {
    if (original.GH_TOKEN === undefined) {
      delete process.env.GH_TOKEN
    } else {
      process.env.GH_TOKEN = original.GH_TOKEN
    }

    if (original.GITHUB_TOKEN === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = original.GITHUB_TOKEN
    }
  }
}

async function main() {
  const base_context = makeContext({ push_branch: "release/protected" })
  assert.equal(getBaseBranch(base_context), "main")
  assert.equal(getPushBranch(base_context), "release/protected")
  assert.equal(getPushBranch(makeContext()), "main")

  await withEnv({ GH_TOKEN: "gh_secret" }, async () => {
    const git = new FakeGit("git@github.com:example/repo.git")
    await configureOrigin(git)
    assert.equal(git.removed, true)
    assert.deepEqual(git.added, [
      ["origin", "https://oauth2:gh_secret@github.com/example/repo.git"],
    ])
  })

  await withEnv({ GITHUB_TOKEN: "github_secret" }, async () => {
    const git = new FakeGit("https://github.com/example/repo.git")
    await configureOrigin(git)
    assert.equal(git.removed, true)
    assert.deepEqual(git.added, [
      ["origin", "https://oauth2:github_secret@github.com/example/repo.git"],
    ])
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
