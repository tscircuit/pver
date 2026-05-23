// Configures the git remote origin URL to include a GitHub token so that
// pver can push commits and tags. Prefers PVER_GITHUB_TOKEN (a PAT that can
// bypass branch-protection rules) and falls back to GITHUB_TOKEN.
export const configureOrigin = async (git: any) => {
  const token = process.env.PVER_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (!token) return

  const encodedToken = encodeURIComponent(token.trim())
  const remote_url: string = (await git.remote(["get-url", "origin"])).trim()

  // Normalise SSH → HTTPS before embedding credentials
  let https_url = remote_url.startsWith("git@")
    ? remote_url
        .replace("git@github.com:", "https://github.com/")
        .replace(/\.git$/, "")
    : remote_url

  // Strip any existing embedded credentials so we don't double-embed
  https_url = https_url.replace(/https:\/\/[^@]+@/, "https://")

  const authenticated_url = https_url.replace(
    "https://",
    `https://oauth2:${encodedToken}@`,
  )

  await git.removeRemote("origin")
  await git.addRemote("origin", authenticated_url)
}
