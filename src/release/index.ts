import { analyze } from "../analyze"
import { AppContext } from "../app-context"
import { stage } from "../stage"
import { makeGitTag } from "../stage/make-git-tag"
import { npmPublish } from "./npm-publish"
import { pushGitTag } from "./push-git-tag"
import { pushToMain } from "./push-to-main"
import { syncWithRemote } from "./sync-with-remote"

export const release = async (ctx: AppContext) => {
  const analysis = await analyze(ctx)
  // Defer tagging until after syncWithRemote so the tag lands on the
  // post-rebase commit SHA, not an orphaned pre-rebase one.
  await stage(ctx, { skipTag: true })

  console.log(`Release methods enabled: ${ctx.release_methods.join(",")}`)

  // Always sync with remote to establish origin/main reference for workflows
  await syncWithRemote(ctx)

  if (ctx.release_methods.includes("git")) {
    await makeGitTag(`v${analysis.next_version}`, ctx)
    await pushGitTag(`v${analysis.next_version}`, ctx)
  }

  if (ctx.release_methods.includes("npm")) {
    await npmPublish(ctx)
  }

  if (ctx.release_methods.includes("push-main")) {
    await pushToMain(ctx)
  }
}