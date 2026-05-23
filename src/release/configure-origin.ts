export const configureOrigin = async (git: any) => {
  const githubToken = process.env.PVER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN

  if (!githubToken) return

  const remoteUrl = String(await git.remote(["get-url", "origin"])).trim()

  if (!remoteUrl.includes("github.com")) return

  const httpsRemoteUrl = remoteUrl
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^https:\/\/[^@/]+@github\.com\//, "https://github.com/")

  const authenticatedRemoteUrl = httpsRemoteUrl.replace(
    /^https:\/\/github\.com\//,
    `https://x-access-token:${githubToken.trim()}@github.com/`
  )

  if (authenticatedRemoteUrl !== remoteUrl) {
    await git.remote(["set-url", "origin", authenticatedRemoteUrl])
  }
}
