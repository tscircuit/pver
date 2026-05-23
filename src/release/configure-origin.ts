export const configureOrigin = async (git: any) => {
  const github_token = process.env.PVER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN

  if (github_token) {
    // This doesn't work- it's possible the checkout command needs to use the
    // github token (in the workflow yaml)
    let remote_url = (await git.remote(["get-url", "origin"])) as string

    // if the remote is in the form of git@github.com:foo/bar.git, convert it to
    // https://github.com/foo/bar.git
    if (remote_url.includes("git@")) {
      remote_url = remote_url
        .replace("git@github.com:", "https://github.com/")
        .replace(/\n/g, "")
      await git.removeRemote("origin")
      await git.addRemote("origin", remote_url)
    }

    if (!remote_url.includes("oauth2:")) {
      const new_url = remote_url
        .replace("https://", `https://oauth2:${github_token.trim()}@`)
        .replace(/\n/g, "")
      await git.removeRemote("origin")
      await git.addRemote("origin", new_url)
    }
  }
}
