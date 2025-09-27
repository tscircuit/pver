import fs from "fs/promises"

/**
 * The AppContext stores directory, arg, flag and config information and is
 * passed around to most functions.
 *
 * You should add anything to the Context that is shared between functions but
 * nothing that is specific to a particular command.
 *
 * Everything in the context should be strictly defined, no "auto" or
 * semi-structured types etc.
 */
export type ReleaseMethod =
  | "git"
  | "npm"
  | "push-main"
  | "readme"
  | "package-json"
  | "no-push-main"

export type AppContext = {
  current_directory?: string

  current_method: "auto" | "package.json"
  transition_method: "auto" | "simplegit"
  release_methods: Array<ReleaseMethod>
  readme_files: string[]
}

export const getAppContext = async ({
  argv,
  has_package_json,
  has_git_dir,
}: {
  argv: Record<string, any>
  has_package_json?: boolean
  has_git_dir?: boolean
}) => {
  const release_methods: Array<ReleaseMethod> = argv.release_methods ?? []
  const readme_files: string[] = []

  if (argv.git) release_methods.push("git")
  if (argv.npm) release_methods.push("npm")
  if (argv.pushMain && !argv.noPushMain) release_methods.push("push-main")
  if (argv.readme) release_methods.push("readme")
  if (argv.packageJson) release_methods.push("package-json")

  if (argv.mdfile) {
    const mdfiles = Array.isArray(argv.mdfile) ? argv.mdfile : [argv.mdfile]
    for (const file of mdfiles) {
      if (typeof file === "string" && file.trim().length > 0) {
        readme_files.push(file)
      }
    }
  }

  if (argv.readme && readme_files.length === 0) {
    readme_files.push("README.md", "README.txt", "readme.md", "readme.txt")
  }

  if (has_git_dir === undefined) {
    has_git_dir = await fs
      .stat(".git")
      .then(() => true)
      .catch((e) => false)
    has_package_json = await fs
      .stat("package.json")
      .then(() => true)
      .catch((e) => false)
  }

  if (release_methods.length === 0) {
    // automatically determine release methods
    if (has_git_dir) {
      release_methods.push("git")
      if (!argv.noPushMain) {
        release_methods.push("push-main")
      }
    }
    if (has_package_json) release_methods.push("npm")
  }

  return {
    current_directory: process.cwd(),
    current_method: argv.current ?? "auto",
    transition_method: argv.transition ?? "auto",
    release_methods: [...new Set(release_methods)],
    readme_files: [...new Set(readme_files)],
  }
}
