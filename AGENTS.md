# Agent guide: Rowboat fork workflow

This fork ([rowboat__aculich](../rowboat__aculich/)) contributes to [rowboatlabs/rowboat](https://github.com/rowboatlabs/rowboat). Use this file for branch strategy, sync, and where to put changes.

## Remotes

- **origin** — Your fork (e.g. aculich/rowboat).
- **upstream** — rowboatlabs/rowboat.

## Branch roles

| Branch | Role |
|--------|------|
| **main** | Strict sync with upstream/main only. No local commits; topic branches are created from `main` after syncing. Fork `main` (local and GitHub) must never be ahead of upstream. |
| **develop** | Catchall integration branch: `main` + **feature/devscripts** + selected feature/fix branches. Merge only the branches you want to test. Not pushed to upstream. |
| **feature/devscripts** | Fork-only dev workflow: `dev.sh`, this file (AGENTS.md). Merge into `develop` first so all other branches have a common base for how we run and document. Not pushed to upstream. |
| **feature/*** | New features (e.g. `feature/version-visibility`). Branch from `main`, merge into `develop` when ready. Open PR to upstream from this branch. |
| **fix/*** | Bug fixes (e.g. `fix/nsfilehandle-crash`, `fix/google-oauth-callback-iss`). Branch from `main`, merge into `develop` when ready. Open PR to upstream from this branch. |

## One-line commands

- **Sync fork with upstream (merge):**
  From rowboat-quickstart root: `./scripts/sync-upstream.sh`
  Or from fork root: `git fetch upstream --tags && git checkout main && git merge upstream/main`
- **Sync with rebase:**
  `./scripts/sync-upstream.sh --rebase` or `git fetch upstream --tags && git checkout main && git rebase upstream/main`
- **Create a feature branch from main:**
  `git fetch upstream && git checkout main && git merge upstream/main && git checkout -b feature/short-name`
- **Create a fix branch from main:**
  `git checkout main && git checkout -b fix/short-name`
- **Integrate topic branches into develop (full superset):**  
  `git checkout develop && git reset --hard main && git merge feature/devscripts && git merge feature/version-visibility && git merge fix/nsfilehandle-crash && git merge fix/google-oauth-callback-iss`

## Branch sync checklist

1. **Sync main with upstream:** From rowboat-quickstart root, `./scripts/sync-upstream.sh --rebase`. Then from fork root, `git push --force-with-lease origin main` so GitHub matches.
2. **Rebase topic branches onto main:** In fork root, `git checkout feature/devscripts && git rebase main`; then `feature/version-visibility`, `fix/nsfilehandle-crash`, `fix/google-oauth-callback-iss`. If already pushed, `git push --force-with-lease origin <branch>` for each.
3. **Rebuild develop:** `git checkout develop && git reset --hard main && git merge feature/devscripts && git merge feature/version-visibility && git merge fix/nsfilehandle-crash && git merge fix/google-oauth-callback-iss`. Push with `git push --force-with-lease origin develop` if needed.

To build a smaller set on develop, merge only the branches you need (e.g. `main + feature/devscripts + feature/version-visibility` for version visibility only).

## What goes on which branch

- **main:** No local commits; strict mirror of upstream/main.
- **feature/devscripts:** `dev.sh` (build/run with ROWBOAT_* env vars, upstream release), this file (AGENTS.md). No app code. Merge into develop first so dev workflow is available.
- **feature/version-visibility:** Only version visibility app code (IPC `app:getBuildInfo`, useBuildInfo, sidebar version, Settings > About, upstream release in UI). Depends on feature/devscripts for dev.sh and upstream release env.
- **fix/nsfilehandle-crash:** Only the crash fix (e.g. NSFileHandle/updater guards). Dev workflow from feature/devscripts.
- **fix/google-oauth-callback-iss:** OAuth callback + Client ID persistence; merge into develop for full superset.

## Fork workflow best practices

- **main = mirror:** Never commit on main. Sync only. Sync script resets main to `upstream/main` if it is ahead.
- **One concern per branch:** Each feature/* or fix/* branch holds a single feature or fix. Keeps PRs and rebases clean.
- **Dev workflow on its own branch:** Keep `dev.sh` and fork-only docs on `feature/devscripts` so you can rebase it on main and merge into develop without mixing app code. Lets you selectively apply “how we run” vs “what we changed.”
- **develop = selective integration:** Rebuild develop by resetting to main, then merging in order: `feature/devscripts` first, then the feature/fix branches you want. Push develop and topic branches to origin so GitHub matches local.
- **Rebase topic branches onto main:** After syncing main, rebase each topic branch onto main so they stay up to date. Use `--force-with-lease` when pushing after a rebase.

## Running the app

- **Dev run (from fork root):** `./dev.sh` — installs deps, builds, runs Electron with ROWBOAT_* env vars (version, commit, branch, upstream release). Requires `feature/devscripts` merged (e.g. on develop).
- **Main process debug:** `ROWBOAT_DEV_INSPECT=1 ./dev.sh` then attach Node debugger to main process.
- **Scripts (grab crash, sync):** Run from **rowboat-quickstart** root: `./scripts/grab-latest-rowboat-crash.sh`, `./scripts/sync-upstream.sh`. See [scripts/README.md](../scripts/README.md).

## Daily use

- Full superset: `git checkout develop` (after merging all branches per checklist).
- Version visibility only: merge `main + feature/devscripts + feature/version-visibility` on develop.
- Open PR to upstream: push the topic branch and open PR at rowboatlabs/rowboat from `feature/version-visibility` or `fix/*`.

## More detail

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, conventional commits, packaged build, and crash-fix PR workflow.

Fork-only docs (this file, CONTRIBUTING) and the sync script live in the rowboat-quickstart repo ([scripts/sync-upstream.sh](../scripts/sync-upstream.sh)). Branch policy and dev scripts are on `feature/devscripts` and merged into `develop`.
