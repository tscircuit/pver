import { AppContext } from "../../app-context"
import simpleGit from "simple-git"

export const getLastCommitAlteringPackageJsonVersion = async (
  ctx: AppContext
): Promise<string | null> => {
  const git = simpleGit(ctx.current_directory)
  const log = await git.log({ file: "package.json" })
  console.log(`Detected ${log.all.length} commits altering package.json`)

  if (!log.latest) return null

  // Return the hash of the first commit that changed the version line
  // To do this, you must load the commit diff for each commit
  for (const commit of log.all) {
    const diff = await git.show(["-U0", commit.hash, "--", "package.json"])
    if (diff.includes('"version":')) return commit.hash
  }

  return null
}
