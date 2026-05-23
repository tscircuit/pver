import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"
import fs from "fs/promises"
import path from "path"

interface GitHubFile {
  path: string
  content: string
  sha?: string
}

/**
 * Push changes to main branch using GitHub API.
 * This method works even when the branch is protected because GitHub Actions
 * GITHUB_TOKEN can update files via API even on protected branches.
 */
export const pushToMainViaApi = async (ctx: AppContext) => {
  console.log("Pushing to main via GitHub API (for protected branch support)")

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error("GITHUB_TOKEN is required for API-based push")
  }

  // Get repository info from environment or git remote
  const git: SimpleGit = simpleGit(ctx.current_directory)
  const remoteUrlRaw = await git.remote(["get-url", "origin"])
  const remoteUrl = typeof remoteUrlRaw === "string" ? remoteUrlRaw : ""
  
  // Parse owner/repo from remote URL
  let owner: string, repo: string
  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\n]+)/)
  const sshMatch = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/\n]+)/)
  
  if (httpsMatch) {
    owner = httpsMatch[1]
    repo = httpsMatch[2].replace(/\.git$/, "")
  } else if (sshMatch) {
    owner = sshMatch[1]
    repo = sshMatch[2].replace(/\.git$/, "")
  } else {
    throw new Error(`Could not parse owner/repo from remote URL: ${remoteUrl}`)
  }

  console.log(`Target repository: ${owner}/${repo}`)

  // Get the current branch name
  const branch = process.env.GITHUB_REF_NAME ?? 
    (process.env.GITHUB_REF ? process.env.GITHUB_REF.replace("refs/heads/", "") : "main")
  
  console.log(`Target branch: ${branch}`)

  // Get list of changed files
  const status = await git.status()
  const changedFiles = [...status.staged, ...status.modified, ...status.created]
  
  if (changedFiles.length === 0) {
    console.log("No files to commit")
    return
  }

  console.log(`Files to update: ${changedFiles.join(", ")}`)

  // Get the latest commit message
  const log = await git.log(["-1"])
  const commitMessage = log.latest?.message ?? "Update files via pver"

  // For each changed file, update via GitHub API
  for (const filePath of changedFiles) {
    const fullPath = path.join(ctx.current_directory ?? ".", filePath)
    
    try {
      const content = await fs.readFile(fullPath, "utf-8")
      const base64Content = Buffer.from(content).toString("base64")

      // Get current file SHA (if exists)
      let sha: string | undefined
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        )
        if (response.ok) {
          const data = await response.json() as { sha: string }
          sha = data.sha
        }
      } catch (e) {
        // File doesn't exist yet, that's fine
      }

      // Update or create the file
      const updateResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: commitMessage,
            content: base64Content,
            sha,
            branch,
          }),
        }
      )

      if (!updateResponse.ok) {
        const error = await updateResponse.text()
        throw new Error(`Failed to update ${filePath}: ${updateResponse.status} ${error}`)
      }

      console.log(`✓ Updated ${filePath}`)
    } catch (e) {
      console.error(`Failed to update ${filePath}:`, e)
      throw e
    }
  }

  console.log("Successfully pushed all files via GitHub API")
}

/**
 * Try git push first, fallback to GitHub API if branch is protected.
 */
export const pushToMainWithFallback = async (ctx: AppContext) => {
  console.log("Pushing to main (with protected branch fallback)")
  
  let git: SimpleGit = simpleGit(ctx.current_directory)
  await configureOrigin(git)
  
  const branch = process.env.GITHUB_REF ?? "main"
  
  try {
    // Try regular git push first
    await git.push(["origin", `HEAD:${branch}`])
    console.log("Successfully pushed via git")
  } catch (error: any) {
    const errorMessage = error.message || String(error)
    
    // Check if the error is due to branch protection
    if (
      errorMessage.includes("protected") ||
      errorMessage.includes("required status checks") ||
      errorMessage.includes("required pull request reviews") ||
      errorMessage.includes("403")
    ) {
      console.log("Branch is protected, falling back to GitHub API method")
      await pushToMainViaApi(ctx)
    } else {
      // Re-throw if it's a different error
      throw error
    }
  }
}
