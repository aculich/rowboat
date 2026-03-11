# Agent guide: Rowboat fork workflow

This fork ([rowboat__aculich](../rowboat__aculich/)) contributes to [rowboatlabs/rowboat](https://github.com/rowboatlabs/rowboat). Use this file for branch strategy, sync, and where to put changes.

## Remotes

- **origin** — Your fork (e.g. aculich/rowboat).
- **upstream** — rowboatlabs/rowboat.

## Branch roles

| Branch | Role |
|--------|------|
| **main** | Upstream sync + optional chore (e.g. dev script, CONTRIBUTING). Topic branches are created from `main`. |
| **develop** | Integration: `main` + merged topic branches. Check out `develop` to build and run with all local work (version visibility, crash fix, etc.). Not pushed to upstream. |
| **feature/*** | New features (e.g. `feature/version-visibility`). Branch from `main`, merge into `develop` when ready. Open PR to upstream from this branch. |
| **fix/*** | Bug fixes (e.g. `fix/nsfilehandle-crash`). Branch from `main`, merge into `develop` when ready. Open PR to upstream from this branch. |

## One-line commands

- **Sync fork with upstream (merge):**  
  From rowboat-quickstart root: `./scripts/sync-upstream.sh`  
  Or from fork root: `git fetch upstream && git checkout main && git merge upstream/main`
- **Sync with rebase:**  
  `./scripts/sync-upstream.sh --rebase` or `git fetch upstream && git checkout main && git rebase upstream/main`
- **Create a feature branch from main:**  
  `git fetch upstream && git checkout main && git merge upstream/main && git checkout -b feature/short-name`
- **Create a fix branch from main:**  
  `git checkout main && git checkout -b fix/short-name`
- **Integrate topic branches into develop:**  
  `git checkout develop && git merge feature/version-visibility && git merge fix/nsfilehandle-crash`

## What goes on which branch

- **main (chore only):** `dev.sh`, CONTRIBUTING.md, package.json changes for dev (e.g. `start:inspect`, `ROWBOAT_DEV_INSPECT` in main script). No feature or fix code.
- **feature/version-visibility:** Only version visibility (IPC `app:getBuildInfo`, useBuildInfo, sidebar version, Settings > About). Do not duplicate chore files; they live on main.
- **fix/nsfilehandle-crash:** Only the actual crash fix (e.g. NSFileHandle/updater guards). Dev workflow is on main; this branch is for the code fix.

## Running the app

- **Dev run (from fork root):** `./dev.sh` — installs deps, builds, runs Electron with ROWBOAT_* env vars (version, commit, branch).
- **Main process debug:** `ROWBOAT_DEV_INSPECT=1 ./dev.sh` then attach Node debugger to main process.
- **Scripts (grab crash, sync):** Run from **rowboat-quickstart** root: `./scripts/grab-latest-rowboat-crash.sh`, `./scripts/sync-upstream.sh`. See [scripts/README.md](../scripts/README.md).

## Daily use

- Try only version visibility: `git checkout feature/version-visibility` (includes main’s dev.sh).
- Try only fix: `git checkout fix/nsfilehandle-crash`.
- Try both: `git checkout develop`.
- Open PR to upstream: push the topic branch and open PR at rowboatlabs/rowboat from `feature/version-visibility` or `fix/nsfilehandle-crash`.

## More detail

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, conventional commits, packaged build, and crash-fix PR workflow.
