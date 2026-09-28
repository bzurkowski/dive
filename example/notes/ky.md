# ky
Purpose: Ky is a fetch-based HTTP client. This PR wraps the runtime's raw network `TypeError` in a new `NetworkError`, and retries only the errors it recognizes: HTTP status, timeout and network.

## Terms
- Network error (`NetworkError`): the Ky error for a request that got no response (DNS failure, connection refused, offline). It holds `request`, with the runtime's original error at `cause`.
- Raw network error (`isRawNetworkError`): a runtime `TypeError` whose message is a known network-failure text from Chrome, Firefox, Safari, Deno, Bun, Node (undici), cross-fetch or Cloudflare Workers. Inlined from `is-network-error` v1.3.1.
- Network error guard (`isNetworkError`): the public type guard. It is true for `instanceof NetworkError` or for any error whose `name` is `'NetworkError'`.
- Retry decision (`#calculateRetryDelay`): returns the wait before the next attempt, or throws the error to stop retrying.
- Retriable methods (`retry.methods`): the methods Ky retries by default: get, put, head, delete, options and trace. POST and PATCH are not retried.
- Custom retry rule (`retry.shouldRetry`): a user callback. `true` or `false` overrides the default decision, and `undefined` falls through to it.
- Backoff (`#calculateDelay`): `retry.delay(attempt)`, 0.3 s × 2^(n-1) by default, with optional jitter and capped by `backoffLimit`.

## Entry points
- source/index.ts:12 app code calls `ky(input, options)`, or a shortcut like `ky.get` at :16, to send a request
- source/index.ts:73 app code imports `NetworkError` for `instanceof` checks in a catch block
- source/index.ts:79 app code imports `isNetworkError` (source/utils/type-guards.ts:75) to narrow a caught error

## Calls out
- Runtime `fetch` (`globalThis.fetch` or `options.fetch`) sends the request. Its rejection is the error that gets classified
- User callbacks `retry.shouldRetry`, `hooks.beforeRetry` and `hooks.beforeError` receive the `NetworkError`
- No hop leaves the area: the area is the whole repo, so there are no `leaves:` markers

## Chains
### C1 `ky.get(url)`: fetch fails with a network error, and Ky wraps it and retries
1. App → Ky.create: `ky.get(url)` merges the options and builds a `Ky` and its response promise - source/index.ts:12-17, source/core/Ky.ts:84-99 - call, unchanged
2. Ky.create → Ky#retry: runs `#fetch` inside the retry wrapper - source/core/Ky.ts:100, source/core/Ky.ts:689-695 - call, unchanged
3. Ky#retry → Ky#fetch: starts one attempt, cloning the request for later retries - source/core/Ky.ts:792-811 - call, unchanged
4. Ky#fetch → timeout: races the fetch against the remaining total timeout. The call now sits inside a `try` and is awaited - source/core/Ky.ts:813-826 - call, changed
5. timeout → fetch: calls `options.fetch(request, init)` - source/utils/timeout.ts:24-26 - call, unchanged
6. fetch → timeout: rejects with a runtime `TypeError` such as `Failed to fetch` or `fetch failed` - error, unchanged
7. timeout → Ky#fetch: passes the rejection through and clears the timer - source/utils/timeout.ts:27-30 - error, unchanged
8. Ky#fetch → Ky#retry: `isRawNetworkError` recognizes the message, so it throws `new NetworkError(this.request, {cause})` - source/core/Ky.ts:827-830, source/utils/is-network-error.ts:19-49, source/errors/NetworkError.ts:9-17, test/retry.ts:1613-1631 - error, added
9. Ky#retry → Ky#retryFromError: the catch hands the `NetworkError` to the retry logic - source/core/Ky.ts:692-694 - call, unchanged
10. Ky#retryFromError → Ky#calculateRetryDelay: asks whether to retry and how long to wait - source/core/Ky.ts:700 - call, unchanged
11. Ky#calculateRetryDelay → Ky#retryFromError: the limit and method checks pass, the error is not a timeout or HTTP error, and `isNetworkError` is true, so it returns the backoff from `#calculateDelay` - source/core/Ky.ts:485-490, source/core/Ky.ts:405-421, source/core/Ky.ts:441-483, source/utils/type-guards.ts:75-77, source/core/Ky.ts:381-398, test/retry.ts:1675-1695 - return, changed
12. Ky#retryFromError → beforeRetry hooks: after the wait, each hook gets the `NetworkError` and `retryCount` - source/core/Ky.ts:701-746, test/hooks.ts:647-685 - call, unchanged
13. Ky#retryFromError → Ky#retry: increments `retryCount` and runs the next attempt - source/core/Ky.ts:782-783 - call, unchanged
14. Ky#retry → Ky.create: the attempt that succeeds returns its `Response` up through the retry wrappers - source/core/Ky.ts:691 - return, unchanged
15. Ky.create → App: the response goes through the afterResponse loop and resolves the promise - source/core/Ky.ts:107-171 - return, unchanged

### C2 NetworkError that cannot be retried: retries used up, or a POST
Starts at C1 hop 11.
1. Ky#calculateRetryDelay → Ky#retryFromError: throws the `NetworkError` when `retryCount` has reached `retry.limit` or the method is not in `retry.methods` - source/core/Ky.ts:406-408, source/core/Ky.ts:419-421, test/retry.ts:1697-1715 - error, unchanged
2. Ky#retryFromError → Ky.create: the throw unwinds `#retry` into the catch of the `result` wrapper - source/core/Ky.ts:174-187 - error, unchanged
3. Ky.create → beforeError hooks: each hook gets the `NetworkError` and the retry count - source/core/Ky.ts:188-202, test/hooks.ts:1604-1629, test/retry.ts:1780-1805 - call, unchanged
4. Ky.create → App: the promise rejects with the `NetworkError`, or with a hook's replacement, and the runtime error is at `error.cause` - source/core/Ky.ts:204, source/utils/type-guards.ts:31-33 - error, unchanged

### C3 Non-network error from fetch: not wrapped and not retried
Starts at C1 hop 7, for an error that `isRawNetworkError` does not recognize (a bug in a custom `fetch`, or an unknown runtime message).
1. Ky#fetch → Ky#retry: rethrows the error unchanged - source/core/Ky.ts:831-832, test/retry.ts:1740-1753 - error, added
2. Ky#retry → Ky#retryFromError: hands the error to the retry logic - source/core/Ky.ts:692-694 - call, unchanged
3. Ky#retryFromError → Ky#calculateRetryDelay: asks whether to retry - source/core/Ky.ts:700 - call, unchanged
4. Ky#calculateRetryDelay → Ky#retryFromError: the error is not a timeout, HTTP or network error, so it throws instead of falling through to the backoff - source/core/Ky.ts:485-488, old source/core/Ky.ts:475-477, test/retry.ts:1633-1651 - error, added
5. Ky#retryFromError → Ky.create: the throw unwinds to the `result` wrapper, then continues as C2 hops 3-4 - source/core/Ky.ts:174-187 - error, unchanged

### C4 `retry.shouldRetry` is set: the user callback decides first
Starts at C1 hop 10.
1. Ky#calculateRetryDelay → shouldRetry: calls it with `{error, retryCount}`. For a network failure the error is now the `NetworkError`, not the raw `TypeError` - source/core/Ky.ts:423-425, test/retry.ts:1717-1738 - call, unchanged
2. shouldRetry → Ky#calculateRetryDelay: returns `true`, `false` or `undefined` - return, unchanged
3. Ky#calculateRetryDelay → Ky#retryFromError: `true` returns the backoff even for a non-network error, `false` throws, and `undefined` falls through to the default checks of C1 hop 11 - source/core/Ky.ts:428-437, test/retry.ts:1653-1673, test/retry.ts:1755-1778 - return, unchanged

### C5 `timeout: false`: fetch runs without the timeout race detail
Starts at C1 hop 3.
1. Ky#fetch → fetch: calls `options.fetch` directly, now with `return await` so that the `catch` sees the rejection - source/core/Ky.ts:814-816, test/retry.ts:1807-1821 - call, changed
2. fetch → Ky#fetch: rejects with the runtime `TypeError`, and C1 hop 8 wraps it - error, unchanged

## Edge cases
- source/core/Ky.ts:827-830 fetch rejects with a recognized network `TypeError` -> it is thrown as `NetworkError` with the original at `cause`. Before this PR the raw `TypeError` reached callers
- source/core/Ky.ts:485-488 the error is not an HTTPError, TimeoutError or NetworkError, and `shouldRetry` did not return `true` -> it is thrown on the first attempt. Before this PR it fell through to the backoff and was retried (old source/core/Ky.ts:477)
- source/utils/is-network-error.ts:30-35 Safari 17+ `Load failed` -> it counts as a network error only when it has no stack, or when it has Sentry's `__sentry_captured__` marker

## Mechanical
- source/core/Ky.ts imports (:2, :24-25)
- source/utils/type-guards.ts imports (:3)
- source/index.ts exports (`NetworkError` at :73, `isNetworkError` at :79)
- source/errors/KyError.ts docs
- source/errors/HTTPError.ts docs (unrelated: the doc comment now mentions the `options` property)
- source/types/hooks.ts docs
- source/types/retry.ts docs (also fixes the `maxRetryAfter` wording: the delay is capped, the request is not canceled)
- source/types/options.ts docs (the `retry` doc lists all fields, adds the network-error paragraph, and drops the stale "Retries are not triggered following a timeout")
- readme.md docs (network retry paragraph at :265, `shouldRetry` at :292, hook docs at :456 and :529, `KyError` at :1089, `HTTPError` at :1114, new `NetworkError` section at :1179-1199)

## Detail

### Flow
- source/index.ts:12-17 Each `ky` call merges the instance defaults with the call's options and hands them to `Ky.create`. The method shortcuts only preset `method`.
- source/core/Ky.ts:100 `Ky.create` has built the `Ky` (retry options normalized with defaults), started the total-timeout clock and run the beforeRequest hooks. It then wraps `#fetch` in `#retry`, which tries one attempt and sends any throw to `#retryFromError`, which calls `#retry` again.
- source/core/Ky.ts:792-811 `#fetch` resets an aborted controller. When `retry.limit > 0` it clones the request, so the next attempt has an unread body, and points `this.request` at the clone.
- source/core/Ky.ts:813-826 The send now runs inside `try`, and both branches use `return await`. Without the `await`, a rejected promise would skip the new `catch`.
- source/utils/timeout.ts:24-26 `timeout` races `options.fetch` against a timer. When the timer wins it aborts and rejects with `TimeoutError`.
- source/utils/timeout.ts:27-30 A fetch rejection is forwarded unchanged with `.catch(reject)`, and the timer is cleared either way.
- source/core/Ky.ts:827-830 The new catch classifies the error. A recognized raw network `TypeError` becomes a `NetworkError` with the original as `cause`, so the retry logic, the hooks and the caller all see a Ky error that has `request`. `this.request` is the retry clone, the same request `TimeoutError` gets.
- source/utils/is-network-error.ts:19-49 The classifier requires a real `Error` (checked with `Object.prototype.toString`, so it works across realms) named `TypeError`. It then matches Safari's `Load failed` (only without a stack), Deno's `error sending request for url` prefix, Chrome's `Failed to fetch` with an optional `(host)` suffix, or an exact message from the set at :7-16.
- source/errors/NetworkError.ts:9-17 `NetworkError` extends `KyError`. It sets `name = 'NetworkError'`, which the name-based guard checks, and builds the message `Request failed due to a network error: <METHOD> <url>`. `cause` goes through the standard `Error` options.
- source/core/Ky.ts:692-694 Unchanged: the catch in `#retry` passes any error to `#retryFromError`.
- source/core/Ky.ts:700 `#retryFromError` awaits the decision and caps the delay at `maxSafeTimeout`. It checks the total-timeout budget before it waits.
- source/core/Ky.ts:485-490 The last default check changed from "retry anything" to "retry only a `NetworkError`". The earlier branches now end in an explicit `return this.#calculateDelay()` (timeout at :446, HTTP at :482), because the fall-through no longer retries. The checks run in this order: limit reached → throw, `ForceRetryError` → retry, method not retriable → throw (:405-421), and only then the error type. So a network error on a POST is thrown on the first attempt.
- source/core/Ky.ts:485-488 Any error not recognized as HTTP, timeout or network, including a plain `Error` or a thrown non-Error from a custom `fetch`, now stops the retry loop.
- source/core/Ky.ts:701-746 `delay` can be canceled only by the user's signal. After it and the timeout budget checks, the beforeRetry hooks get `error`, which for a network failure is now a `NetworkError` with `error.response` undefined.
- source/core/Ky.ts:782-783 Increments `#retryCount` and calls `#retry` again: one pass of the retry loop.
- source/core/Ky.ts:691 The successful attempt's `Response` returns through each nested `#retry` and `#retryFromError` to `Ky.create`.
- source/core/Ky.ts:107-171 The response goes through the afterResponse hooks and the `throwHttpErrors` check, then the promise resolves.
- source/core/Ky.ts:406-408 The limit check runs first, so the last network failure is thrown as the `NetworkError` itself. Before this PR it was the raw `TypeError`.
- source/core/Ky.ts:174-187 The `result` wrapper's catch passes non-Errors and errors thrown by beforeRetry hooks through unchanged. Every other error goes on to the beforeError hooks.
- source/core/Ky.ts:188-202 Each beforeError hook gets `{request, options, error, retryCount}`, and it can replace the error by returning another `Error`.
- source/core/Ky.ts:204 The caller receives the processed error. `isKyError` (source/utils/type-guards.ts:31-33) now also accepts a `NetworkError` by name, so it works across realms.
- source/core/Ky.ts:831-832 An unrecognized error is rethrown as is, so a plain `TypeError` bug keeps its type and message.
- source/core/Ky.ts:423-425 `shouldRetry` still runs before the default checks. It now gets the wrapped `NetworkError`, with the raw error at `.cause`.
- source/core/Ky.ts:428-437 `true` bypasses every default check, including the new network-only rule. That is how a user can keep retrying errors Ky does not recognize.
- source/core/Ky.ts:814-816 The `timeout: false` branch now awaits too. Before, it returned the fetch promise directly, and a `try` would not have caught its rejection.

### Tests
- test/retry.ts:1613-1631 pins source/core/Ky.ts:829: the `NetworkError` shape: `name`, the message `Request failed due to a network error: GET https://example.com/`, `request`, a `TypeError` cause, and `isKyError`
- test/retry.ts:1633-1651 pins source/core/Ky.ts:485-488: a non-network `TypeError` is fetched once, not retried
- test/retry.ts:1653-1673 pins source/core/Ky.ts:432-435: `shouldRetry: () => true` retries a non-network error up to the limit (3 fetches)
- test/retry.ts:1675-1695 pins source/core/Ky.ts:489: a `NetworkError` is retried by default until fetch succeeds
- test/retry.ts:1697-1715 pins source/core/Ky.ts:419-421: a POST network error is not retried and is still a `NetworkError`
- test/retry.ts:1717-1738 pins source/core/Ky.ts:425: `shouldRetry` receives the `NetworkError`, with the `TypeError` at `cause`
- test/retry.ts:1740-1753 pins source/core/Ky.ts:831-832: a non-network `TypeError` reaches the caller unwrapped
- test/retry.ts:1755-1778 pins source/core/Ky.ts:437: `shouldRetry` returning `undefined` falls through to the network retry
- test/retry.ts:1780-1805 pins source/core/Ky.ts:191-196: beforeError gets the `NetworkError` with its cause chain
- test/retry.ts:1807-1821 pins source/core/Ky.ts:815: `timeout: false` still wraps the error in `NetworkError`
- test/hooks.ts:647-685 pins source/core/Ky.ts:741-746: beforeRetry gets a `NetworkError` with no `response` (the thrown error changed from a plain `Error`, which is no longer retried)
- test/hooks.ts:1122-1156 pins source/core/Ky.ts:747-753: when beforeRetry rethrows the same `NetworkError`, beforeError still runs
- test/hooks.ts:1604-1629 pins source/core/Ky.ts:191-196: beforeError gets a `NetworkError` with `retryCount` 0
- test/hooks.ts:1631-1655 pins source/core/Ky.ts:195: `retryCount` is 2 after the network retries run out (an unchanged test)
- test/hooks.ts:1974-1998 pins source/core/Ky.ts:191-194: beforeError gets `request` and `options` for a `NetworkError`
- test/hooks.ts:2170-2216 pins source/core/Ky.ts:762-766: a non-ok Response returned by beforeRetry after a network error does not re-enter the retry loop (only the thrown message changed, to `Failed to fetch`)
- test/hooks.ts:3908-3929 pins source/core/Ky.ts:762-766: with `throwHttpErrors: false`, the beforeRetry fallback Response is returned (only the message changed)
- test/hooks.ts:4079-4106 pins source/core/Ky.ts:107-110: afterResponse hooks run on an ok Response from beforeRetry (only the message changed)
- test/headers.ts:127-144 pins source/core/Ky.ts:829: undici's `UND_ERR_REQ_CONTENT_LENGTH_MISMATCH` is now at `error.cause.cause.code`, one level deeper
- test/memory-leak.ts:34-52 pins source/core/Ky.ts:829: a failed POST of a stream body to `invalid:` throws `NetworkError` and does not leak the stream

### Risks and open questions
- Breaking change: network failures now reject with `NetworkError`, not `TypeError`. Code that checks `instanceof TypeError`, `error.message === 'Failed to fetch'` or undici's `error.cause.code` breaks, because the undici cause is now at `error.cause.cause` (test/headers.ts:142-143).
- Retries are narrower: before this PR every error from fetch fell through to the backoff (old source/core/Ky.ts:477). Now errors thrown by a custom `fetch` wrapper, thrown non-Errors, and network messages from runtimes the heuristic does not know are not retried. Five hook tests had to switch to `Failed to fetch` to keep retrying.
- Undici's `fetch failed` does not always mean a network failure. It also wraps an invalid URL scheme (test/memory-leak.ts:40) and a content-length mismatch (test/headers.ts:131-143). These become `NetworkError` and are retried for GET or PUT, which contradicts the doc's claim that programming bugs are thrown immediately.
- `isNetworkError` matches on `name`, so a `DOMException` named `NetworkError` passes it. Ky would retry it and TypeScript would narrow it to a Ky `NetworkError` that has no `request`. `isKyError` inherits this.
- Only rejections of the fetch call are wrapped. A network failure while reading the body (`.json()` or `.text()` at source/core/Ky.ts:226-246, undici `terminated` mid-stream) stays a raw `TypeError` and is never retried, so the `terminated` entry mostly fires only when a custom `fetch` reads the body itself.
- Detection depends on exact English messages. If a runtime changes its wording, wrapping and retrying stop silently (the readme note at readme.md:1185-1186 admits this).
- Open question: the existing `network error` test (test/retry.ts:18-34) uses `response.status(99_999)`. Under Express 5 this probably throws on the server and returns a 500, so the test may exercise HTTP retries rather than a real network error. Unverified.
