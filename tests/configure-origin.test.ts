import { configureOrigin } from "../src/release/configure-origin"

/**
 * Creates a mock git object that tracks remote operations.
 */
const createMockGit = (initialUrl: string) => {
  let currentUrl = initialUrl
  return {
    remote: async (args: string[]) => {
      if (args[0] === "get-url" && args[1] === "origin") {
        return currentUrl
      }
      return ""
    },
    removeRemote: async (_name: string) => {
      currentUrl = ""
    },
    addRemote: async (_name: string, url: string) => {
      currentUrl = url
    },
    getCurrentUrl: () => currentUrl,
  }
}

// Helper to save and restore env vars
const withEnv = async (
  env: Record<string, string | undefined>,
  fn: () => Promise<void>
) => {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key]
    if (env[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = env[key]
    }
  }
  try {
    await fn()
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = saved[key]
      }
    }
  }
}

async function runTests() {
  let passed = 0
  let failed = 0

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
      console.log(`  ✅ ${name}`)
      passed++
    } catch (e: any) {
      console.error(`  ❌ ${name}: ${e.message}`)
      failed++
    }
  }

  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(`Assertion failed: ${message}`)
  }

  console.log("\nconfigure-origin tests:\n")

  // Test 1: PVER_GITHUB_TOKEN takes precedence over GITHUB_TOKEN
  await test("PVER_GITHUB_TOKEN takes precedence over GITHUB_TOKEN", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: "pver-token-123", GITHUB_TOKEN: "gh-token-456" },
      async () => {
        const git = createMockGit("https://github.com/owner/repo.git")
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url.includes("pver-token-123"),
          `Expected URL to contain pver-token-123, got: ${url}`
        )
        assert(
          !url.includes("gh-token-456"),
          `Expected URL to NOT contain gh-token-456, got: ${url}`
        )
      }
    )
  })

  // Test 2: Falls back to GITHUB_TOKEN when PVER_GITHUB_TOKEN is not set
  await test("Falls back to GITHUB_TOKEN when PVER_GITHUB_TOKEN is unset", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: undefined, GITHUB_TOKEN: "gh-token-456" },
      async () => {
        const git = createMockGit("https://github.com/owner/repo.git")
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url.includes("gh-token-456"),
          `Expected URL to contain gh-token-456, got: ${url}`
        )
      }
    )
  })

  // Test 3: SSH remote is converted to HTTPS with token
  await test("SSH git@github.com:owner/repo.git is converted to HTTPS", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: undefined, GITHUB_TOKEN: "my-token" },
      async () => {
        const git = createMockGit("git@github.com:owner/repo.git")
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url.startsWith("https://oauth2:my-token@github.com/owner/repo.git"),
          `Expected HTTPS URL with token, got: ${url}`
        )
        assert(
          !url.includes("git@"),
          `Expected no git@ in URL, got: ${url}`
        )
      }
    )
  })

  // Test 4: ssh:// remote is converted to HTTPS with token
  await test("ssh://git@github.com/owner/repo.git is converted to HTTPS", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: undefined, GITHUB_TOKEN: "my-token" },
      async () => {
        const git = createMockGit("ssh://git@github.com/owner/repo.git")
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url.startsWith("https://oauth2:my-token@github.com/owner/repo.git"),
          `Expected HTTPS URL with token, got: ${url}`
        )
      }
    )
  })

  // Test 5: No token => no-op (remote URL unchanged)
  await test("No token set leaves remote URL unchanged", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: undefined, GITHUB_TOKEN: undefined },
      async () => {
        const original = "https://github.com/owner/repo.git"
        const git = createMockGit(original)
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url === original,
          `Expected URL unchanged (${original}), got: ${url}`
        )
      }
    )
  })

  // Test 6: Existing credentials in URL are replaced
  await test("Existing credentials in URL are replaced with new token", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: undefined, GITHUB_TOKEN: "new-token" },
      async () => {
        const git = createMockGit(
          "https://oauth2:old-token@github.com/owner/repo.git"
        )
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url.includes("new-token"),
          `Expected URL to contain new-token, got: ${url}`
        )
        assert(
          !url.includes("old-token"),
          `Expected URL to NOT contain old-token, got: ${url}`
        )
      }
    )
  })

  // Test 7: Token with special characters is URL-encoded
  await test("Token with special characters is URL-encoded", async () => {
    await withEnv(
      { PVER_GITHUB_TOKEN: undefined, GITHUB_TOKEN: "ghp_abc+def/ghi" },
      async () => {
        const git = createMockGit("https://github.com/owner/repo.git")
        await configureOrigin(git)
        const url = git.getCurrentUrl()
        assert(
          url.includes(encodeURIComponent("ghp_abc+def/ghi")),
          `Expected URL-encoded token in URL, got: ${url}`
        )
      }
    )
  })

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

runTests()
