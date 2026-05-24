export const getReleaseGithubToken = () =>
  process.env.PVER_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

export const getAuthenticatedGithubOriginUrl = (
  remoteUrl: string,
  token: string
) => {
  const trimmedRemoteUrl = remoteUrl.trim()

  let normalizedUrl = trimmedRemoteUrl
  if (normalizedUrl.startsWith("git@github.com:")) {
    normalizedUrl = normalizedUrl.replace("git@github.com:", "https://github.com/")
  } else if (normalizedUrl.startsWith("ssh://git@github.com/")) {
    normalizedUrl = normalizedUrl.replace(
      "ssh://git@github.com/",
      "https://github.com/"
    )
  }

  if (!normalizedUrl.startsWith("https://github.com/")) {
    normalizedUrl = normalizedUrl.replace(
      /^https:\/\/[^@]+@github\.com\//,
      "https://github.com/"
    )
  }

  if (!normalizedUrl.startsWith("https://github.com/")) return trimmedRemoteUrl

  return normalizedUrl.replace(
    "https://github.com/",
    `https://oauth2:${encodeURIComponent(token.trim())}@github.com/`
  )
}

export const configureOrigin = async (git: any) => {
  const token = getReleaseGithubToken()
  if (!token) return

  const remoteUrl = await git.remote(["get-url", "origin"])
  const authenticatedOriginUrl = getAuthenticatedGithubOriginUrl(remoteUrl, token)

  if (authenticatedOriginUrl === remoteUrl.trim()) return

  await git.remote(["set-url", "origin", authenticatedOriginUrl])
}
