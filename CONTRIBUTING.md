# Contributing to Rowboat

This fork contributes to [rowboatlabs/rowboat](https://github.com/rowboatlabs/rowboat). Below are branch naming, commit style, and how to keep in sync and open PRs.

## Development setup

- **Run dev app:** From repo root, `./dev.sh` (installs deps, builds workspace, runs Electron in dev mode). Or: `cd apps/x && pnpm install && npm run deps && npm run dev`.
- **Main process debugging:** Run `ROWBOAT_DEV_INSPECT=1 ./dev.sh` to start Electron with `--inspect`; then attach a Node-compatible debugger (e.g. Chrome DevTools or VS Code) to the main process.
- **Lint:** `cd apps/x && npm run lint`
- See root [CLAUDE.md](CLAUDE.md) for monorepo layout and build order.

## Branch naming

- `feature/<short-name>` — new features
- `fix/<short-name>` — bug fixes (e.g. `fix/squirrel-nsfilehandle-crash`)
- `refactor/<short-name>` — refactors
- `docs/<short-name>` — documentation only
- `test/<short-name>` — test additions or fixes

## Commits

Use conventional commits:

- **Format:** `<type>(<scope>): <subject>`
- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `perf`, `style`, `chore`
- **Scope:** e.g. `api`, `ui`, `electron`, `cli`, `build`

## Syncing with upstream

This fork uses `origin` = your fork, `upstream` = rowboatlabs/rowboat.

```bash
git fetch upstream
git checkout main
git merge upstream/main   # or: git rebase upstream/main
# push when ready: git push origin main
```

From the rowboat-quickstart repo you can run:

```bash
./scripts/sync-upstream.sh        # merge
./scripts/sync-upstream.sh --rebase   # rebase
```

That script also updates the upstream clone (rowboat__rowboatlabs) with `git pull`.

## Tracking upstream activity

- **Open PRs:** `gh pr list -R rowboatlabs/rowboat`
- **Upstream branches:** `git fetch upstream && git branch -r`
- **Other forks:** See GitHub “forked from rowboatlabs/rowboat” or search.

## Submitting a PR

1. Create an issue (if one doesn’t exist) in rowboatlabs/rowboat.
2. Create a branch from an up-to-date `main`: `git checkout main && git pull upstream main` then `git checkout -b fix/your-fix`.
3. Implement changes and run tests/lint (`cd apps/x && npm run lint`).
4. Rebase on upstream: `git fetch upstream && git rebase upstream/main`.
5. Push to your fork: `git push origin fix/your-fix`.
6. Open a PR at rowboatlabs/rowboat with a clear title and description (summary, changes, how you tested). Link any crash reports or issues.

## Packaged build and crash testing

To reproduce crashes that only happen in the packaged app (e.g. auto-updater):

```bash
cd apps/x && pnpm install && npm run deps
cd apps/main && npm run package
# Run: open out/Rowboat-darwin-arm64/Rowboat.app
```

To create a DMG: `cd apps/main && npm run make`.

## Crash fix and upstream PR workflow

1. **Grab latest report:** From rowboat-quickstart, run `./scripts/grab-latest-rowboat-crash.sh` to copy the most recent Rowboat crash from `~/Library/Logs/DiagnosticReports` (and system) into `problem-reports/`. Use `--summary-only` to print a one-line summary without copying.
2. **Sync with upstream:** Run `./scripts/sync-upstream.sh` (from rowboat-quickstart) so your fork’s `main` is up to date with rowboatlabs/rowboat.
3. **Build packaged app:** From this repo, `cd apps/x && pnpm install && npm run deps`, then `cd apps/main && npm run package`. Run the built `.app`; if the crash still occurs, use step 1 again to capture the new report.
4. **Create fix branch:** `git checkout -b fix/short-description` (e.g. `fix/auto-updater-crash`).
5. **Implement fix:** Typical approaches: bump `update-electron-app` or Electron Forge / Squirrel–related deps; add guards or try/catch around updater init if the API allows; or temporarily disable the updater in a specific scenario. Test with a packaged build.
6. **Open PR:** Rebase on `upstream/main`, push to your fork, then open a PR at rowboatlabs/rowboat. Include a summary of the crash (process, version, exception type, faulting thread) and the stack trace or problem report; link any related issues.

## Codebase analysis

Repomix (or similar) can be used to pack this repo for codebase analysis; see rowboat-quickstart tooling if configured.
