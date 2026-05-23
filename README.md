# `pver` - A CLI for releasing pragmatic versions

`pver` is a cli tool for releasing [Pragmatic Versions](https://pragmaticversioning.com). You can use
`pver` as a simpler alternative to `semantic-release` for `npm` repositories. Alternatively if you already
use `semantic-release`, you can use a [pragmatic versioning release config](https://github.com/tscircuit/plop/blob/main/template-files/release.config.js)

> [!WARNING]
> This repo has been moved to [tscircuit/pver](https://github.com/tscircuit/pver)

Pragmatic versioning optimizes for communicating changes to a package to package consumers,
while retaining simple semantics for package maintainers.

Given a version number BIGRELEASE.ANNOUNCE.INCREMENT, increment the:

- BIGRELEASE version whenever a major milestone, periodic version cut (e.g.
a yearly release) or other marketed version change occurs, a BIGRELEASE
is often accompanied with a maintanence period.
- ANNOUNCE version whenever you have made an substantial incompatible API change,
introduced a new set of features, or any change that an end user using the software
normally may notice and should accompany an announcement.
- INCREMENT version for any new project contribution.


## Installation

```bash
npm install -g pver
```

Then put this in a github workflow:

```yml
name: Publish to npm
on:
  push:
    branches:
      - main
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/
      - run: npm install -g pver
      - run: npm ci
      - run: pver release
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Usage

```bash
# Automatically compute the latest Pragmatic Version using the
# git history
pver analyze
pver analyze --current-method=package.json --transition-method=simple

# Automatically compute the latest Pragmatic Version using the
# git history and release a new version as a git tag (and push it)
pver release --git

# Automatically compute the latest Pragmatic Version using the
# git history and increment the version in the package.json file, and
# the README.(md|txt) file
pver release --git --package-json --readme

# Publish the release to npm in addition to updating package.json
pver release --git --npm --readme

# Also available: --pyproject, --setuppy, --versionpy, --versionrb,
#                 --mdfile somefile.md

# Use --package-json when you only need the local version bump without an npm publish.

# Explicitly release a version
pver release increment --git
pver release announce --git
pver release bigrelease --git

# Automatically compute the latest Pragmatic Version using the
# git history, tag the current commit and stage the changes locally
pver stage --git
pver stage increment --git --npm

# Setup a Github repository to automatically release with pragmatic versions
pver setup github
```

## Working with Protected Branches

`pver` supports pushing to protected branches using GitHub's Git Data API. This is useful when your repository has branch protection rules that prevent direct pushes.

### Automatic Fallback

By default, `pver` will try a normal `git push` first. If it fails due to branch protection, it will automatically fall back to using the GitHub Git Data API:

```bash
pver release --git --npm
```

### Explicit Git Data API Usage

You can explicitly use the Git Data API with the `--push-via-api` flag:

```bash
pver release --git --npm --push-via-api
```

### Authentication

The Git Data API requires a GitHub token with appropriate permissions. Set one of these environment variables:

- `PVER_GITHUB_TOKEN` (preferred)
- `GITHUB_TOKEN` (fallback)

The token needs:
- `repo` scope for private repositories
- `public_repo` scope for public repositories
- For protected branches: the token must have "bypass branch protections" permission (typically requires admin access or a GitHub App)

### GitHub Actions Example

```yml
name: Publish to npm
on:
  push:
    branches:
      - main
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required for Git Data API
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Fetch full history for version analysis
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/
      - run: npm install -g pver
      - run: npm ci
      - run: pver release
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          PVER_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### How Git Data API Differs from Other Approaches

The Git Data API approach is fundamentally different from:

1. **SSH Key Normalization**: Other solutions modify the git remote URL to use SSH with authentication. This still uses `git push` under the hood, which respects branch protection rules.

2. **Contents API (PR #18)**: The Contents API is designed for single-file updates and creates commits through a different mechanism. It's limited to individual file operations.

3. **Git Data API (this implementation)**: Uses GitHub's low-level Git Data API to:
   - Create blobs for changed files
   - Create a new tree object
   - Create a new commit object
   - Update the branch reference directly
   
   This bypasses the normal push flow and works with tokens that have "bypass branch protections" permission.

### Usage in GitHub Actions

Drop this into `.github/workflows/publish.yml`

```yml
name: Publish to npm
on:
  push:
    branches:
      - main
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: 20
        registry-url: https://registry.npmjs.org/
    - run: npm install -g pver
    - run: npm ci
    - run: pver release
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Analysis

Analysis has two steps. Getting the `current_version` and using the `transition_method` to
determine the next version. You can manually specify both the state method and
the transition method.

Usually, the `current_version` is automatically determined by trying any available methods.

### Current Version Methods (`--current-method`)

#### `package.json`

Use the version inside the package.json file.

#### `readme`

Parse two sections of `README.txt` or `README.md` for a version number in the
format `vX.Y.Z`. Here's an example of a README.md with a version number:

```md
# My Package v0.1.1

This is a description of my package!
```

### Transition Methods (`--transition-method`)

#### `pver` Simple Commit Message Standard `simplegit`

By default, `pver` uses parses git commit history and looks for the following patterns:

- `bigrelease: <message>` - A BIGRELEASE, increments the major/first version number
- `announce: <message>` - A ANNOUNCE release, increments the minor/second version number
- Anything else - An INCREMENT release, increments the patch/third version number

`pver` then uses the largest version bump to determine the next version. It will
only increment a version number by a maximum of `1` per run. This means that
intermediate commits are not released.

> Looking for a different commit analysis pattern? [Create an issue!](#)
