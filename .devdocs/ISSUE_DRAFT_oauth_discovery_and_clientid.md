# DRAFT Issue: OAuth discovery failures lose Google client ID and show opaque errors

**Status:** DRAFT — review before `gh issue create`

---

## Title

OAuth: persist Google client ID before discovery; clearer errors when discovery/network fails

## Body

### Description

When OIDC discovery fails (e.g. `ETIMEDOUT`, `fetch failed`), the user’s typed **Google OAuth client ID** is not written to `~/.rowboat/config/oauth.json` because persistence runs only **after** `getProviderConfiguration` succeeds. The app also returns a generic **`fetch failed`** (or similar) string to the renderer without surfacing the underlying errno or actionable guidance.

### Current behavior

- Discovery runs; on timeout, `connectProvider` catches the error, logs to the console, and returns `{ success: false, error: error.message }` without `emitOAuthEvent`.
- Google `clientId` is upserted only after discovery completes.

### Expected behavior

- After validating that Google has a client ID, **persist it immediately** so failed discovery does not discard user input.
- Return a **clearer IPC error** (include `ETIMEDOUT` / network context where available) and **emit `oauth:didConnect`** with `success: false` so the renderer can react consistently with token-exchange failures.

### Notes

- Config path: `~/.rowboat/config/oauth.json` (`WorkDir` from core config).
- No change to Sync Activity / `ServiceEvent` pipeline (OAuth remains separate from sync service logs).

---

## Environment

- Rowboat Electron app, main-process OAuth (`apps/x/apps/main/src/oauth-handler.ts`).
