import { configureOrigin } from "../src/release/configure-origin"

// Mock git object to capture remote operations
function createMockGit(initialUrl: string) {
  let currentUrl = initialUrl
  const calls: { method: string; args: any[] }[] = []

  return {
    remote: async (args: string[]) => {
      calls.push({ method: "remote", args })
      return currentUrl + "\n"
    },
    removeRemote: async (name: string) => {
      calls.push({ method: "removeRemote", args: [name] })
    },
    addRemote: async (name: string, url: string) => {
      calls.push({ method: "addRemote", args: [name, url] })
      currentUrl = url
    },
    getCalls: () => calls,
    getCurrentUrl: () => currentUrl,
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg)
}

async function runTests() {
  // Test 1
  {
    const originalPver = process.env.PVER_GITHUB_TOKEN
    const originalGh = process.env.GITHUB_TOKEN
    process.env.PVER_GITHUB_TOKEN = "pver-token-123"
    process.env.GITHUB_TOKEN = "gh-token-456"

    const git = createMockGit("https://github.com/tscircuit/pver.git")
    await configureOrigin(git)

    assert(
      git.getCurrentUrl().includes("pver-token-123"),
      `Expected pver-token-123 in URL, got: ${git.getCurrentUrl()}`
    )
    assert(
      !git.getCurrentUrl().includes("gh-token-456"),
      "Should not contain GITHUB_TOKEN"
    )
    console.log("✅ uses PVER_GITHUB_TOKEN over GITHUB_TOKEN")

    process.env.PVER_GITHUB_TOKEN = originalPver
    process.env.GITHUB_TOKEN = originalGh
  }

  // Test 2
  {
    const originalPver = process.env.PVER_GITHUB_TOKEN
    const originalGh = process.env.GITHUB_TOKEN
    delete process.env.PVER_GITHUB_TOKEN
    process.env.GITHUB_TOKEN = "gh-token-789"

    const git = createMockGit("https://github.com/tscircuit/pver.git")
    await configureOrigin(git)

    assert(
      git.getCurrentUrl().includes("gh-token-789"),
      `Expected gh-token-789 in URL, got: ${git.getCurrentUrl()}`
    )
    console.log("✅ falls back to GITHUB_TOKEN when PVER_GITHUB_TOKEN not set")

    process.env.PVER_GITHUB_TOKEN = originalPver
    process.env.GITHUB_TOKEN = originalGh
  }

  // Test 3
  {
    const originalPver = process.env.PVER_GITHUB_TOKEN
    const originalGh = process.env.GITHUB_TOKEN
    delete process.env.PVER_GITHUB_TOKEN
    process.env.GITHUB_TOKEN = "my-token"

    const git = createMockGit("git@github.com:tscircuit/pver.git")
    await configureOrigin(git)

    const url = git.getCurrentUrl()
    assert(
      url === "https://oauth2:my-token@github.com/tscircuit/pver.git",
      `Expected proper HTTPS URL with token, got: ${url}`
    )
    console.log("✅ converts SSH URL to HTTPS with token")

    process.env.PVER_GITHUB_TOKEN = originalPver
    process.env.GITHUB_TOKEN = originalGh
  }

  // Test 4
  {
    const originalPver = process.env.PVER_GITHUB_TOKEN
    const originalGh = process.env.GITHUB_TOKEN
    delete process.env.PVER_GITHUB_TOKEN
    delete process.env.GITHUB_TOKEN

    const git = createMockGit("https://github.com/tscircuit/pver.git")
    await configureOrigin(git)

    assert(
      git.getCalls().length === 0,
      `Expected no git calls, got: ${git.getCalls().length}`
    )
    console.log("✅ does nothing when no token is set")

    process.env.PVER_GITHUB_TOKEN = originalPver
    process.env.GITHUB_TOKEN = originalGh
  }

  // Test 5
  {
    const originalPver = process.env.PVER_GITHUB_TOKEN
    const originalGh = process.env.GITHUB_TOKEN
    delete process.env.PVER_GITHUB_TOKEN
    process.env.GITHUB_TOKEN = "my-token"

    const git = createMockGit("https://oauth2:existing-token@github.com/tscircuit/pver.git")
    await configureOrigin(git)

    const url = git.getCurrentUrl()
    assert(
      !url.includes("my-token"),
      `Should not inject token when oauth2 already present, got: ${url}`
    )
    console.log("✅ does not double-inject token if oauth2 already present")

    process.env.PVER_GITHUB_TOKEN = originalPver
    process.env.GITHUB_TOKEN = originalGh
  }
}

runTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
