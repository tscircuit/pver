export const configureOrigin = async (git: any) => {
  const github_token = getGithubToken()
  if (!github_token) return

  const remote_url = await git.remote(["get-url", "origin"])
  const normalized_url = normalizeGithubRemoteUrl(remote_url)
  const authenticated_url = addGithubTokenToRemoteUrl(
    normalized_url,
    github_token
  )

  if (authenticated_url !== remote_url.trim()) {
    await git.removeRemote("origin")
    await git.addRemote("origin", authenticated_url)
  }
}

export const getGithubToken = () =>
  process.env.PVER_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

export const normalizeGithubRemoteUrl = (remote_url: string) => {
  const trimmed_url = remote_url.trim()

  return trimmed_url
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
}

export const addGithubTokenToRemoteUrl = (
  remote_url: string,
  github_token: string
) => {
  if (!remote_url.startsWith("https://github.com/")) {
    return remote_url
  }

  return remote_url.replace(
    "https://github.com/",
    `https://oauth2:${encodeURIComponent(github_token.trim())}@github.com/`
  )
}
