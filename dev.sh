#!/usr/bin/env bash
# Build and run Rowboat Electron app in development mode with dev metadata.
# Usage: ./dev.sh
# Set ROWBOAT_DEV_INSPECT=1 to run main process with --inspect for debugging.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_JSON="$REPO_ROOT/apps/x/package.json"

# Fetch upstream tags and compute upstream release from merge-base with upstream/main
git -C "$REPO_ROOT" fetch upstream --tags 2>/dev/null || true

UPSTREAM_MAIN_SHORT=$(git -C "$REPO_ROOT" rev-parse --short upstream/main 2>/dev/null || echo 'unknown')

MB=$(git -C "$REPO_ROOT" merge-base HEAD upstream/main 2>/dev/null || true)
if [[ -n "$MB" ]]; then
  MB_SHORT=$(git -C "$REPO_ROOT" rev-parse --short "$MB" 2>/dev/null || echo '')
  ROWBOAT_UPSTREAM_RELEASE=$(git -C "$REPO_ROOT" describe --tags --abbrev=0 "$MB" 2>/dev/null || echo '')
else
  MB_SHORT=''
  ROWBOAT_UPSTREAM_RELEASE=''
fi

# Ahead/behind vs upstream/main (left=ahead, right=behind)
AHEAD_BEHIND=$(git -C "$REPO_ROOT" rev-list --left-right --count HEAD...upstream/main 2>/dev/null || echo '0	0')
AHEAD=${AHEAD_BEHIND%%	*}
BEHIND=${AHEAD_BEHIND#*	}

# Derive dev version from upstream release (e.g. v0.1.85-dev), or fall back to package.json
if [[ -n "$ROWBOAT_UPSTREAM_RELEASE" ]]; then
  ROWBOAT_DEV_VERSION="${ROWBOAT_UPSTREAM_RELEASE}-dev"
else
  ROWBOAT_DEV_VERSION=$(grep -E '"version"' "$PKG_JSON" | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
  : "${ROWBOAT_DEV_VERSION:=0.1.0}"
fi

GIT_COMMIT=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
REMOTE_URL=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)
ROWBOAT_FORK_NAME=$(printf "%s" "$REMOTE_URL" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##; s#/.*##')

export ROWBOAT_DEV_VERSION
export ROWBOAT_GIT_COMMIT="$GIT_COMMIT"
export ROWBOAT_GIT_BRANCH="$GIT_BRANCH"
export ROWBOAT_BUILD_DATE="$BUILD_DATE"
export ROWBOAT_IS_DEV_BUILD="true"
export ROWBOAT_FORK_NAME="$ROWBOAT_FORK_NAME"
export ROWBOAT_UPSTREAM_RELEASE="$ROWBOAT_UPSTREAM_RELEASE"

echo "--- Rowboat dev preflight ---"
echo "  branch:     ${GIT_BRANCH}"
echo "  commit:     ${GIT_COMMIT}"
echo "  upstream/main: ${UPSTREAM_MAIN_SHORT}"
echo "  merge-base: ${MB_SHORT:-?}  tag: ${ROWBOAT_UPSTREAM_RELEASE:-<none>}"
echo "  vs upstream/main: ${AHEAD} ahead, ${BEHIND} behind"
echo "  dev version: ${ROWBOAT_DEV_VERSION}"
if [[ -n "${BEHIND}" && "${BEHIND}" -gt 0 ]]; then
  echo "  warning: branch is ${BEHIND} commit(s) behind upstream/main; merge-base tag may be older than upstream tip."
fi
echo "-----------------------------"
echo "Building Rowboat (dev) ${ROWBOAT_DEV_VERSION} @ ${GIT_COMMIT} (${GIT_BRANCH})..."

cd "$REPO_ROOT/apps/x"
pnpm install
# npm run dev runs deps (shared/core/preload) then renderer+main; do not duplicate deps here
npm run dev
