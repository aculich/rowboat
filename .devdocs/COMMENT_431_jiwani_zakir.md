# Reply to JiwaniZakir — PR #431 review thread (publish after review)

Thread: https://github.com/rowboatlabs/rowboat/pull/431#pullrequestreview-4026143297

---

Thanks for the detailed review — all three points addressed in the latest push:

1. **Token refresh:** I expanded the PR description to call out the refresh fix explicitly. On the code side, we already persisted `refreshedTokens` after `refreshTokens()`; I also fixed a related bug where `getAccessToken` still returned the **pre-refresh** access token after a successful refresh, so callers could briefly use a stale access token.

2. **Missing `state`:** The callback now checks for a missing or empty `state` before the CSRF comparison and throws a dedicated error instead of reporting a CSRF mismatch.

3. **User-facing vs logs:** `getOAuthErrorMessage` unwraps a one-level `cause` for `OAUTH_INVALID_RESPONSE` and when the top-level message is an opaque openid-client string (e.g. "invalid response encountered"). The catch block still logs the full cause chain for any error for debugging.
