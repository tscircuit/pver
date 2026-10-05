import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import simpleGit from "simple-git"
import { AppContext } from "../app-context"
import { analyze } from "./index"

for (const occupied_tag_count of [0, 1, 10, 11, 25]) {
  test(`finds the next version after ${occupied_tag_count} occupied tags`, async () => {
    const fixture_directory = await mkdtemp(join(tmpdir(), "pver-tags-"))
    try {
      const repository_directory = join(fixture_directory, "repository")
      const remote_directory = join(fixture_directory, "remote.git")
      await mkdir(repository_directory)
      await mkdir(remote_directory)
      const git = simpleGit(repository_directory)
      await git.init()
      await git.checkoutLocalBranch("main")
      await git.addConfig("user.name", "pver test")
      await git.addConfig("user.email", "pver-test@example.com")
      const package_json_path = join(repository_directory, "package.json")
      await writeFile(package_json_path, JSON.stringify({ version: "0.1.2237", private: false }, null, 2))
      await git.add("package.json")
      await git.commit("release baseline")
      await writeFile(package_json_path, JSON.stringify({ version: "0.1.2237", private: true }, null, 2))
      await git.add("package.json")
      await git.commit("change package metadata")
      await git.addTag("v0.1.2237")
      for (let increment = 0; increment < occupied_tag_count; increment++) {
        await git.addTag(`v0.1.${2238 + increment}`)
      }
      await simpleGit(remote_directory).init(true)
      await git.addRemote("origin", remote_directory)
      await git.push(["origin", "main", "--tags"])
      const tags_before = (await git.tags()).all
      const commits_before = (await git.log()).total
      const ctx: AppContext = {
        current_directory: repository_directory,
        current_method: "package.json",
        transition_method: "simplegit",
        release_methods: [],
        readme_files: [],
      }

      const analysis = await analyze(ctx)

      assert.equal(analysis.current_version, "0.1.2237")
      assert.equal(analysis.next_version, `0.1.${2238 + occupied_tag_count}`)
      assert.deepEqual((await git.tags()).all, tags_before)
      assert.equal((await git.log()).total, commits_before)
      assert.equal((await git.status()).isClean(), true)

      await git.removeRemote("origin")
      await git.addRemote("origin", join(fixture_directory, "missing.git"))
      await assert.rejects(analyze(ctx), /does not appear to be a git repository/)
    } finally {
      await rm(fixture_directory, { recursive: true, force: true })
    }
  })
}
