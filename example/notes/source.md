# source (NetworkError + retry gate)
Purpose: Wrap raw fetch network failures in a new `NetworkError` and retry by default only those, timeouts (opt-in), and retriable HTTP statuses; every other error is thrown at once.

## Terms
- Raw network error (`isRawNetworkError`): the platform's own fetch rejection, a `TypeError` whose message matches a list of known per-runtime strings (Chrome, Firefox, Safari, Deno, undici, Bun, Cloudflare, cross-fetch).
- NetworkError (`NetworkError`): new `KyError` subclass that Ky throws in place of the raw `TypeError`; carries `request` and keeps the raw error on `cause`.
- Network error guard (`isNetworkError`): public type guard; true for `instanceof NetworkError` or any object with `name === 'NetworkError'` (cross-realm duck typing, same pattern as the other guards).
- Retry gate (`#calculateRetryDelay`): returns a backoff delay to retry or throws to stop; now ends in an allowlist instead of "retry anything".
- Retry state error (`errorObject`): the error passed to `shouldRetry`; now a `NetworkError`, no longer a raw `TypeError`.

## Entry points
- source/core/Ky.ts:100 `Ky.create` runs `ky.#retry(async () => ky.#fetch())` for every request; a fetch rejection reaches the retry gate through `#retry` (689-695) -> `#retryFromError` (697-700).
- source/core/Ky.ts:117,141 `Ky.create` re-enters `#retryFromError(..., () => ky.#fetch())` for `ForceRetryError` and `HTTPError`; the retried fetch can also throw `NetworkError`.
- source/core/Ky.ts:174-204 the final error (now `NetworkError` for network failures) passes through `beforeError` hooks before reaching the caller.
- source/index.ts:73,79 users import `NetworkError` and `isNetworkError` from `ky`.

## Flow
1. [service, detail] source/utils/is-network-error.ts:1-49 Inlined copy of `is-network-error` v1.3.1 (no new dependency). Accepts only real `Error` objects (checked with `Object.prototype.toString`, so it works cross-realm) named `TypeError`, then matches the message per runtime: Safari 17 `Load failed` only when there is no stack (or Sentry marked it), Deno by prefix, Chrome `Failed to fetch` with or without `(host)`, the rest by exact match against the set at 7-16.
2. [model, core] source/errors/NetworkError.ts:9-17 New error class extending `KyError`, `name = 'NetworkError'`, message `Request failed due to a network error: <METHOD> <URL>`, `request` property, raw error passed as standard ES2022 `cause`. Mirrors `TimeoutError`'s shape.
3. [type, core] source/utils/type-guards.ts:57-77 New `isNetworkError` guard (instanceof or `name` match). source/utils/type-guards.ts:31-33 `isKyError` now also accepts it. Import at :3.
4. [flow, core] source/core/Ky.ts:813-833 `#fetch` wraps both fetch paths (no timeout, and `timeout()` race) in try/catch. A rejection that `isRawNetworkError` recognizes is rethrown as `new NetworkError(this.request, {cause})` (:828-830); anything else (TimeoutError, AbortError, unknown TypeErrors) is rethrown untouched (:832). Both returns became `return await` (:815, :823) so the rejection lands in this catch instead of escaping the async function. Imports at :2, :24-25. Replaces old source/core/Ky.ts:800-812.
5. [flow, core] source/core/Ky.ts:485-490 The retry gate's tail. Before, any error that got past the timeout and HTTP checks fell through to `return this.#calculateDelay()` (old source/core/Ky.ts:477), so programming bugs, custom-fetch errors and non-Error throws were all retried with backoff. Now only `isNetworkError(error)` reaches the delay; everything else is thrown. This is the "tighten retry logic" half, fixing #545.
6. [flow, core] source/core/Ky.ts:440-447 Timeout branch split: throw when `retryOnTimeout` is off, otherwise `return this.#calculateDelay()` explicitly. Before it relied on the shared fall-through (old source/core/Ky.ts:438-441), which no longer exists for unknown errors.
7. [flow, core] source/core/Ky.ts:449-483 HTTP branch now ends with an explicit `return this.#calculateDelay()` (:482) for the same reason; the status, Retry-After and 413 logic is unchanged.
8. [flow, detail] source/core/Ky.ts:405-438 Unchanged order that the new gate sits behind: retry limit (:406), `ForceRetryError` (:414), retriable method (:419), then `shouldRetry` (:424-438). `shouldRetry` returning `true` still retries anything, and `undefined` falls through to the new allowlist.
9. [type, core] source/index.ts:73,79 Public exports of `NetworkError` and `isNetworkError`.
10. [type, detail] source/types/options.ts:152, source/types/retry.ts:138, source/types/hooks.ts:122,198 Doc comments state the new contract: network errors are retried for retriable methods, unrecognized errors are not, `beforeRetry`/`beforeError` receive `NetworkError` when no response came back.

## Edge cases
- source/utils/is-network-error.ts:19-26 Non-Error value, or error not named `TypeError` (DOMException `AbortError`, Ky `TimeoutError`) -> not wrapped.
- source/utils/is-network-error.ts:31-35 Message `Load failed` with a stack and no `__sentry_captured__` -> treated as not a network error.
- source/utils/is-network-error.ts:43 `Failed to fetch (example.com)` (Chrome with hostname) -> accepted, as is bare `Failed to fetch`.
- source/utils/is-network-error.ts:14 Bun message has a leading space on purpose -> exact match needs it.
- source/core/Ky.ts:815 `timeout: false` -> fetch rejection is still awaited inside the try, so it is still wrapped in `NetworkError`.
- source/core/Ky.ts:819-821 Timeout budget already spent -> `TimeoutError` is thrown inside the try and passes through the catch unchanged.
- source/core/Ky.ts:827-832 Custom `fetch` throws a non-network `TypeError` (e.g. `Cannot read properties of undefined`) -> rethrown raw, then thrown by the gate at :486-488 with no retry.
- source/core/Ky.ts:829 Undici failure -> `NetworkError.cause` is `TypeError('fetch failed')`, and the low-level undici error (with `code`) moves one level down to `error.cause.cause`.
- source/core/Ky.ts:406-408 `NetworkError` after the retry limit -> thrown as `NetworkError` and goes through `beforeError`.
- source/core/Ky.ts:419-421 `NetworkError` on POST (not in default `retry.methods`) -> thrown after one attempt.
- source/core/Ky.ts:424-438 `shouldRetry` returns `true` for a non-network error -> still retried (escape hatch); returns `undefined` for a `NetworkError` -> default retry.
- source/core/Ky.ts:485-488 Non-Error throw from custom fetch (wrapped as `NonError` only for `shouldRetry`) or user `AbortError` -> thrown right away. Abort outcome is the same as before (the old path's `delay()` rejected with the signal's reason), but it now skips the backoff wait.
- source/utils/type-guards.ts:75-77 `NetworkError` from another realm or bundled copy of ky -> recognized by `name`.

## Mechanical
- source/errors/KyError.ts doc comment lists `NetworkError` among subclasses
- source/errors/HTTPError.ts doc comment now mentions the existing `options` property (unrelated drive-by)
- source/types/hooks.ts:34 comment drops the "network `TypeError`s" example
- source/types/options.ts:148,154,156 retry doc rewrite: full field list, draft link 02 -> 05, `maxRetryAfter` now documented as a clamp; removed stale `old source/types/options.ts:156` (default delay formula) and `old source/types/options.ts:158` ("Retries are not triggered following a timeout", false since `retryOnTimeout`)
- source/types/retry.ts:45 `maxRetryAfter` doc fixed from "request will be canceled" to "it will use `maxRetryAfter`", matching `#clampRetryDelayToMax` (Ky.ts:400-403)

## Risks and open questions
- Breaking for callers: `catch`, `beforeError`, `beforeRetry` and `shouldRetry` code that checks `error instanceof TypeError`, `error.message === 'Failed to fetch'`, or `error.cause.code` (e.g. `ECONNREFUSED`, now `error.cause.cause.code`) stops matching, and nothing fails loudly.
- Breaking for retry: errors that were retried before and are now thrown include any custom `fetch` wrapper's own errors, and network failures from runtimes or wordings missing from the message list (localized messages, polyfills, future browser text). The readme notes this and points to `shouldRetry`.
- The message allowlist is brittle: if a browser changes its fetch error text, retries turn off for that browser with no signal.
- `isNetworkError`/`isKyError` match on `name === 'NetworkError'`, which is also a standard DOMException name and common in other libraries. Such foreign errors pass `isKyError`, get typed as `NetworkError` with no `request`, and are retried by the gate at Ky.ts:486.
- Only the `fetch()` rejection is wrapped. Body-read failures in `.json()`/`.text()` (Ky.ts:226-246, e.g. undici `terminated` mid-stream) still surface as raw `TypeError`, skip `beforeError`, and are not retried, so the `terminated` entry rarely applies.
- Safari 17 `Load failed` is recognized only without a stack. Instrumentation other than Sentry that attaches a stack makes real network failures non-retriable.
- Open: is this shipping as a major (ky v2)? The change in thrown error type and in retry scope is observable to existing users.
