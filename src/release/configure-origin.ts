const getGithubToken = () =>
  process.env.PVER_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

const normalizeGithubRemoteUrl = (remote_url: string) =>
  remote_url
    .trim()
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
    .replace(/^https:\/\/[^@]+@github\.com\//, "https://github.com/")

const addTokenToGithubRemoteUrl = (remote_url: string, token: string) => {
  const normalized_remote_url = normalizeGithubRemoteUrl(remote_url)

  if (!normalized_remote_url.startsWith("https://github.com/")) {
    return remote_url.trim()
  }

  return normalized_remote_url.replace(
    "https://github.com/",
    `https://oauth2:${token}@github.com/`
  )
}

export const configureOrigin = async (git: any) => {
  const token = getGithubToken()
  if (!token) return

  const remote_url = await git.remote(["get-url", "origin"])
  const new_url = addTokenToGithubRemoteUrl(remote_url, token)

  if (new_url !== remote_url.trim()) {
    await git.removeRemote("origin")
    await git.addRemote("origin", new_url)
  }
}
