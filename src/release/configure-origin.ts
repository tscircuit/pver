export const configureOrigin = async (git: any) => {
  const token =
    process.env.PVER_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()
  if (!token) return

  let remote_url = (await git.remote(["get-url", "origin"])).trim()

  if (remote_url.startsWith("git@github.com:")) {
    remote_url = remote_url.replace(
      "git@github.com:",
      "https://github.com/",
    )
  } else if (remote_url.startsWith("ssh://git@github.com/")) {
    remote_url = remote_url.replace(
      "ssh://git@github.com/",
      "https://github.com/",
    )
  }

  const sanitizedUrl = remote_url.replace(
    /^https:\/\/(?:oauth2:)?[^@]+@/,
    "https://",
  )

  if (!sanitizedUrl.startsWith("https://")) return

  const authenticatedUrl = sanitizedUrl.replace(
    "https://",
    `https://oauth2:${token}@`,
  )

  if (authenticatedUrl !== remote_url) {
    await git.removeRemote("origin")
    await git.addRemote("origin", authenticatedUrl)
  }
}
