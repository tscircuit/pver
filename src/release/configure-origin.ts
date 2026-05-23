export const configureOrigin = async (git: any) => {
  const github_token = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

  if (github_token) {
    const remote_url = (await git.remote(["get-url", "origin"])).trim()

    // Normalize SSH remotes to HTTPS before injecting the token.
    const https_remote_url = remote_url
      .replace(/^git@github\.com:/, "https://github.com/")
      .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
      .replace(/^https:\/\/(?:oauth2:[^@]+@)?github\.com\//, "https://github.com/")

    const tokenized_remote_url = https_remote_url.replace(
      "https://github.com/",
      `https://oauth2:${github_token}@github.com/`
    )

    if (tokenized_remote_url !== remote_url) {
      await git.removeRemote("origin")
      await git.addRemote("origin", tokenized_remote_url)
    }
  }
}
