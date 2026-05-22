const getGithubToken = () =>
  process.env.PVER_GITHUB_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim()

const normalizeGithubRemoteUrl = (remote_url: string) => {
  if (remote_url.startsWith("git@github.com:")) {
    return remote_url.replace("git@github.com:", "https://github.com/")
  }

  if (remote_url.startsWith("ssh://git@github.com/")) {
    return remote_url.replace("ssh://git@github.com/", "https://github.com/")
  }

  return remote_url
}

const addTokenToGithubRemoteUrl = (remote_url: string, token: string) => {
  if (
    !remote_url.startsWith("https://github.com/") &&
    !remote_url.startsWith("https://oauth2:") &&
    !remote_url.includes("@github.com/")
  ) {
    return remote_url
  }

  return remote_url.replace(
    /^https:\/\/(?:[^/@]+@)?github\.com\//,
    `https://oauth2:${token}@github.com/`
  )
}

export const configureOrigin = async (git: any) => {
  const github_token = getGithubToken()
  if (!github_token) return

  const remote_url = (await git.remote(["get-url", "origin"])).trim()
  const new_url = addTokenToGithubRemoteUrl(
    normalizeGithubRemoteUrl(remote_url),
    github_token
  )

  if (new_url === remote_url) return

  await git.removeRemote("origin")
  await git.addRemote("origin", new_url)
}
