export const configureOrigin = async (git: any) => {
  // PVER_GITHUB_TOKEN takes precedence over GITHUB_TOKEN
  // Use a PAT or GitHub App token with branch protection bypass permissions
  const token = process.env.PVER_GITHUB_TOKEN || process.env.GITHUB_TOKEN

  if (token) {
    let remote_url: string = await git.remote(["get-url", "origin"])
    remote_url = remote_url.replace(/\n/g, "").trim()

    // Convert SSH remote URL to HTTPS format
    // git@github.com:owner/repo.git → https://github.com/owner/repo.git
    if (remote_url.includes("git@")) {
      remote_url = remote_url
        .replace(/git@([^:]+):/, "https://$1/")
    }

    // Inject token for authentication if not already present
    if (!remote_url.includes("oauth2:")) {
      remote_url = remote_url.replace(
        "https://",
        `https://oauth2:${token}@`
      )
    }

    await git.removeRemote("origin")
    await git.addRemote("origin", remote_url)
  }
}
