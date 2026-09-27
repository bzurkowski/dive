# Tests and docs
Purpose: Pin down the new contract: runtime network failures from `fetch` come out as `NetworkError` with the raw error in `cause` and are retried by default, while any other thrown error is passed through unwrapped and is never retried by default. The readme documents the same contract.

## Terms
- NetworkError (`NetworkError`): new `KyError` subclass thrown by `Ky.#fetch` when the raw fetch rejection looks like a network failure; it has `request`, its `cause` is the raw error, and its message is `Request failed due to a network error: <METHOD> <URL>` (source/errors/NetworkError.ts:9-17).
- Raw network error check (`isRawNetworkError`): message-based heuristic for a raw `TypeError` coming out of fetch. It matches `Failed to fetch`, `fetch failed`, `terminated`, `Load failed` with no stack, and others (source/utils/is-network-error.ts:18-49). The tests fake a network error by throwing `new TypeError('Failed to fetch')`.
- Network error type guard (`isNetworkError`): public guard that passes on `instanceof NetworkError` or on `name === 'NetworkError'` (source/utils/type-guards.ts:75-77). `isKyError` now accepts it too.
- Non-network TypeError: the tests use `new TypeError('Cannot read properties of undefined')` as a stand-in for a programming bug. It is neither wrapped nor retried.

## Entry points
- test/retry.ts:1613 ava (`npm test` = `xo && npm run build && ava`, package.json:25) runs the 10 new NetworkError/retry tests. Each one injects a custom `fetch` that throws.
- test/hooks.ts:664 and similar: the existing hook tests go through `Ky.#retry` -> `#fetch` -> `#retryFromError` -> `beforeRetry`/`beforeError` (source/core/Ky.ts:100, 697-784, 189-204).
- test/headers.ts:127 and test/memory-leak.ts:34 use real undici `fetch` against a live server or an `invalid:` URL, so they exercise the real `fetch failed` wrapping path.
- readme.md:265, 1179 are the user-facing entry points for the retry and NetworkError docs.

## Flow
1. test/retry.ts:3-8 import `NetworkError`, `isKyError` and `isNetworkError` from the public index, which proves they are exported (source/index.ts:73,79).
2. test/retry.ts:1613-1631 `retry: 0` plus a fetch that throws `TypeError('Failed to fetch')`. The catch in `Ky.#fetch` (source/core/Ky.ts:827-833) wraps it, so the thrown error is `instanceof NetworkError`, passes `isNetworkError` and `isKyError`, has `name` `NetworkError`, `request.url`, a `cause` that is the original TypeError, and the exact message `Request failed due to a network error: GET https://example.com/`.
3. test/retry.ts:1675-1695 the default retry policy retries NetworkError. The fetch fails twice, then returns `ok`, giving 3 calls. The path is the new last branch of `#calculateRetryDelay`, where `isNetworkError` returns `#calculateDelay()` (source/core/Ky.ts:485-490).
4. test/retry.ts:1633-1651 a non-network TypeError with `limit: 2` gives exactly 1 fetch call, and the raw TypeError is rethrown. This is the behavior change: before, the fall-through at old source/core/Ky.ts:479 retried any error. Now source/core/Ky.ts:486-488 throws it.
5. test/retry.ts:1740-1753 a non-network TypeError is not wrapped. It comes out as a plain `TypeError` with its original message, and `isNetworkError` is false (source/core/Ky.ts:832).
6. test/retry.ts:1653-1673 `shouldRetry: () => true` still forces retries of an unknown error: 1 initial call plus 2 retries = 3 calls, then the raw TypeError. `shouldRetry` runs before the new `isNetworkError` gate (source/core/Ky.ts:424-435), so it remains the escape hatch.
7. test/retry.ts:1717-1738 `shouldRetry` receives the wrapped `NetworkError`, not the raw TypeError. This holds because wrapping happens inside `#fetch`, before `#calculateRetryDelay` runs.
8. test/retry.ts:1755-1778 when `shouldRetry` returns `undefined` for a NetworkError, control falls through to the defaults and the error is retried (3 calls).
9. test/retry.ts:1780-1805 `beforeError` receives the NetworkError with its cause chain intact (source/core/Ky.ts:189-204).
10. test/retry.ts:1807-1821 with `timeout: false`, the error is still a NetworkError. This covers the `timeout === false` branch, which now does `return await this.#options.fetch(...)` (source/core/Ky.ts:814-815). Without the added `await`, the rejection would bypass the `catch`.
11. test/hooks.ts:7 imports `isNetworkError`. test/hooks.ts:664,672 change the injected failure from `new Error('simulated network failure')` to `TypeError('Failed to fetch')` and assert `isNetworkError(error)` in `beforeRetry`. The old plain `Error` would no longer be retried, so `beforeRetry` would never run.
12. test/hooks.ts:1126,1155 `beforeRetry` rethrows the same NetworkError. Because `hookError === error`, it is not added to `#beforeRetryHookErrors` (source/core/Ky.ts:749-751), so `beforeError` still runs. The final assertion changes from `instanceof TypeError` to `isNetworkError`.
13. test/hooks.ts:1627 `beforeError` now asserts `isNetworkError(receivedError)` instead of the raw message `Failed to fetch`, because the message is now Ky's wrapper message.
14. test/hooks.ts:3919, 4089 change `'network down'` to `'Failed to fetch'`. These tests use the default retry policy, so an unrecognized message would no longer be retried and the `beforeRetry` Response fallback would never be reached. The change is required, not cosmetic.
15. test/headers.ts:142-143 real undici: a content-length mismatch produces `TypeError('fetch failed')`, which is now wrapped. The undici code moves from `error.cause.code` to `error.cause.cause.code`.
16. test/memory-leak.ts:4,44 (old 44-45) in the failed stream POST to `invalid:`, undici's `fetch failed` is now caught as `instanceOf: NetworkError`. The `message: 'fetch failed'` assertion is dropped because the message is now Ky's.
17. readme.md:265-266 a new paragraph: network errors are retried for retriable methods, unrecognized errors are thrown immediately, and `shouldRetry` is the override.
18. readme.md:292 the `shouldRetry` return value `undefined` now lists "network errors" among the defaults and adds that unrecognized error types are not retried.
19. readme.md:456, 1114 `beforeRetry` and HTTPError docs: an error with no response is now "an instance of `NetworkError`" rather than "not an instance of `HTTPError`".
20. readme.md:529, 1089 `beforeError` lists `NetworkError` and the `isNetworkError()` guard. `KyError` lists `NetworkError` as a subclass.
21. readme.md:1179-1200 new `### NetworkError` section covering `request`, `cause`, retry for retriable methods, a note that detection is a heuristic (errors from unrecognized runtimes stay unwrapped, so use `shouldRetry`), and an `isNetworkError` example.

## Edge cases
- test/retry.ts:1697-1715 NetworkError on POST -> 1 call, NetworkError thrown. The method check (source/core/Ky.ts:419-421) runs before the network-error branch.
- test/retry.ts:1633-1651 unknown TypeError with retries left -> thrown on the first attempt, not after the limit.
- test/retry.ts:1653-1673 `shouldRetry` returns true for an unknown error -> retried up to the limit. After that, the raw (unwrapped) TypeError is thrown.
- test/retry.ts:1807-1821 `timeout: false` -> wrapping still applies. This guards the added `return await`.
- test/hooks.ts:2189 `shouldRetry` returns true, so the `'network down'` -> `'Failed to fetch'` swap here is only for consistency. The test would pass either way.
- test/headers.ts:142-143 a client-side content-length bug surfaces as NetworkError, because undici reports it as `fetch failed`.
- test/memory-leak.ts:44 an invalid URL scheme (`invalid:`) surfaces as NetworkError, for the same reason.

## Mechanical
- test/hooks.ts:1974 renames the test title from `...for network TypeError` to `...for NetworkError`. The body is unchanged.
- test/retry.ts:3-8 changes the import from a single line to multi-line.

## Risks and open questions
- undici maps nearly every failure to `TypeError('fetch failed')`, including client bugs (content-length mismatch, unknown scheme; see headers.ts:143, memory-leak.ts:44). Those become NetworkError and are retried for GET/PUT, which contradicts the readme's "programming bugs are thrown immediately" (readme.md:265).
- Breaking change for custom `fetch` implementations: errors that are not a TypeError, or have an unlisted message (node-fetch `FetchError`, axios adapters, `'network down'`), were retried before and now are not. The tests in hooks.ts had to change for this reason.
- The tests only cover the `Failed to fetch` (Chrome) and `fetch failed` (undici) messages. No test covers Safari's `Load failed`/stack check, Deno, Bun, Cloudflare, `terminated`, or `Failed to fetch (host)` in source/utils/is-network-error.ts.
- `isNetworkError` duck-types on `name === 'NetworkError'`, so a DOMException named `NetworkError` also passes: it gets retried, and the guard claims a `.request` property it lacks. No test covers this.
- When `shouldRetry` forces retries of an unknown error, the final thrown error is the raw error, not a KyError (retry.ts:1653-1673). This is intended, but callers checking `isKyError` will not catch it.
