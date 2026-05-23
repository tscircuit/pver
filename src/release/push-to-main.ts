import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"
import { pushToMainViaApi, pushToMainWithFallback } from "./push-to-main-via-api"

/**
 * Push to main branch with automatic fallback to GitHub API for protected branches.
 * 
 * This function first attempts a regular git push. If the push fails due to
 * branch protection rules, it automatically falls back to using the GitHub API
 * to update files, which can bypass branch protection when using GITHUB_TOKEN
 * from GitHub Actions.
 * 
 * To enable this behavior, ensure:
 * 1. GITHUB_TOKEN is set (automatically available in GitHub Actions)
 * 2. Your workflow has appropriate permissions (contents: write)
 * 3. Branch protection allows GitHub Actions to bypass (optional but recommended)
 */
export const pushToMain = async (ctx: AppContext) => {
  console.log("Pushing to main")
  
  // Use fallback method which handles protected branches automatically
  await pushToMainWithFallback(ctx)
}

// Export additional methods for direct use
export { pushToMainViaApi, pushToMainWithFallback }
