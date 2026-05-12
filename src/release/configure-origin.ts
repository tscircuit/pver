const getAuthenticatedRemoteUrl = (remoteUrl: string, token: string) => {
  let url = remoteUrl.trim()

  if (url.startsWith("git@github.com:")) {
    url = url.replace("git@github.com:", "https://github.com/")
  }

  if (!url.startsWith("https://") || url.includes("@")) {
    return url
  }

  const encodedToken = encodeURIComponent(token)

  if (url.startsWith("https://github.com/")) {
    return url.replace("https://", `https://x-access-token:${encodedToken}@`)
  }

  return url.replace("https://", `https://oauth2:${encodedToken}@`)
}

export const configureOrigin = async (git: any) => {
  const githubToken = process.env.PVER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN

  if (!githubToken) return

  const remoteUrl = await git.remote(["get-url", "origin"])
  const authenticatedRemoteUrl = getAuthenticatedRemoteUrl(remoteUrl, githubToken)

  if (authenticatedRemoteUrl !== remoteUrl.trim()) {
    await git.removeRemote("origin")
    await git.addRemote("origin", authenticatedRemoteUrl)
  }
}
