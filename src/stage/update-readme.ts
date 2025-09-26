import fs from "fs/promises"
import path from "path"
import { AppContext } from "../app-context"

const escapeRegExp = (input: string) => {
  const specials = new Set(".*+?^${}()|[]\\".split(""))
  let escaped = ""
  for (const char of input) {
    if (specials.has(char)) {
      escaped += `\\${char}`
    } else {
      escaped += char
    }
  }
  return escaped
}

export const updateReadme = async (
  current_version: string,
  next_version: string,
  ctx: AppContext
): Promise<string[]> => {
  const updated_files: string[] = []
  if (ctx.readme_files.length === 0) return updated_files

  const root = ctx.current_directory ?? process.cwd()
  const replacements: Array<[RegExp, string]> = [
    [new RegExp(escapeRegExp(`v${current_version}`), "g"), `v${next_version}`],
    [new RegExp(escapeRegExp(current_version), "g"), next_version],
  ]

  const missing_files: string[] = []
  const files_without_version: string[] = []

  for (const file of ctx.readme_files) {
    const absolute_path = path.isAbsolute(file)
      ? file
      : path.join(root, file)

    let original: string
    try {
      original = await fs.readFile(absolute_path, "utf8")
    } catch (error: any) {
      if (error && error.code === "ENOENT") {
        missing_files.push(file)
        continue
      }
      throw new Error(`Failed to read README file ${file}: ${error}`)
    }

    let updated = original
    for (const [pattern, replacement] of replacements) {
      updated = updated.replace(pattern, replacement)
    }

    if (updated === original) {
      files_without_version.push(file)
      continue
    }

    await fs.writeFile(absolute_path, updated)

    const relative_path = path.relative(root, absolute_path) || path.basename(file)
    updated_files.push(relative_path)
  }

  if (updated_files.length === 0) {
    if (ctx.readme_files.length > 0) {
      if (files_without_version.length > 0) {
        throw new Error(
          `None of the specified README files contained version ${current_version}. Checked: ${files_without_version.join(", ")}`
        )
      }
      if (missing_files.length === ctx.readme_files.length) {
        throw new Error(
          `Unable to find any README files to update. Checked: ${ctx.readme_files.join(", ")}`
        )
      }
    }
  }

  return updated_files
}
