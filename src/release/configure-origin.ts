export const configureOrigin = async (git: any) => {
  const token = process.env.PVER_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (!token) return

  let remote_url = (await git.remote(["get-url", "origin"])) as string

  if (remote_url?.includes("git@")) {
    remote_url = remote_url
      .replace("git@github.com:", "https://github.com/")
      .replace("git@", "https://")
    await git.removeRemote("origin")
    await git.addRemote("origin", remote_url)
  }

  if (!remote_url?.includes("oauth2:")) {
    const new_url = remote_url.replace(
      "https://",
      `https://oauth2:${encodeURIComponent(token.trim())}@`
    )
    await git.removeRemote("origin")
    await git.addRemote("origin", new_url)
  }
}
