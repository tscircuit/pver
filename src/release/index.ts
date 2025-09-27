import { analyze } from "../analyze"
import { AppContext } from "../app-context"
import { stage } from "../stage"
import { npmPublish } from "./npm-publish"
import { pushGitTag } from "./push-git-tag"
import { pushToMain } from "./push-to-main"
import { syncWithRemote } from "./sync-with-remote"

export const release = async (ctx: AppContext) => {
  const analysis = await analyze(ctx)
  await stage(ctx)

  console.log(`Release methods enabled: ${ctx.release_methods.join(",")}`)

  // Always sync with remote to establish origin/main reference for workflows
  await syncWithRemote(ctx)

  if (ctx.release_methods.includes("git")) {
    await pushGitTag(`v${analysis.next_version}`, ctx)
  }

  if (ctx.release_methods.includes("npm")) {
    await npmPublish(ctx)
  }

  if (ctx.release_methods.includes("push-main")) {
    await pushToMain(ctx)
  }
}