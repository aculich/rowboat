# DRAFT PR: OAuth discovery errors and early Google client ID persistence

**Status:** DRAFT — review before opening PR to `rowboatlabs/rowboat`

**Issue:** (link after issue is published)

---

## Summary

Improves OAuth **connect** UX when OIDC discovery fails: persist the Google client ID **before** discovery, return clearer user-facing errors (including network errno hints), and **emit `oauth:didConnect`** on discovery failure for parity with token-exchange errors.

## Changes

- [`apps/x/apps/main/src/oauth-handler.ts`](apps/x/apps/main/src/oauth-handler.ts)
  - `findErrnoCode` / `getOAuthConnectFailureMessage` to unwrap `cause` and `AggregateError` (e.g. `ETIMEDOUT`).
  - Upsert `google` + `clientId` immediately after validation, before `getProviderConfiguration`.
  - Remove redundant post-discovery upsert for Google `clientId` (already saved).
  - On `connectProvider` catch: `emitOAuthEvent({ success: false, ... })` and return formatted message.

## Testing

1. With a valid Google client ID and normal network: connect still opens browser and completes as before; `oauth.json` contains `clientId`.
2. Simulate discovery failure (airplane mode, or block issuer): `oauth.json` should still show `providers.google.clientId` after submit; in-app error mentions network / `ETIMEDOUT` where applicable; optional listener on `oauth:didConnect` receives failure.
3. Non-Google providers unchanged.

---

## Checklist (internal — do not paste into published PR)

- [ ] Rebased on `upstream/main` for `pr/*` branch
- [ ] Issue created and linked in PR description

## Out of scope

- Sync Activity / `services.jsonl` logging for OAuth
- Broader diagnostics UI (separate feature)
