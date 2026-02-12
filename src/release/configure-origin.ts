export const configureOrigin = async (git: any) => {
  // PVER_GITHUB_TOKEN takes priority over GITHUB_TOKEN.
  // Use a PAT or GitHub App installation token in PVER_GITHUB_TOKEN
  // to push to protected branches (the default GITHUB_TOKEN cannot
  // bypass branch protection rules).
  const token =
    process.env.PVER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN

  if (token) {
    const remote_url = await git.remote(["get-url", "origin"])

    // if the remote is in the form of git@github.com:foo/bar.git, convert it to
    // https://github.com/foo/bar.git
    if (remote_url.includes("git@")) {
      const new_url = remote_url!
        .replace("git@", "https://")
        .replace(/\.com:/, ".com/")
      await git.removeRemote("origin")
      await git.addRemote("origin", new_url)
    }

    if (!remote_url.includes("oauth2:")) {
      const new_url = remote_url!
        .replace(
          "https://",
          `https://oauth2:${token.trim()}@`
        )
        .replace(/\n/g, "")
      await git.removeRemote("origin")
      await git.addRemote("origin", new_url)
    }
  }
}
