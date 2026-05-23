/**
 * Configures the git remote origin with authentication for push operations.
 *
 * Supports PVER_GITHUB_TOKEN (takes precedence) and GITHUB_TOKEN.
 * PVER_GITHUB_TOKEN allows using a PAT or GitHub App token with branch
 * protection bypass permissions, enabling pushes to protected branches.
 *
 * Handles SSH -> HTTPS URL conversion for GitHub remotes.
 */
export const configureOrigin = async (git: any) => {
  const token = process.env.PVER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN

  if (!token) return

  let remote_url: string = (await git.remote(["get-url", "origin"])) ?? ""
  remote_url = remote_url.trim()

  // Convert SSH remote URLs to HTTPS
  // git@github.com:owner/repo.git -> https://github.com/owner/repo.git
  // ssh://git@github.com/owner/repo.git -> https://github.com/owner/repo.git
  if (remote_url.startsWith("ssh://git@")) {
    remote_url = remote_url.replace("ssh://git@", "https://")
  } else if (remote_url.includes("git@")) {
    remote_url = remote_url
      .replace(/git@([^:]+):/, "https://$1/")
  }

  // Strip any existing credentials from the URL before adding new ones
  remote_url = remote_url.replace(
    /https:\/\/[^@]+@/,
    "https://"
  )

  // Inject the token into the URL
  if (!remote_url.includes("oauth2:")) {
    const encoded_token = encodeURIComponent(token.trim())
    remote_url = remote_url.replace(
      "https://",
      `https://oauth2:${encoded_token}@`
    )
  }

  await git.removeRemote("origin")
  await git.addRemote("origin", remote_url)
}
