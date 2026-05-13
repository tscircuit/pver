const normalizeGithubRemoteUrl = (remoteUrl: string): string => {
  const trimmedUrl = remoteUrl.trim()

  const sshMatch = trimmedUrl.match(/^git@github\.com:(.+)$/)
  if (sshMatch) {
    return `https://github.com/${sshMatch[1]}`
  }

  const sshProtocolMatch = trimmedUrl.match(/^ssh:\/\/git@github\.com\/(.+)$/)
  if (sshProtocolMatch) {
    return `https://github.com/${sshProtocolMatch[1]}`
  }

  return trimmedUrl
}

const addGithubTokenToRemoteUrl = (remoteUrl: string, token: string): string => {
  const normalizedUrl = normalizeGithubRemoteUrl(remoteUrl)
  let url: URL

  try {
    url = new URL(normalizedUrl)
  } catch {
    return normalizedUrl
  }

  if (url.hostname !== "github.com") {
    return normalizedUrl
  }

  url.username = "x-access-token"
  url.password = token.trim()

  return url.toString().replace(/\/$/, "")
}

export const configureOrigin = async (git: any) => {
  const githubToken = process.env.PVER_GITHUB_TOKEN || process.env.GITHUB_TOKEN

  if (!githubToken) return

  const remoteUrl = await git.remote(["get-url", "origin"])
  const newUrl = addGithubTokenToRemoteUrl(remoteUrl, githubToken)

  if (newUrl === remoteUrl.trim()) return

  await git.removeRemote("origin")
  await git.addRemote("origin", newUrl)
}

export const __test__ = {
  normalizeGithubRemoteUrl,
  addGithubTokenToRemoteUrl,
}
