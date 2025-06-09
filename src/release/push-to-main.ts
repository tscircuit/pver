import simpleGit, { SimpleGit } from "simple-git"
import { AppContext } from "../app-context"
import { configureOrigin } from "./configure-origin"

export const pushToMain = async (ctx: AppContext) => {
  console.log("Pushing to main")
  let git: SimpleGit = simpleGit(ctx.current_directory)

  await configureOrigin(git)

  // sometimes when pushing to main we get an error that we need to integrate
  // remote changes first, let's pull main and rebase
  try {
    await git.pull("origin", "main", ["--rebase"])
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

  await git.push(["origin", `HEAD:${process.env.GITHUB_REF ?? "main"}`])
}
