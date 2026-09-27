# source (error classes, retry decision, fetch wrapper)
Purpose: Ky now turns raw fetch network failures into a typed `NetworkError`, and retries only errors it recognizes (network, timeout, retriable HTTP status). Before, it retried any error that reached the end of the retry decision.

## Terms
- NetworkError (`NetworkError`): new `KyError` subclass thrown when fetch fails at the network level. It carries `request`, and the original `TypeError` sits in the standard `cause`.
- Raw network error (`isRawNetworkError`): a `TypeError` from a fetch implementation whose message matches a known list of per-runtime network-failure strings. The check is inlined from the `is-network-error` v1.3.1 package.
- Network error guard (`isNetworkError`): public type guard. It passes if `instanceof NetworkError` or `error.name === 'NetworkError'`.
- Retry decision (`#calculateRetryDelay`): returns a delay in ms when the error should be retried, and rethrows otherwise.
- Default delay (`#calculateDelay`): exponential backoff with jitter, capped by `backoffLimit`.

## Entry points
- source/core/Ky.ts:100 `Ky.create` runs `#retry(() => #fetch())` for the first request. Every attempt goes through `#fetch`.
- source/core/Ky.ts:117 an afterResponse `ForceRetryError` goes to `#retryFromError(error, () => #fetch())`.
- source/core/Ky.ts:141 an `HTTPError` built from a non-ok response goes to `#retryFromError`.
- source/core/Ky.ts:700 `#retryFromError` calls `#calculateRetryDelay(error)` to decide whether to retry and how long to wait.
- source/index.ts:73,79 users import `NetworkError` and `isNetworkError` from `ky`.

## Flow
1. source/core/Ky.ts:792-812 `#fetch` does its existing prep: it resets an aborted controller, clones `this.request` for retries, and wraps the request for upload progress. This prep sits outside the new try, so any error it throws is never wrapped.
2. source/core/Ky.ts:813-826 the fetch call moved inside a `try`. Both branches (`timeout === false` → `options.fetch`, otherwise → `timeout()` race) now `return await`. Before, the no-timeout branch returned the bare promise, so its rejection would have skipped a local catch.
3. source/core/Ky.ts:827-833 in the catch, `isRawNetworkError(error)` → throw `new NetworkError(this.request, {cause: error})`. Any other error (`TimeoutError`, `AbortError`, non-network `TypeError`, custom errors) is rethrown unchanged.
4. source/utils/is-network-error.ts:18-26 the classifier first requires a real Error (via `Object.prototype.toString`, which works across realms), `name === 'TypeError'`, and a string `message`.
5. source/utils/is-network-error.ts:28-48 it then matches the message. Safari `Load failed` counts only when there is no stack, or when Sentry has marked the error. Deno messages start with `error sending request for url`. Chrome sends `Failed to fetch` or `Failed to fetch (host)`. Everything else must be in the exact-match set at :7-16 (Chrome, Firefox, Safari 16, cross-fetch, undici `fetch failed`/`terminated`, Bun, Cloudflare Workers).
6. source/errors/NetworkError.ts:9-17 builds the message `Request failed due to a network error: <METHOD> <URL>` and passes `{cause}` through to `Error` via `KyError`. The shape matches `TimeoutError`: literal `name` and a `request` property.
7. source/core/Ky.ts:405-438 the start of the retry decision is unchanged: the limit check, `ForceRetryError` (always retried), the method allowlist, and then `shouldRetry` (`true` forces a retry, `false` stops, `undefined` falls through). `shouldRetry` now receives the `NetworkError` instead of the raw `TypeError`.
8. source/core/Ky.ts:440-447 `TimeoutError` now gets an explicit `return this.#calculateDelay()` when `retryOnTimeout` is set. Before, it fell through to the shared return at the bottom. The early return is needed because the new gate at :486 would otherwise throw it.
9. source/core/Ky.ts:449-483 in the `HTTPError` branch, the Retry-After and 413 logic is unchanged. A new explicit `return this.#calculateDelay()` at :482 keeps retriable statuses from reaching the gate.
10. source/core/Ky.ts:485-490 new gate: anything that is not `isNetworkError(error)` is rethrown. Only `NetworkError` reaches the default backoff at the bottom. This is the "tighten retry logic" half of the PR.
11. source/utils/type-guards.ts:57-77 adds the public `isNetworkError` guard, which uses the same instanceof-or-name pattern as the other guards. source/utils/type-guards.ts:31-33 `isKyError` now also ORs `isNetworkError`. `instanceof KyError` already covered same-realm instances, so this only adds the name-based fallback.
12. source/index.ts:73,79 exports the class and the guard.

## Edge cases
- source/core/Ky.ts:485-488 a non-network `TypeError` from custom fetch or user code (e.g. `Cannot read properties of undefined`) → thrown immediately, not retried. Before: retried up to `limit`.
- source/core/Ky.ts:485-488 a non-Error throw (wrapped as `NonError` for `shouldRetry` at :411) → thrown immediately. Before: retried.
- source/core/Ky.ts:485-488 `AbortError` from a user abort → thrown without entering backoff. Before: it fell through to the delay, and `delay(..., {signal})` at :717 rejected on the aborted signal.
- source/core/Ky.ts:485-488 a custom `fetch` that throws its own error type (e.g. node-fetch `FetchError`, name not `TypeError`) → not wrapped and not retried unless `shouldRetry` returns `true`.
- source/core/Ky.ts:432-435 `shouldRetry` returns `true` for an unknown error → still retried, which is the escape hatch documented in retry.ts:136-138.
- source/core/Ky.ts:418-420 `NetworkError` on a non-retriable method (POST by default) → thrown as `NetworkError` without retry. The wrapping happens regardless of whether a retry follows.
- source/core/Ky.ts:406-408 retry limit exhausted, or `limit: 0` → the last `NetworkError` is thrown, and beforeError hooks (Ky.ts:189-202) see `NetworkError`, not `TypeError`.
- source/core/Ky.ts:813-816 `timeout: false` → the network error is still wrapped, because the `return await` makes the catch fire.
- source/core/Ky.ts:829 the error's `request` is `this.request` (the retry clone), not the upload-progress-wrapped `request` actually passed to fetch. This matches `TimeoutError` at :820, but `timeout()` builds its own `TimeoutError` from the wrapped request.
- source/utils/is-network-error.ts:31-35 Safari `Load failed` with a stack and no Sentry marker → not classified as network → not wrapped, not retried.
- source/utils/is-network-error.ts:7-16 a runtime or polyfill with an unlisted or localized message → stays a raw `TypeError` and is no longer retried.
- source/utils/type-guards.ts:75-77 any error with `name === 'NetworkError'` passes, including the browser `DOMException` named `NetworkError` or an app's own class. The guard then claims a `.request` that may not exist, and such errors also get retried at Ky.ts:486.
- Network errors raised while reading the body after `#fetch` resolves (e.g. undici `terminated` mid-stream in `.json()`) are outside the try → not wrapped and not retried.

## Mechanical
- source/errors/HTTPError.ts doc comment only: mentions the `options` property.
- source/errors/KyError.ts doc comment only: lists `NetworkError` among subclasses.
- source/types/hooks.ts doc comments only (:34, :122, :198): beforeRetry and beforeError now say they receive `NetworkError`, and list `isNetworkError()`.
- source/types/retry.ts doc comments only. :45 `maxRetryAfter` now says it clamps rather than cancels, which matches `#clampRetryDelayToMax` at Ky.ts:400-403. :138 `undefined` from `shouldRetry` now documents that unrecognized errors are not retried.
- source/types/options.ts doc comment only (:148-156). It lists all retry fields and adds the network-retry paragraph. It drops the stale "Retries are not triggered following a timeout" and the backoff formula (still at retry.ts:55-70), fixes the `maxRetryAfter` clamp wording, and bumps the RateLimit draft link from -02 to -05.
- source/core/Ky.ts:2,24-25 import additions.
- source/utils/type-guards.ts:3 import addition.
- source/index.ts:73,79 export additions.

## Risks and open questions
- Breaking change: callers who check `error instanceof TypeError`, or `error.name === 'TypeError'`, in catch blocks or beforeError hooks no longer match. The original error is now at `error.cause`.
- Breaking change: custom `fetch` wrappers or polyfills whose failures are not `TypeError` with a known message silently lose their automatic retries.
- Classification depends on exact message strings per runtime (:7-16). New runtimes, message changes, or localized messages fall outside the list, and nothing is logged.
- The name-based fallback in `isNetworkError` collides with `DOMException` name `NetworkError`. That gives false positives in the guard, and those errors get retried.
- The inlined copy of `is-network-error` v1.3.1 won't get upstream fixes automatically.
- `NetworkError.message` embeds the full URL. This matches HTTPError and TimeoutError, but query-string tokens can end up in logs.
