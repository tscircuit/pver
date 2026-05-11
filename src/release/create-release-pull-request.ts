import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"

type GitHubPullRequest = {
  html_url: string
}

const stripGitHubRefPrefix = (ref: string) =>
  ref.replace(/^refs\/heads\//, "").replace(/^origin\//, "")

const getBaseBranch = () =>
  stripGitHubRefPrefix(
    process.env.GITHUB_BASE_REF ||
      process.env.GITHUB_REF_NAME ||
      process.env.GITHUB_REF ||
      "main"
  )

const parseGitHubRepository = (remoteUrl: string) => {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY

  const sanitizedRemoteUrl = remoteUrl
    .trim()
    .replace(/^https:\/\/[^@]+@github\.com\//, "https://github.com/")
    .replace(/^git@github\.com:/, "https://github.com/")

  const match = sanitizedRemoteUrl.match(
    /github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/
  )

  if (!match) {
    throw new Error(
      `Unable to infer GitHub repository from origin remote: ${remoteUrl.trim()}`
    )
  }

  return `${match[1]}/${match[2]}`
}

const githubRequest = async <T>(
  repository: string,
  path: string,
  init: RequestInit = {}
): Promise<T> => {
  const token = process.env.GITHUB_TOKEN

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is required to create a release pull request"
    )
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.headers ?? {}),
      },
    }
  )

  if (!response.ok) {
    const responseBody = await response.text()
    throw new Error(
      `GitHub API request failed (${response.status} ${response.statusText}): ${responseBody}`
    )
  }

  return response.json() as Promise<T>
}

const findExistingPullRequest = async ({
  repository,
  branch,
  base,
}: {
  repository: string
  branch: string
  base: string
}) => {
  const [owner] = repository.split("/")
  const pullRequests = await githubRequest<GitHubPullRequest[]>(
    repository,
    `/pulls?state=open&head=${encodeURIComponent(
      `${owner}:${branch}`
    )}&base=${encodeURIComponent(base)}`
  )

  return pullRequests[0]
}

export const createReleasePullRequest = async (
  newVersion: string,
  ctx: AppContext
) => {
  const git: SimpleGit = simpleGit(ctx.current_directory)
  const base = getBaseBranch()
  const branch = ctx.release_branch ?? `pver/v${newVersion}`

  console.log(`Pushing release changes to ${branch}`)
  await configureOrigin(git)
  await git.push(["origin", `HEAD:${branch}`])

  const remoteUrl = await git.remote(["get-url", "origin"])
  if (!remoteUrl) throw new Error("Unable to read origin remote URL")

  const repository = parseGitHubRepository(remoteUrl)
  const existingPullRequest = await findExistingPullRequest({
    repository,
    branch,
    base,
  })

  if (existingPullRequest) {
    console.log(
      `Release pull request already exists: ${existingPullRequest.html_url}`
    )
    return
  }

  console.log(`Creating release pull request for ${branch} into ${base}`)
  const pullRequest = await githubRequest<GitHubPullRequest>(
    repository,
    "/pulls",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: ctx.release_pr_title ?? `Release v${newVersion}`,
        head: branch,
        base,
        body:
          ctx.release_pr_body ??
          [
            `Automated pver release for v${newVersion}.`,
            "",
            "This PR was created because `--push-main-strategy=pull-request` is enabled.",
          ].join("\n"),
      }),
    }
  )

  console.log(`Created release pull request: ${pullRequest.html_url}`)
}
