#!/usr/bin/env bash
# Build and run Rowboat Electron app in development mode with dev metadata.
# Usage: ./dev.sh
# Set ROWBOAT_DEV_INSPECT=1 to run main process with --inspect for debugging.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_JSON="$REPO_ROOT/apps/x/package.json"

# Fetch upstream tags and compute upstream release (e.g. v0.1.60)
git -C "$REPO_ROOT" fetch upstream --tags 2>/dev/null || true
MB=$(git -C "$REPO_ROOT" merge-base HEAD upstream/main 2>/dev/null || true)
if [[ -n "$MB" ]]; then
  ROWBOAT_UPSTREAM_RELEASE=$(git -C "$REPO_ROOT" describe --tags --abbrev=0 "$MB" 2>/dev/null || echo '')
else
  ROWBOAT_UPSTREAM_RELEASE=''
fi

# Derive dev version from upstream release (e.g. v0.1.60-dev), or fall back to package.json
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

echo "Building Rowboat (dev) v${ROWBOAT_DEV_VERSION} @ ${GIT_COMMIT} (${GIT_BRANCH})..."
cd "$REPO_ROOT/apps/x"
pnpm install
npm run deps
npm run dev
