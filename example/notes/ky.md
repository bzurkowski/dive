# ky (source, test, readme)
Purpose: ky wraps `fetch` with retries, timeouts and hooks. This PR wraps recognized fetch network failures in a new `NetworkError`, and the default retry logic now retries only network, timeout and retriable HTTP errors.

## Terms
- NetworkError (`NetworkError`): new `KyError` subclass thrown when fetch fails at the network level; carries `request`, and the raw runtime error is kept in `cause`.
- Raw network error (`isRawNetworkError`): a `TypeError` whose message matches a known runtime string (Chrome, Firefox, Safari, Undici, Deno, Bun, Cloudflare, cross-fetch). The check is inlined from `is-network-error` v1.3.1.
- Network error guard (`isNetworkError`): public type guard that is true for a `NetworkError`, by `instanceof` or by `name === 'NetworkError'`.
- Retry decision (`Ky#calculateRetryDelay`): returns a delay in ms to retry, or throws the error to stop.
- Default fallthrough: the end of `#calculateRetryDelay`. The base retried any error that reached it; the head throws unless the error is a `NetworkError`.

## Entry points
- source/index.ts:12,16 App calls `ky(input)` / `ky.get(input)` → `Ky.create`, on every request
- source/utils/type-guards.ts:75-77 App calls `isNetworkError(error)` (exported at source/index.ts:79) after catching a ky error
- source/utils/type-guards.ts:31-33 App calls `isKyError(error)`, which now also accepts `NetworkError`

## Calls out
- Fetch API (`options.fetch`, default `globalThis.fetch`) sends the request; its `TypeError` rejection is what gets classified
- User hooks and callbacks (`retry.shouldRetry`, `hooks.beforeRetry`, `hooks.beforeError`) now receive a `NetworkError` instead of the raw `TypeError`
- source/utils/timeout.ts races fetch against the timeout budget (unchanged, called from the changed try block)
- source/utils/delay.ts waits out the backoff between attempts (unchanged)

## Chains
### ky.get(url): network failure is wrapped, retried, then succeeds
1. App → ky: `ky.get(url)` builds `Ky.create(input, mergedOptions)` - source/index.ts:10-17 - call, unchanged
2. Ky.create → Ky#retry: `function_` runs beforeRequest hooks, then `#retry(() => #fetch())` - source/core/Ky.ts:87-100 - call, unchanged
3. Ky#retry → Ky#fetch: one attempt - source/core/Ky.ts:689-692 - call, unchanged
4. Ky#fetch → timeout: the send is now inside `try` with `return await`. `timeout: false` calls `options.fetch` directly; otherwise `timeout()` runs with the remaining budget - source/core/Ky.ts:813-826, source/utils/timeout.ts:9-32, test/retry.ts:1807-1821 - call, changed
5. timeout → Fetch API: `options.fetch(request, init)` - source/utils/timeout.ts:24-27 - call, unchanged
6. Fetch API → timeout: rejects with a raw `TypeError` ('Failed to fetch', 'fetch failed', ...) - error, unchanged
7. timeout → Ky#fetch: the rejection reaches the new `catch`. The `await` makes this possible, since a bare `return promise` would skip the catch - source/core/Ky.ts:823-827 - error, changed
8. Ky#fetch → isRawNetworkError: checks name `TypeError` and the runtime message allowlist - source/core/Ky.ts:828, source/utils/is-network-error.ts:18-49 - call, added
9. Ky#fetch → Ky#retry: throws `new NetworkError(this.request, {cause: error})` - source/core/Ky.ts:829, source/errors/NetworkError.ts:9-17, test/retry.ts:1613-1631 - error, added
10. Ky#retry → Ky#retryFromError: the catch hands the error to the retry logic - source/core/Ky.ts:692-694,697-700 - call, unchanged
11. Ky#retryFromError → Ky#calculateRetryDelay: asks for a delay or a throw - source/core/Ky.ts:700,405-421 - call, unchanged
12. Ky#calculateRetryDelay → shouldRetry: optional user callback, now given the `NetworkError`. `true` forces a retry, `false` throws, `undefined` falls through - source/core/Ky.ts:424-438, test/retry.ts:1717-1738,1755-1778 - call, unchanged
13. Ky#calculateRetryDelay → isNetworkError: the new guard at the default fallthrough. A `NetworkError` passes - source/core/Ky.ts:485-490, source/utils/type-guards.ts:75-77 - call, added
14. Ky#calculateRetryDelay → Ky#retryFromError: returns the `#calculateDelay()` backoff - source/core/Ky.ts:490,381-398, test/retry.ts:1675-1695 - return, unchanged
15. Ky#retryFromError → delay: waits, checked against the total timeout budget - source/core/Ky.ts:703-725, source/utils/delay.ts:9-29 - async, unchanged, detail
16. Ky#retryFromError → beforeRetry hook: user hook receives the `NetworkError` as `error` - source/core/Ky.ts:737-772, test/hooks.ts:647-685 - call, unchanged
17. Ky#retryFromError → Ky#retry: `#retryCount++`, next attempt - source/core/Ky.ts:782-783 - call, unchanged
18. Ky#fetch → Ky.create: the next attempt resolves with a `Response`, which goes through afterResponse hooks to App - source/core/Ky.ts:100-171 - return, unchanged

### ky.get / ky.post: NetworkError reaches the caller (limit hit or method not retriable)
1. Ky#retryFromError → Ky#calculateRetryDelay: decides on the wrapped error - source/core/Ky.ts:700 - call, unchanged
2. Ky#calculateRetryDelay → Ky#retryFromError: throws the `NetworkError` when `#retryCount >= limit` or the method is not in `retry.methods` (POST) - source/core/Ky.ts:406-408,419-421, test/retry.ts:1697-1715 - error, unchanged
3. Ky#retryFromError → Ky.create: the error leaves `#retry` and reaches the outer catch of `function_` - source/core/Ky.ts:100,174-187 - error, unchanged
4. Ky.create → beforeError hook: each hook receives the `NetworkError` and may replace it - source/core/Ky.ts:188-202, test/hooks.ts:1604-1629,1974-1998, test/retry.ts:1780-1805 - call, unchanged
5. Ky.create → App: the ResponsePromise rejects with a `NetworkError` whose `cause` is the raw `TypeError` - source/core/Ky.ts:204, test/headers.ts:127-144 - error, unchanged
6. App → isNetworkError: narrows by `instanceof`, or by name for cross-realm errors. `isKyError` delegates to it too - source/utils/type-guards.ts:31-33,75-77, source/index.ts:73,79 - call, added

### ky.get(url): fetch throws a non-network error (e.g. a bug in a custom fetch)
1. Fetch API → Ky#fetch: custom fetch rejects with `TypeError('Cannot read properties of undefined')` - error, unchanged
2. Ky#fetch → isRawNetworkError: false, so the raw error is rethrown unwrapped - source/core/Ky.ts:827-832, test/retry.ts:1740-1753 - call, added
3. Ky#retry → Ky#calculateRetryDelay: via `#retryFromError` - source/core/Ky.ts:692-700 - call, unchanged
4. Ky#calculateRetryDelay → Ky#retryFromError: no timeout, HTTP or network match, so it throws after one attempt. The base returned a backoff here and retried - source/core/Ky.ts:485-488, old source/core/Ky.ts:477, test/retry.ts:1633-1651 - error, changed
5. Ky.create → App: beforeError hooks run, and the raw `TypeError` rejects the promise - source/core/Ky.ts:174-204 - error, unchanged

### Ky#calculateRetryDelay: timeout and HTTP branches now return on their own
1. Ky#calculateRetryDelay → Ky#retryFromError: a `TimeoutError` throws unless `retryOnTimeout`, then returns `#calculateDelay()`. The base fell through to the shared return - source/core/Ky.ts:441-447, old source/core/Ky.ts:439-441 - return, changed
2. Ky#calculateRetryDelay → Ky#retryFromError: an `HTTPError` with a retriable status returns a Retry-After or backoff delay, and 413 without Retry-After throws. The branch now ends with an explicit `return #calculateDelay()` - source/core/Ky.ts:449-483 - return, changed

## Edge cases
- source/utils/is-network-error.ts:19-26 value is not an Error by `Object.prototype.toString`, or its name is not `TypeError` -> not wrapped
- source/utils/is-network-error.ts:31-35 Safari 17+ 'Load failed' -> counts as network only if `stack` is undefined or Sentry marked it (`__sentry_captured__`)
- source/utils/is-network-error.ts:38-40 Deno 'error sending request for url...' -> matched by prefix
- source/utils/is-network-error.ts:43-45 Chrome 'Failed to fetch' or 'Failed to fetch (host)' -> network
- source/utils/is-network-error.ts:7-16,48 any other message -> exact match against the set. The Bun message has a leading space on purpose
- source/core/Ky.ts:818-821,827-832 `TimeoutError` thrown inside the new try (budget already spent) -> rethrown unwrapped
- source/core/Ky.ts:406-408 `retry: 0` -> the `NetworkError` is thrown on the first failure (test/retry.ts:1613-1631)
- source/core/Ky.ts:432-435 `shouldRetry` returns true -> non-network errors are still retried up to the limit (test/retry.ts:1653-1673)
- source/core/Ky.ts:411,485-488 fetch throws a non-Error value -> wrapped in `NonError` for `shouldRetry`, but no longer retried by default
- source/core/Ky.ts:747-753 beforeRetry rethrows the same `NetworkError` -> it is not added to `#beforeRetryHookErrors`, so beforeError still runs (test/hooks.ts:1122-1156)
- source/core/Ky.ts:762-766 beforeRetry returns a Response after a network failure -> that Response is used and no further fetch happens (test/hooks.ts:2170-2216,3908-3929,4079-4106)
- source/errors/NetworkError.ts:13-15 `cause` is passed to the standard `Error` constructor -> the undici `code` now sits at `error.cause.cause.code` (test/headers.ts:142-143)

## Mechanical
- test/hooks.ts:664,1126,2189,3919,4089 boilerplate test: fake fetch errors now throw `TypeError('Failed to fetch')` so they still count as network errors and retry
- test/hooks.ts:7,672,1155,1627,1974 boilerplate test: assertions and a test name moved from raw-TypeError checks to `isNetworkError`
- test/memory-leak.ts:4,44 boilerplate test: expects `NetworkError` instead of `TypeError('fetch failed')`
- test/retry.ts:3-8 boilerplate test: imports `NetworkError`, `isKyError`, `isNetworkError`
- source/core/Ky.ts:2,24-25 imports
- source/errors/KyError.ts:2 docs: lists `NetworkError` among subclasses
- source/errors/HTTPError.ts:9 docs: mentions the `options` property (unrelated doc sync)
- source/types/hooks.ts:34,122,198 docs: beforeRetry and beforeError now name `NetworkError`
- source/types/options.ts:148-156 docs: adds the network-retry paragraph and fixes stale text (the `maxRetryAfter` "cancels" wording, "Retries are not triggered following a timeout")
- source/types/retry.ts:45,138 docs: `maxRetryAfter` clamps, and `shouldRetry` returning undefined does not retry unknown errors
- readme.md:265-266,292,456,529,1089,1114,1179-1200 docs: mirrors the JSDoc and adds a `### NetworkError` section with a runtime-heuristics caveat

## Detail

### Flow
- source/index.ts:10-17 every ky call goes through `Ky.create`, so the new wrapping covers all instances and methods
- source/core/Ky.ts:87-100 `function_` is the request lifecycle. `#retry(#fetch)` is the only path where fetch failures become retry decisions
- source/core/Ky.ts:689-695 `#retry` runs one attempt and hands any rejection to `#retryFromError`
- source/core/Ky.ts:792-812 `#fetch` prepares the request and the retry clone. `this.request` becomes the clone, which is why `NetworkError` and `TimeoutError` carry the unsent clone
- source/core/Ky.ts:813-826 both send paths are now inside one try. The `return await` is needed so the catch sees async rejections, which the base's bare `return` let pass by
- source/utils/timeout.ts:9-32 forwards the fetch rejection unchanged, so the raw `TypeError` reaches `#fetch`'s catch
- source/core/Ky.ts:827-832 classifies the error once, at the fetch boundary. Everything downstream (shouldRetry, hooks, caller) sees one stable type
- source/utils/is-network-error.ts:18-49 a heuristic on name and message, since fetch gives no structured network-error code across runtimes
- source/errors/NetworkError.ts:9-17 same shape as `TimeoutError` (`request` field, `name` literal). It forwards `options` so `cause` is native
- source/core/Ky.ts:697-700 `#retryFromError` gets a delay from `#calculateRetryDelay`, or lets its throw propagate
- source/core/Ky.ts:405-438 limit check, then ForceRetryError, then method check, then `shouldRetry`, in that order. All run before the type branches
- source/core/Ky.ts:441-483 the timeout and HTTP branches now return on their own, because the shared fallthrough below them changed meaning
- source/core/Ky.ts:485-490 the core fix for #545: only a `NetworkError` reaches `#calculateDelay()` here, and anything else is thrown immediately
- source/core/Ky.ts:381-398 backoff with optional jitter, capped by `backoffLimit` (unchanged)
- source/core/Ky.ts:703-783 delay, beforeRetry hooks, then the next attempt through `#retry` (unchanged)
- source/core/Ky.ts:174-204 the outer catch runs beforeError hooks on the `NetworkError` and rejects the ResponsePromise
- source/utils/type-guards.ts:31-33,75-77 public guards. The name fallback allows cross-realm checks, the same pattern as the other guards
- source/index.ts:73,79 exports `NetworkError` and `isNetworkError` as public API

### Risks and open questions
- Biggest: the base retried every non-HTTP error. Now a real network failure is retried only if its message is on the allowlist. Anything else loses retries silently: node-fetch's `FetchError`, other custom fetch adapters, Safari 'Load failed' with a stack, future runtime message changes. The readme only covers this with a caveat.
- False positives: undici's generic 'fetch failed' also wraps client-side errors such as an invalid URL scheme (test/memory-leak.ts:40, `invalid:`) or a content-length mismatch (test/headers.ts:127-144). These become `NetworkError` and are retried for GET/PUT/DELETE.
- Breaking for callers: code that checks `error instanceof TypeError`, `error.message === 'Failed to fetch'` or `error.cause.code` now gets a `NetworkError`, with the raw error one level deeper. That needs a major release.
- `isNetworkError` also matches by name, so a DOMException named 'NetworkError' (a legacy DOM name, for example from XHR-based fetch shims) passes the guard. It is typed as having `request` but has none, `isKyError` returns true, and `#calculateRetryDelay` retries it.
- undici 'terminated' mostly occurs while the body is read, after `#fetch` has resolved (for example in `.json()`). Those failures stay raw and are not retried, although the docs say network errors are retried.
- A non-Error value thrown by a custom fetch was retried before and now is not. This is intentional per the readme, but it is an unmentioned behavior change.
- source/types/retry.ts:129 still says "retryOnTimeout, status code checks, etc." and does not mention network errors. Minor doc drift.
