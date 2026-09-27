# Tests and docs for NetworkError and stricter retry
Purpose: pin down the new contract in tests and the readme. A fetch failure that looks like a network error now reaches callers and hooks as a `NetworkError` (the raw `TypeError` is kept in `cause`). Only `NetworkError`, `HTTPError` and `TimeoutError` are retried by default; any other error is thrown right away.

## Terms
- NetworkError (`NetworkError`): a new `KyError` subclass thrown by `#fetch` when the fetch implementation rejects with a recognized network `TypeError`. It has `request`, `cause` holds the original error, and its message is `Request failed due to a network error: <METHOD> <url>`.
- Raw network error (`isRawNetworkError`): a heuristic inlined from `is-network-error` v1.3.1. It recognizes a runtime's fetch `TypeError` by its exact message (`Failed to fetch`, `fetch failed`, `network error`, `terminated`, `Load failed` without a stack, and others).
- Public type guard (`isNetworkError`): `instanceof NetworkError` or `name === 'NetworkError'`, so the check also works across realms. `isKyError` now includes it too.
- Default retry fallthrough (`#calculateRetryDelay` tail): the step that runs after the `shouldRetry`, timeout and HTTP checks. It used to retry any error. Now it throws unless the error is a `NetworkError`.
- Unrecognized error: any error from `fetch` whose message the heuristic does not recognize, such as a thrown bug `TypeError('Cannot read properties of undefined')`. It passes through unchanged and is not retried.

## Entry points
- test/retry.ts:1613 ava runs the new NetworkError/retry block (tests at 1613-1821) through `npm test` (`xo && npm run build && ava`).
- test/hooks.ts:647 ava runs the hook tests that feed a stub `fetch` which throws `TypeError('Failed to fetch')`.
- test/headers.ts:127 ava runs a real undici request whose content-length mismatch fails as `fetch failed`.
- test/memory-leak.ts:34 ava runs `ky.post('invalid:')`, which makes undici reject with `fetch failed`.
- readme.md:265 users read about the retry policy. readme.md:1179 is the new `NetworkError` API section.

## Flow
1. [flow, core] source/core/Ky.ts:813-833 `#fetch` wraps the fetch call and the timeout race in try/catch. When `isRawNetworkError(error)` matches, it throws `new NetworkError(this.request, {cause})`; any other error is rethrown untouched. This is the one place wrapping happens, so every test below that stubs `fetch` to throw `TypeError('Failed to fetch')` goes through here.
2. [flow, core] source/core/Ky.ts:485-490 This is the new tail of `#calculateRetryDelay`. It runs after the limit, method, `shouldRetry`, timeout and HTTP checks. An error that is not a `NetworkError` is thrown instead of retried. Before this PR, any error reached `return this.#calculateDelay()` and was retried.
3. [flow, detail] source/core/Ky.ts:441-447 and :477-482 The timeout branch and the HTTP branch now `return this.#calculateDelay()` themselves. Without that, the new `!isNetworkError` guard would throw them. The existing retry.ts tests `retryOnTimeout: true ...` (1067, 1093) and the status-code tests cover this.
4. [flow, core] test/retry.ts:1613-1631 `NetworkError wraps fetch network errors`. With `retry: 0`, a stub `fetch` throws `TypeError('Failed to fetch')`. The test checks `instanceof NetworkError`, `isNetworkError`, `isKyError`, the `name`, the `request.url`, that `cause` is the original `TypeError`, and the exact message `Request failed due to a network error: GET https://example.com/`.
5. [flow, core] test/retry.ts:1675-1695 `NetworkError is retried by default`. `fetch` throws twice and then returns `ok`. With `limit: 2` it makes 3 calls in total, so a network error still goes through the default retry path.
6. [flow, core] test/retry.ts:1633-1651 `non-network TypeError is not retried`. `TypeError('Cannot read properties of undefined')` with `limit: 2` gives exactly 1 fetch call. This is the "tighten retry logic" half of the PR: the fallthrough no longer retries unknown errors.
7. [flow, core] test/retry.ts:1740-1753 `non-network TypeError is not wrapped in NetworkError`. The same bug-like `TypeError` reaches the caller unchanged: `instanceof TypeError`, `isNetworkError` is false, and the message is kept.
8. [flow, core] test/retry.ts:1653-1673 `shouldRetry can force retry of non-network errors`. `shouldRetry: () => true` gets 3 calls for the same unknown `TypeError`. This escape hatch is what the readme NOTE (readme.md:1185-1186) points users to for runtimes the heuristic does not recognize.
9. [flow, core] test/retry.ts:1717-1738 `shouldRetry receives NetworkError (not raw TypeError)`. Wrapping happens before retry decisions, so `shouldRetry` sees `isNetworkError(error)` with `cause instanceof TypeError`.
10. [flow, detail] test/retry.ts:1755-1778 When `shouldRetry` returns `undefined`, the error falls through to the default logic, and a `NetworkError` is still retried (3 calls).
11. [flow, detail] test/retry.ts:1780-1805 The `beforeError` hook receives the `NetworkError`, the same object the caller would get, with its `cause` chain. test/hooks.ts:1604-1629 (assert at 1627) checks the same thing: it used to assert `message === 'Failed to fetch'` and now asserts `isNetworkError`.
12. [flow, detail] test/retry.ts:1807-1821 With `timeout: false`, `#fetch` takes the direct `await this.#options.fetch(...)` path (Ky.ts:814-816). The error is still wrapped, which shows the try/catch covers both branches. The `await` was added so that a rejection is caught inside the try block.
13. [flow, core] test/hooks.ts:647-685 (changes at 664, 672) `beforeRetry hook is called even if the error has no response`. The stub used to throw `new Error('simulated network failure')`. That error would no longer be retried, so the hook would never run. The stub now throws `TypeError('Failed to fetch')`, and the hook asserts `isNetworkError(error)` and `error.response === undefined`.
14. [flow, detail] test/hooks.ts:1122-1156 (changes at 1126, 1155) `beforeError runs when beforeRetry rethrows network errors`. `beforeRetry` rethrows the same `NetworkError`. Because `hookError === error`, Ky.ts:748-751 does not mark it as a hook error, so `beforeError` still runs and edits the message. The final error is `isNetworkError`; it used to be `instanceof TypeError`.
15. [flow, core] test/headers.ts:141-143 This is a real undici failure (`UND_ERR_REQ_CONTENT_LENGTH_MISMATCH`), where undici rejects with `TypeError('fetch failed')`. That error is now wrapped, so the undici code sits one level deeper at `error.cause.cause.code`. It used to be at `error.cause.code`. This is a user-visible break for anyone who reads undici codes such as `ECONNREFUSED` off `cause`.
16. [flow, detail] test/memory-leak.ts:4, 39-46 `ky.post('invalid:')` rejects in undici with `fetch failed`. The expectation changes from `{instanceOf: TypeError, message: 'fetch failed'}` to `{instanceOf: NetworkError}`, and the stream-leak check stays the same.
17. [type, core] readme.md:1179-1199 This is the new `### NetworkError` section. It covers `request` and `cause`, says network errors are retried for retriable methods, and has a NOTE that detection is heuristic and unrecognized runtimes produce errors that are not wrapped (use `shouldRetry`). The example uses `isNetworkError`.
18. [type, core] readme.md:265 and readme.md:292 These describe the retry policy. Network errors are retried for retriable methods, and all other errors are thrown immediately. `shouldRetry` returning `undefined` means "default logic: `retryOnTimeout`, status codes, network errors", and unrecognized types are not retried.
19. [type, detail] readme.md:456, 529, 1089, 1114 These update cross-references. `beforeRetry` and the `HTTPError` docs now say that a failure with no response is a `NetworkError`. The `beforeError` docs list `NetworkError` and `isNetworkError()`, and the `KyError` docs list `NetworkError` as a subclass.

## Edge cases
- test/retry.ts:1697-1715 A POST fails with a network error -> it is wrapped as a `NetworkError` but not retried (1 call), because the method check in Ky.ts:419-421 runs before any type check.
- test/hooks.ts:3908-3929 (change at 3919) `throwHttpErrors: false` with a stub that throws a network error and a `beforeRetry` hook that returns a 502 `Response` -> the retry happens and the hook's response is returned. The stub had to change from `TypeError('network down')` to `'Failed to fetch'`. Otherwise the error is now thrown before `beforeRetry` runs.
- test/hooks.ts:4079-4106 (change at 4089) When `beforeRetry` returns an ok `Response` after a network error, that response goes through the `afterResponse` hooks. It needs the same message change as the previous item, for the same reason.
- test/hooks.ts:4135-4205 (unchanged) Stubs that throw `TypeError('network error')` in lowercase are still retried, because `'network error'` is Chrome's message in the heuristic set. A network error followed by an HTTP 500 shares one retry budget.
- test/retry.ts:605-633 (unchanged) The stub throws `new Error('fetch failed')`, whose name is `Error`, not `TypeError` -> it is not wrapped, and with `limit: 0` the same object reaches the caller (`is: expectedError`).
- source/utils/is-network-error.ts:31-36 Safari `Load failed` counts as a network error only when `stack` is undefined or Sentry has marked it. No test in this area covers that, or the Deno, Firefox, Bun or Cloudflare messages.

## Mechanical
- test/retry.ts:3-8 import list expanded (`NetworkError`, `isKyError`, `isNetworkError`), replaces old test/retry.ts:3
- test/hooks.ts:7 import `isNetworkError`
- test/hooks.ts:1974 rename test title "network TypeError" -> "NetworkError" (body unchanged)
- test/hooks.ts:2170-2216 (change at 2189) boilerplate test: message changed to `'Failed to fetch'` for consistency. Not required, because `shouldRetry` returns `true` and forces the retry anyway.
- test/memory-leak.ts:4 import `NetworkError`
- test/headers.ts:141 explanatory comment added, replaces old test/headers.ts:142 assertion

## Risks and open questions
- Breaking change for callers who catch `TypeError` or read `error.message === 'Failed to fetch'` or `error.cause.code`. They now get a `NetworkError` with the codes one level deeper (headers.ts:143). This probably needs a major-version note.
- Custom `fetch` wrappers or runtimes that reject with their own messages (for example `'network down'`, or a React Native polyfill variant) used to be retried and are now silently not retried. The only remedy is `shouldRetry: () => true`, which skips all other checks.
- undici's `fetch failed` is a catch-all: a content-length mismatch (headers.ts) and an invalid scheme `invalid:` (memory-leak.ts) both become `NetworkError`. For retriable methods (GET, PUT) such configuration bugs are now retried with backoff, which contradicts the "programming bugs are thrown immediately" wording in readme.md:265.
- Only `#fetch` wraps errors. Network failures while reading the body (undici `terminated` during `.json()`/`.text()`) reach the caller as a raw `TypeError`, even though `'terminated'` is in the heuristic list. No test covers it.
- The detection heuristic has no unit tests, and neither does the cross-realm branch (`name === 'NetworkError'`) of `isNetworkError`. Every test uses Chrome's `'Failed to fetch'` or Node's `'fetch failed'`.
- The existing test/retry.ts:18-34 `network error` sets status 99_999. Under Express 5, `res.status` probably throws a `RangeError`, which becomes a 500, so the test likely exercises HTTP 500 retry rather than a real socket failure. That would leave real-network retry covered only by stubs.
