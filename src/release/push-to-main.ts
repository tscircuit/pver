import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"

/**
 * Try to push directly to main. If the branch is protected (push rejected),
 * fall back to creating a Pull Request via GitHub API.
 */
export const pushToMain = async (ctx: AppContext) => {
  console.log("Pushing to main")
  let git: SimpleGit = simpleGit(ctx.current_directory)

  await configureOrigin(git)

  const targetBranch = process.env.GITHUB_REF ?? "main"

  try {
    await git.push(["origin", `HEAD:${targetBranch}`])
  } catch (err: any) {
    const errorMsg = err?.toString() ?? ""
    if (
      errorMsg.includes("protected branch") ||
      errorMsg.includes("protected") ||
      errorMsg.includes("GH006") ||
      errorMsg.includes("push declined")
    ) {
      console.log(
        "Direct push to main rejected (branch protection). Creating pull request instead."
      )
      await createPullRequestFromCurrentBranch(git, ctx, targetBranch)
    } else {
      throw err
    }
  }
}

async function createPullRequestFromCurrentBranch(
  git: SimpleGit,
  ctx: AppContext,
  targetBranch: string
) {
  const currentBranch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim()

  // If we're already on a non-main branch, push there and create a PR
  // If we're on main, create a temporary release branch
  const prBranch =
    currentBranch === targetBranch
      ? `release/${Date.now()}`
      : currentBranch

  if (prBranch !== currentBranch) {
    await git.checkoutLocalBranch(prBranch)
  }

  console.log(`Pushing to branch: ${prBranch}`)
  await git.push(["origin", prBranch])

  // Create PR using gh CLI or GitHub API
  const repoUrl = await git.remote(["get-url", "origin"]).catch(() => "")
  const repoPath = extractRepoPath(repoUrl)

  if (repoPath) {
    const prTitle = "chore: release version update"
    const prBody =
      "Automated release by pver. This PR updates version files and tags."

    // Try gh CLI first, then fall back to GitHub API
    try {
      const { execSync } = await import("child_process")
      const result = execSync(
        `gh pr create --repo "${repoPath}" --head "${prBranch}" --base "${targetBranch}" --title "${prTitle}" --body "${prBody}"`,
        { encoding: "utf-8", timeout: 30000 }
      )
      console.log(`Pull request created: ${result.trim()}`)
    } catch {
      // Fall back to GitHub API
      const githubToken =
        process.env.GITHUB_TOKEN ||
        process.env.GH_TOKEN ||
        ""

      if (!githubToken) {
        console.error(
          "Cannot create pull request: no GITHUB_TOKEN or GH_TOKEN found."
        )
        process.exit(1)
      }

      const { execSync } = await import("child_process")
      const apiUrl = `https://api.github.com/repos/${repoPath}/pulls`
      const payload = JSON.stringify({
        title: prTitle,
        head: prBranch,
        base: targetBranch,
        body: prBody,
      })
      try {
        const result = execSync(
          `curl -s -X POST "${apiUrl}" \
            -H "Authorization: Bearer ${githubToken}" \
            -H "Content-Type: application/json" \
            -d '${payload}'`,
          { encoding: "utf-8", timeout: 15000 }
        )
        const response = JSON.parse(result)
        if (response.html_url) {
          console.log(`Pull request created: ${response.html_url}`)
        } else {
          console.error("Failed to create pull request:", response.message ?? result)
          process.exit(1)
        }
      } catch (apiErr) {
        console.error("Failed to create pull request via API:", apiErr)
        process.exit(1)
      }
    }
  } else {
    console.error(
      "Cannot create pull request: could not determine repository path from remote URL"
    )
    process.exit(1)
  }
}

function extractRepoPath(remoteUrl: string | string[]): string | null {
  const url = Array.isArray(remoteUrl) ? remoteUrl[0] : remoteUrl
  if (!url) return null

  // Handle https://github.com/owner/repo.git
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`

  // Handle git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`

  return null
}
