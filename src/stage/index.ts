import { makeGitTag } from "./make-git-tag"
import { analyze } from "../analyze"
import { AppContext } from "../app-context"
import { updatePackageJson } from "./update-package-json"
import { addCommitChanges } from "./add-commit-changes"
import { makeSureGitConfigured } from "./make-sure-git-configured"
import { updateReadme } from "./update-readme"

export const stage = async (ctx: AppContext) => {
  const analysis = await analyze(ctx)
  console.log(`current version: ${analysis.current_version}`)
  console.log(`next version: ${analysis.next_version}`)
  if (analysis.current_version === analysis.next_version) {
    throw new Error(
      `Next version is the same as current version, not releasing. Check the transition method if you expected a version bump`
    )
  }
  console.log("")
  console.log(`Using staging methods: ${ctx.release_methods.join(", ")}`)

  await makeSureGitConfigured(ctx)

  const files_to_add: string[] = []

  if (ctx.release_methods.includes("git")) {
    await makeGitTag(`v${analysis.next_version}`, ctx)
  }

  if (
    ctx.release_methods.includes("npm") ||
    ctx.release_methods.includes("package-json")
  ) {
    await updatePackageJson(analysis.next_version, ctx)
    files_to_add.push("package.json")
  }

  if (ctx.release_methods.includes("readme")) {
    const readme_files = await updateReadme(
      analysis.current_version,
      analysis.next_version,
      ctx
    )
    files_to_add.push(...readme_files)
  }

  await addCommitChanges(analysis.next_version, files_to_add, ctx)
}
