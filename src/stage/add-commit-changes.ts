import simpleGit from "simple-git"
import { AppContext } from "../app-context"

export const addCommitChanges = async (
  new_version: string,
  files_to_add: string[],
  ctx: AppContext
) => {
  const files = [...new Set(files_to_add)]

  if (files.length === 0) {
    console.log("No file changes to commit, skipping commit step")
    return
  }

  console.log("Adding files and committing changes")
  const git = simpleGit(ctx.current_directory)

  await git.add(files)

  await git.commit(`v${new_version}`)
}
