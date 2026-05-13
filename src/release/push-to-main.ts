import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"
import { pushToMainViaGitApi } from "./push-to-main-via-git-api"

export const pushToMain = async (ctx: AppContext) => {
  console.log("Pushing to main")
  
  // If --push-via-api flag is set, use Git Data API directly
  if (ctx.push_via_api) {
    console.log("Using Git Data API (--push-via-api flag set)")
    await pushToMainViaGitApi(ctx)
    return
  }
  
  // Otherwise, try normal git push first
  let git: SimpleGit = simpleGit(ctx.current_directory)

  await configureOrigin(git)

  try {
    await git.push(["origin", `HEAD:${process.env.GITHUB_REF ?? "main"}`])
    console.log("Successfully pushed via git")
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || ""
    
    // Check if the error is related to protected branch
    const isProtectedBranchError = 
      errorMessage.includes("protected branch") ||
      errorMessage.includes("branch protection") ||
      errorMessage.includes("required status check") ||
      errorMessage.includes("cannot be pushed to") ||
      errorMessage.includes("GH006") ||
      errorMessage.includes("GH007")
    
    if (isProtectedBranchError) {
      console.log("Git push failed due to branch protection, falling back to Git Data API")
      console.log(`Error was: ${errorMessage}`)
      
      // Fall back to Git Data API
      await pushToMainViaGitApi(ctx)
    } else {
      // Re-throw if it's not a protected branch error
      throw error
    }
  }
}
