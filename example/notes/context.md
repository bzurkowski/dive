# PR #842 context: `NetworkError` class and tighter retry logic

PR: https://github.com/sindresorhus/ky/pull/842 by sindresorhus. Opened 2026-03-24, merged 2026-03-25. One commit, 5703d62. The body is only "Fixes #545". sholladay approved it: https://github.com/sindresorhus/ky/pull/842#pullrequestreview-4004317155

## Goal

Fetch network failures are vague `TypeError`s whose message changes by runtime ("Failed to fetch", "fetch failed", "Load failed", ...). Users could not tell them apart from bugs. Ky also retried every thrown error, so a programming bug in a custom `fetch` or a hook got retried as if it were a flaky network (issue #545). The PR does two things:

1. Recognize raw network errors and wrap them in a new `NetworkError` (a `KyError` with `request` and `cause`), exported with an `isNetworkError()` type guard.
2. Retry only known retriable errors: `HTTPError` (existing status rules), `TimeoutError` (when `retryOnTimeout`), `NetworkError`, and `ForceRetryError`. Anything else is thrown right away unless `shouldRetry` says otherwise.

## Decisions

- **Wrap recognized fetch errors in a dedicated `NetworkError` class.** The goal is to normalize errors that are "so inconsistent and vague". sholladay proposed it: https://github.com/sindresorhus/ky/issues/545#issuecomment-2282900749. sindresorhus agreed: https://github.com/sindresorhus/ky/issues/545#issuecomment-2284297812
- **Allowlist, not denylist: retry only `NetworkError`, `HTTPError`, and `TimeoutError`, and throw unknown errors.** sholladay laid out both options and said he would "prefer retries" (a denylist of known non-retriable errors, such as bad-option `TypeError`s): https://github.com/sindresorhus/ky/issues/545#issuecomment-2282900749. sindresorhus chose the allowlist as "the most pragmatic solution". He accepted that a runtime with an unknown message will not get retries: "New runtimes don't come along every day." https://github.com/sindresorhus/ky/issues/545#issuecomment-2284297812. This also removes the need for the `beforeRetry` + `is-network-error` workaround from 2023: https://github.com/sindresorhus/ky/issues/545#issuecomment-1815967114
- **`shouldRetry` is the escape hatch.** sindresorhus first suggested a `retry.shouldRetry` for this use case in 2023: https://github.com/sindresorhus/ky/issues/545#issuecomment-1815967114. It already existed before this PR. Now the readme names it as the way to handle unrecognized runtimes. `true` forces a retry of any error, and `undefined` falls through to the new stricter default (readme and `source/types/retry.ts`).
- **Inline `is-network-error` v1.3.1 instead of adding a dependency.** The copy lives in `source/utils/is-network-error.ts`, renamed `isRawNetworkError` so it does not clash with the public guard. The readme says Ky is "a tiny package with no dependencies". sholladay found inlining "a bit silly" since Ky has a compile step: https://github.com/sindresorhus/ky/pull/842#issuecomment-4124136417. sindresorhus: compiling a dependency in "would be more complicated ... and not worth the effort for a single one that won't update very often": https://github.com/sindresorhus/ky/pull/842#issuecomment-4125351489
- **Wrap in one place: a `try/catch` around the whole `#fetch` body.** It covers both the `timeout: false` path and the `timeout()` path. The `return`s became `return await` so the catch sees rejections. Non-network errors are rethrown unchanged. Source: code only. The test "NetworkError is thrown when timeout is disabled" pins the `timeout: false` path.
- **Explicit `return this.#calculateDelay()` in the timeout and `HTTPError` branches of `#calculateRetryDelay`.** Before, both fell through to a shared `return`. Now the fall-through ends in `if (!isNetworkError(error)) throw error`, so without the explicit returns, retriable timeouts and HTTP errors would be thrown. Source: code only.
- **`isNetworkError()` checks `instanceof` or `name === 'NetworkError'`, and `isKyError()` includes it.** This matches the cross-realm pattern of the existing guards. Source: code only.
- **Incidental doc fixes in the same commit.** The `retry` JSDoc now matches the readme: it lists all fields and drops the stale "Retries are not triggered following a timeout." The `maxRetryAfter` doc changed from "request will be canceled" to "it will use `maxRetryAfter`". Source: code only.

## Linked

- Issue #545, "Best way to handle Fetch errors such as Failed to fetch, NetworkError when attempting to fetch resource, etc." Opened 2023-11-17 by thojanssens, closed by this PR on 2026-03-25: https://github.com/sindresorhus/ky/issues/545
  - The 2023 workaround (`beforeRetry` hook + `isNetworkError` + `statusCodes: [0]`) and the idea for `shouldRetry`: https://github.com/sindresorhus/ky/issues/545#issuecomment-1815967114
  - sholladay confirms that Ky "currently retr[ies] all fetch errors, whether they are network errors or not": https://github.com/sindresorhus/ky/issues/545#issuecomment-2387120439
  - sholladay notes that some browsers report CORS failures as "Failed to fetch": https://github.com/sindresorhus/ky/issues/545#issuecomment-2387581487
  - A real-world case, `TypeError: Failed to fetch` in the Instagram in-app browser: https://github.com/sindresorhus/ky/issues/545#issuecomment-2391298182
- `sindresorhus/is-network-error`, the inlined source (v1.3.1): https://github.com/sindresorhus/is-network-error (the issue links `index.js`: https://github.com/sindresorhus/is-network-error/blob/main/index.js)
- No other tickets or pages are referenced. The PR has no inline review comments.

## Tests

New tests in `test/retry.ts`:
- A recognized fetch error (`TypeError('Failed to fetch')`) becomes a `NetworkError`. It passes `instanceof`, `isNetworkError` and `isKyError`, has `name` `'NetworkError'` and a `request`, keeps the original `TypeError` in `cause`, and has the message `Request failed due to a network error: GET https://example.com/`.
- A `TypeError` that is not a network error (`'Cannot read properties of undefined'`) is not wrapped and is **not retried** (1 fetch call with `limit: 2`).
- `shouldRetry: () => true` still forces retries of that non-network error (3 calls).
- `NetworkError` is retried by default and succeeds on the 3rd attempt.
- `NetworkError` is not retried for POST, a non-retriable method (1 call).
- `shouldRetry` receives the wrapped `NetworkError`, not the raw `TypeError`.
- `shouldRetry` returning `undefined` falls through to the default, which retries `NetworkError`.
- `beforeError` receives the `NetworkError` with its `cause` chain.
- Wrapping also happens with `timeout: false`.

Updated existing tests:
- `test/hooks.ts`: fake fetch failures changed from arbitrary messages (`'simulated network failure'`, `'network-down'`, `'network down'`) to `'Failed to fetch'`. Arbitrary errors are no longer retried or wrapped, so those tests would stop reaching `beforeRetry`. Assertions moved from checking the message or `instanceof TypeError` to `isNetworkError(error)`.
- `test/headers.ts`: the undici error code is now at `error.cause.cause.code` (one level deeper), because undici's "fetch failed" `TypeError` is wrapped.
- `test/memory-leak.ts`: a failed stream upload now throws `NetworkError` instead of `TypeError` with `'fetch failed'`.

## Open questions

- **Is this a breaking change, and how will it ship?** The PR does not say. Callers that catch `TypeError`, match `error.message === 'Failed to fetch'`, or read `error.cause.code` now see a different shape. Any non-network error (including thrown non-`Error` values wrapped in `NonError`, and custom `fetch` errors) is no longer retried by default.
- **The documented #545 workaround now disables retries.** A `beforeRetry` hook that calls the `is-network-error` package's `isNetworkError(error)` now receives Ky's `NetworkError`. Its `name` is `'NetworkError'`, not `'TypeError'`, so the package returns `false`, the hook rethrows, and retries stop. Should the readme warn about this?
- **Unknown runtimes.** sholladay's concern still stands: network errors with unrecognized messages are neither wrapped nor retried, and users must know to reach for `shouldRetry`. Nothing keeps the inlined copy in sync with upstream `is-network-error`, the drift sholladay raised.
- **Body-read failures are not covered.** Wrapping covers only the `fetch` call in `#fetch`. The list includes undici's `'terminated'`, but a connection dropped while reading the body (e.g. during `.json()`) seems to fall outside the wrap and the retry loop. Is that intended?
