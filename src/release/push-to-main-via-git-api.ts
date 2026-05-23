import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"

interface GitHubApiResponse {
  sha?: string
  tree?: { sha: string }
  object?: { sha: string }
  message?: string
}

/**
 * Push changes to a protected branch using GitHub's Git Data API.
 * This bypasses branch protection rules when using a token with appropriate permissions.
 * 
 * The Git Data API flow:
 * 1. GET current branch ref to get the current commit SHA
 * 2. GET current commit to get the tree SHA
 * 3. GET current tree to understand the file structure
 * 4. Create new tree with changes (reusing existing tree as base)
 * 5. Create new commit pointing to new tree
 * 6. Update branch ref to point to new commit
 */
export const pushToMainViaGitApi = async (ctx: AppContext) => {
  console.log("Pushing to main via GitHub Git Data API")
  
  const git: SimpleGit = simpleGit(ctx.current_directory)
  
  // Get GitHub token (prefer PVER_GITHUB_TOKEN over GITHUB_TOKEN)
  const token = process.env.PVER_GITHUB_TOKEN || process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error(
      "PVER_GITHUB_TOKEN or GITHUB_TOKEN environment variable is required for Git Data API push"
    )
  }

  // Get repository information from git remote
  const remoteUrl = await git.remote(["get-url", "origin"])
  
  if (!remoteUrl) {
    throw new Error("Could not get remote URL from git")
  }
  
  const repoMatch = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?/)
  
  if (!repoMatch) {
    throw new Error(`Could not parse GitHub repository from remote URL: ${remoteUrl}`)
  }
  
  const owner = repoMatch[1]
  const repo = repoMatch[2]
  const branch = process.env.GITHUB_REF?.replace("refs/heads/", "") ?? "main"
  
  console.log(`Repository: ${owner}/${repo}, Branch: ${branch}`)

  // Get the current HEAD commit SHA (local)
  const headCommit = await git.revparse(["HEAD"])
  const commitSha = headCommit.trim()
  
  console.log(`Current HEAD commit: ${commitSha}`)

  // Get commit details to extract tree, author, and message
  const commitDetails = await git.show([
    commitSha,
    "--format=%H%n%T%n%an%n%ae%n%at%n%s%n%b",
    "--no-patch"
  ])
  
  const lines = commitDetails.split("\n")
  const treeSha = lines[1]
  const authorName = lines[2]
  const authorEmail = lines[3]
  const authorTimestamp = lines[4]
  const commitMessage = lines.slice(5).join("\n").trim()
  
  console.log(`Commit tree: ${treeSha}`)
  console.log(`Commit message: ${commitMessage}`)

  // Get the current branch ref from GitHub to find parent commit
  const refUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`
  const refResponse = await fetch(refUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "pver-git-data-api"
    }
  })

  if (!refResponse.ok) {
    const errorText = await refResponse.text()
    throw new Error(
      `Failed to get branch ref: ${refResponse.status} ${refResponse.statusText}\n${errorText}`
    )
  }

  const refData = (await refResponse.json()) as GitHubApiResponse
  const parentCommitSha = refData.object?.sha
  
  if (!parentCommitSha) {
    throw new Error("Could not determine parent commit SHA from branch ref")
  }
  
  console.log(`Parent commit on GitHub: ${parentCommitSha}`)

  // Create a new tree (reusing the local tree structure)
  // We need to get the tree from the local commit
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}`
  const treeResponse = await fetch(treeUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "pver-git-data-api"
    }
  })

  if (!treeResponse.ok) {
    // Tree might not exist on remote yet, we need to create it
    // For simplicity, we'll create a new tree based on parent's tree
    console.log("Local tree not found on remote, creating new tree from changes")
    
    // Get parent tree
    const parentCommitUrl = `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentCommitSha}`
    const parentCommitResponse = await fetch(parentCommitUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "pver-git-data-api"
      }
    })
    
    if (!parentCommitResponse.ok) {
      throw new Error(`Failed to get parent commit: ${parentCommitResponse.status}`)
    }
    
    const parentCommitData = (await parentCommitResponse.json()) as GitHubApiResponse
    const parentTreeSha = parentCommitData.tree?.sha
    
    if (!parentTreeSha) {
      throw new Error("Could not get parent tree SHA")
    }

    // Get the diff between parent and current commit
    const diffFiles = await git.diff([
      `${parentCommitSha}..${commitSha}`,
      "--name-only"
    ])
    
    const changedFiles = diffFiles.split("\n").filter(f => f.trim().length > 0)
    console.log(`Changed files: ${changedFiles.join(", ")}`)

    // Create blobs for each changed file
    const treeItems = []
    for (const filePath of changedFiles) {
      try {
        // Get file content from local git
        const fileContent = await git.show([`${commitSha}:${filePath}`])
        
        // Create blob on GitHub
        const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs`
        const blobResponse = await fetch(blobUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "pver-git-data-api"
          },
          body: JSON.stringify({
            content: fileContent,
            encoding: "utf-8"
          })
        })

        if (!blobResponse.ok) {
          const errorText = await blobResponse.text()
          throw new Error(
            `Failed to create blob for ${filePath}: ${blobResponse.status}\n${errorText}`
          )
        }

        const blobData = (await blobResponse.json()) as GitHubApiResponse
        
        treeItems.push({
          path: filePath,
          mode: "100644",
          type: "blob",
          sha: blobData.sha
        })
        
        console.log(`Created blob for ${filePath}: ${blobData.sha}`)
      } catch (error) {
        console.warn(`Warning: Could not process file ${filePath}:`, error)
      }
    }

    // Create new tree based on parent tree with our changes
    const newTreeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees`
    const newTreeResponse = await fetch(newTreeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "pver-git-data-api"
      },
      body: JSON.stringify({
        base_tree: parentTreeSha,
        tree: treeItems
      })
    })

    if (!newTreeResponse.ok) {
      const errorText = await newTreeResponse.text()
      throw new Error(
        `Failed to create tree: ${newTreeResponse.status}\n${errorText}`
      )
    }

    const newTreeData = (await newTreeResponse.json()) as GitHubApiResponse
    const newTreeSha = newTreeData.sha
    
    console.log(`Created new tree: ${newTreeSha}`)

    // Create new commit
    const newCommitUrl = `https://api.github.com/repos/${owner}/${repo}/git/commits`
    const newCommitResponse = await fetch(newCommitUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "pver-git-data-api"
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [parentCommitSha],
        author: {
          name: authorName,
          email: authorEmail,
          date: new Date(parseInt(authorTimestamp) * 1000).toISOString()
        }
      })
    })

    if (!newCommitResponse.ok) {
      const errorText = await newCommitResponse.text()
      throw new Error(
        `Failed to create commit: ${newCommitResponse.status}\n${errorText}`
      )
    }

    const newCommitData = (await newCommitResponse.json()) as GitHubApiResponse
    const newCommitSha = newCommitData.sha
    
    console.log(`Created new commit: ${newCommitSha}`)

    // Update branch ref to point to new commit
    const updateRefUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`
    const updateRefResponse = await fetch(updateRefUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "pver-git-data-api"
      },
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    })

    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text()
      throw new Error(
        `Failed to update branch ref: ${updateRefResponse.status}\n${errorText}`
      )
    }

    console.log(`Successfully updated ${branch} to ${newCommitSha}`)
  } else {
    // Tree exists on remote, we can use it directly
    console.log("Tree exists on remote, creating commit with existing tree")
    
    // Create new commit with existing tree
    const newCommitUrl = `https://api.github.com/repos/${owner}/${repo}/git/commits`
    const newCommitResponse = await fetch(newCommitUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "pver-git-data-api"
      },
      body: JSON.stringify({
        message: commitMessage,
        tree: treeSha,
        parents: [parentCommitSha],
        author: {
          name: authorName,
          email: authorEmail,
          date: new Date(parseInt(authorTimestamp) * 1000).toISOString()
        }
      })
    })

    if (!newCommitResponse.ok) {
      const errorText = await newCommitResponse.text()
      throw new Error(
        `Failed to create commit: ${newCommitResponse.status}\n${errorText}`
      )
    }

    const newCommitData = (await newCommitResponse.json()) as GitHubApiResponse
    const newCommitSha = newCommitData.sha
    
    console.log(`Created new commit: ${newCommitSha}`)

    // Update branch ref
    const updateRefUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`
    const updateRefResponse = await fetch(updateRefUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "pver-git-data-api"
      },
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    })

    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text()
      throw new Error(
        `Failed to update branch ref: ${updateRefResponse.status}\n${errorText}`
      )
    }

    console.log(`Successfully updated ${branch} to ${newCommitSha}`)
  }
}
