const sanitizeRemoteUrl = (remoteUrl: string) =>
  remoteUrl.trim().replace(/\n/g, "")

export const normalizeGithubRemoteUrl = (remoteUrl: string) => {
  const sanitizedRemoteUrl = sanitizeRemoteUrl(remoteUrl)

  const scpSshMatch = sanitizedRemoteUrl.match(/^git@github\.com:(.+)$/)
  if (scpSshMatch) {
    return `https://github.com/${scpSshMatch[1]}`
  }

  const sshUrlMatch = sanitizedRemoteUrl.match(/^ssh:\/\/git@github\.com\/(.+)$/)
  if (sshUrlMatch) {
    return `https://github.com/${sshUrlMatch[1]}`
  }

  const githubHttpsMatch = sanitizedRemoteUrl.match(
    /^https:\/\/(?:[^/@]+(?::[^/@]*)?@)?github\.com\/(.+)$/
  )
  if (githubHttpsMatch) {
    return `https://github.com/${githubHttpsMatch[1]}`
  }

  return sanitizedRemoteUrl
}

export const getAuthenticatedOriginUrl = (
  remoteUrl: string,
  githubToken: string
) => {
  const normalizedRemoteUrl = normalizeGithubRemoteUrl(remoteUrl)
  const sanitizedToken = githubToken.trim()

  if (
    !sanitizedToken ||
    !normalizedRemoteUrl.startsWith("https://github.com/")
  ) {
    return normalizedRemoteUrl
  }

  return normalizedRemoteUrl.replace(
    "https://github.com/",
    `https://oauth2:${encodeURIComponent(sanitizedToken)}@github.com/`
  )
}

export const getReleaseGithubToken = () =>
  process.env.PVER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN

export const configureOrigin = async (git: any) => {
  const githubToken = getReleaseGithubToken()
  if (!githubToken) return

  const remoteUrl = await git.remote(["get-url", "origin"])
  const newUrl = getAuthenticatedOriginUrl(remoteUrl, githubToken)

  if (newUrl === sanitizeRemoteUrl(remoteUrl)) return

  await git.removeRemote("origin")
  await git.addRemote("origin", newUrl)
}
