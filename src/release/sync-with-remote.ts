import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"
import { getBaseBranch } from "./get-branch-targets"

export const syncWithRemote = async (ctx: AppContext) => {
  const base_branch = getBaseBranch(ctx)
  console.log(`Syncing with remote ${base_branch}`)
  let git: SimpleGit = simpleGit(ctx.current_directory)

  await configureOrigin(git)

  // Pull the base branch and rebase to sync with remote
  // This establishes the origin/<base_branch> reference needed for workflows
  try {
    await git.pull("origin", base_branch, ["--rebase"])
  } catch (e: any) {
    if (e.toString().includes("unstaged changes")) {
      const status = await git.status()
      const changed_files = [
        ...status.not_added,
        ...status.created,
        ...status.deleted,
        ...status.modified,
        ...status.renamed.map((r) => r.to),
      ]
      if (changed_files.length) {
        console.error(
          "Cannot pull with rebase due to unstaged changes in the following files:"
        )
        for (const file of changed_files) {
          console.error(" -", file)
        }
      }
    }
    throw e
  }
}
