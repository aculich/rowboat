# Optional comment on PR #456 — use one variant after review

PR: https://github.com/rowboatlabs/rowboat/pull/456

---

## Variant A — after rebasing PR #431 onto `main` (includes #456)

Thanks again for [PR #456](https://github.com/rowboatlabs/rowboat/pull/456) — forwarding the full query string fixed the dropped-param issue on `main`. I’ve rebased [PR #431](https://github.com/rowboatlabs/rowboat/pull/431) on top of that; our branch keeps the callback as a full `URL` into `exchangeCodeForTokens` (plus Google client ID persistence, refresh handling, and review follow-ups) instead of rebuilding `${REDIRECT_URI}` from a param record.

---

## Variant B — before rebase (interim)

[PR #456](https://github.com/rowboatlabs/rowboat/pull/456) addresses the same root cause (don’t forward only `code`/`state`). [PR #431](https://github.com/rowboatlabs/rowboat/pull/431) goes further by passing the actual callback `URL` through to `exchangeCodeForTokens`, and adds persistence / refresh / UX items. I’ll rebase onto latest `main` so we’re stacked cleanly on #456 and resolve any overlap in the three touched files.
