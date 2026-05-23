import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"
import { getPushBranch } from "./get-branch-targets"

export const pushToMain = async (ctx: AppContext) => {
  const push_branch = getPushBranch(ctx)
  console.log(`Pushing to ${push_branch}`)
  let git: SimpleGit = simpleGit(ctx.current_directory)

  await configureOrigin(git)

  await git.push(["origin", `HEAD:${push_branch}`])
}
