# Context: ky#842, Add `NetworkError` class and tighten retry logic

PR https://github.com/sindresorhus/ky/pull/842 by sindresorhus, one commit (5703d62, message "Fixes #545"), approved by sholladay, merged 2026-03-25. The PR description says only "Fixes #545". There are no inline review comments.

## Goal

Before this PR, ky passed raw fetch failures to the caller unchanged. These are vague `TypeError`s whose message depends on the runtime ("Failed to fetch", "fetch failed", "Load failed", ...). The default retry logic also retried any error that was not an `HTTPError` or a disabled-retry `TimeoutError`, programming bugs included (`old source/core/Ky.ts:438-477`). Issue #545 asked how to retry only real network errors.

The PR does two things:

- **Normalize.** `#fetch` checks each error thrown by `fetch`/`timeout` against a list of runtime network-error messages. A match is rethrown as a new `NetworkError extends KyError`, with the request on `error.request` and the original error on `error.cause` (`source/core/Ky.ts:813-833`, `source/errors/NetworkError.ts:1-17`, `source/utils/is-network-error.ts:1-49`).
- **Tighten.** The default retry path now retries only three kinds of error: `HTTPError` (by `statusCodes`), `TimeoutError` (by `retryOnTimeout`) and `NetworkError`. Any other error is thrown at once (`source/core/Ky.ts:440-490`).

The PR also exports `NetworkError` and `isNetworkError` and adds `NetworkError` to `isKyError` (`source/index.ts:73`, `source/index.ts:79`, `source/utils/type-guards.ts:32`, `source/utils/type-guards.ts:75-77`). The docs are updated to match.

## Decisions

- **Wrap recognized fetch errors in a `NetworkError` class.** The class normalizes errors that are "so inconsistent and vague". Source: sholladay's proposal in #545 (https://github.com/sindresorhus/ky/issues/545#issuecomment-2282900749), which sindresorhus approved with a +1 (https://github.com/sindresorhus/ky/issues/545#issuecomment-2284297812). The class extends `KyError`, keeps the raw error as the standard `cause`, and uses the message `Request failed due to a network error: METHOD URL` (`source/errors/NetworkError.ts:9-16`).
- **Retry only known error types (an allow-list).** Everything else is thrown immediately. Source: sholladay proposed it in #545 ("only retry `NetworkError` and `HTTPError`, obviating the need for that hook"), and sindresorhus called it "the most pragmatic solution" (same two comments). The commit title calls this "tighten retry logic". In code, the old fall-through `return this.#calculateDelay()` (`old source/core/Ky.ts:477`) becomes explicit returns for the timeout and HTTP branches (`source/core/Ky.ts:441-447`, `source/core/Ky.ts:482`), followed by a final `if (!isNetworkError(error)) throw error;` (`source/core/Ky.ts:485-488`).
- **Accept that network errors from unknown runtimes are no longer retried.** sholladay named this downside and offered an alternative: a deny-list that detects errors that should not be retried (such as `TypeError`s from bad options) and retries the rest, "err on the side of retries". sindresorhus rejected it: "the benefits may outweigh this single downside. New runtimes don't come along every day." Source: #545 comments 2282900749 and 2284297812. The readme documents the limit and names `shouldRetry` as the escape hatch (`readme.md:1185-1186`).
- **Inline `is-network-error` v1.3.1 instead of adding a dependency.** sholladay: "Inlining the dependency seems a bit silly to me given that Ky already has a compile step." sindresorhus: "Would be more complicated to do compile for dependency, and not worth the effort for a single one that won't update very often." Source: PR conversation (https://github.com/sindresorhus/ky/pull/842#issuecomment-4124136417, https://github.com/sindresorhus/ky/pull/842#issuecomment-4125351489). A header comment marks the copy (`source/utils/is-network-error.ts:1`). ky's `package.json` has no runtime `dependencies`.
- **Name the inlined detector `isRawNetworkError`.** The public `isNetworkError` then means "is a ky `NetworkError`", matching the `isHTTPError`/`isTimeoutError` guards (an `instanceof` or `name` check, so it works across realms). Source: code only, no discussion (`source/core/Ky.ts:24-25`, `source/utils/type-guards.ts:75-77`).
- **Wrap in `#fetch`, around both the `timeout: false` path and the `timeout()` path.** Every error reaches the retry logic, `shouldRetry`, `beforeRetry` and `beforeError` already wrapped. Wrapping needs `await` inside the new `try` (`source/core/Ky.ts:813-833`, replacing `old source/core/Ky.ts:800-812`). Source: code, pinned by the tests "NetworkError is thrown when timeout is disabled" and "shouldRetry receives NetworkError (not raw TypeError)".
- **Keep the existing gates in front of the new rule.** The retry limit, `ForceRetryError`, the retriable-method check and a user `shouldRetry` all still run first. `shouldRetry` returning `true` still forces a retry of any error, and returning `undefined` falls through to the new defaults (`source/core/Ky.ts:405-438`). Source: code and readme (`readme.md:265`, `readme.md:292`, `source/types/retry.ts:138`).
- **Fix stale retry JSDoc along the way.** The `retry` JSDoc in `source/types/options.ts` said "Retries are not triggered following a timeout" and that a too-large `Retry-After` "will cancel the request". The PR replaces both with the readme wording ("it will use `maxRetryAfter`") and lists all the retry fields (`source/types/options.ts:148-156`, `source/types/retry.ts:45`). The `HTTPError` JSDoc now mentions `options`. Source: the diff, no discussion.
- **Ship as a breaking change in v2.0.0.** Source: the release notes list it under "Breaking": "Add `NetworkError` class and tighten retry logic (#842)" (https://github.com/sindresorhus/ky/releases/tag/v2.0.0, first in v2.0.0-0). At the PR commit, `package.json` is still at 1.14.3.

## Linked

- Issue #545, "Best way to handle Fetch errors such as Failed to fetch, NetworkError when attempting to fetch resource, etc.": https://github.com/sindresorhus/ky/issues/545. It holds the design discussion: sindresorhus's 2023 `beforeRetry` + `is-network-error` workaround and his `shouldRetry` idea, then sholladay's 2024 `NetworkError` and allow-list proposal and sindresorhus's approval. Later comments (gvillo) confirm that ky already retried all fetch errors by default, and that the error a user saw was `TypeError: Failed to fetch` from the Instagram in-app browser.
- `is-network-error` (source of the inlined detector, v1.3.1): https://github.com/sindresorhus/is-network-error. #545 links its code at https://github.com/sindresorhus/is-network-error/blob/main/index.js.
- PR conversation: https://github.com/sindresorhus/ky/pull/842#issuecomment-4124136417 (sholladay) and https://github.com/sindresorhus/ky/pull/842#issuecomment-4125351489 (sindresorhus). Approval: https://github.com/sindresorhus/ky/pull/842#pullrequestreview-4004317155.
- Release notes listing the PR as breaking: https://github.com/sindresorhus/ky/releases/tag/v2.0.0 and https://github.com/sindresorhus/ky/releases/tag/v2.0.0-0.
- New readme section: https://github.com/sindresorhus/ky#networkerror (`readme.md:1179-1199`).

## Tests

New tests in `test/retry.ts`:

- `test/retry.ts:1613` "NetworkError wraps fetch network errors": a `TypeError('Failed to fetch')` becomes a `NetworkError` that is also a `KyError`, with `name`, `request`, `cause` and the message `Request failed due to a network error: GET https://example.com/`.
- `test/retry.ts:1633` "non-network TypeError is not retried": a `TypeError('Cannot read properties of undefined')` with `limit: 2` gives exactly 1 fetch. This is the heart of the tightening.
- `test/retry.ts:1653` "shouldRetry can force retry of non-network errors": `shouldRetry: () => true` still retries that error (3 fetches). This is the escape hatch.
- `test/retry.ts:1675` "NetworkError is retried by default": two failures, then success, gives `ok` after 3 fetches.
- `test/retry.ts:1697` "NetworkError is not retried for non-retriable method (POST)": the method check still wins, so 1 fetch.
- `test/retry.ts:1717` "shouldRetry receives NetworkError (not raw TypeError)": `shouldRetry` sees the wrapped error, and `cause` is the `TypeError`.
- `test/retry.ts:1740` "non-network TypeError is not wrapped in NetworkError": a non-network `TypeError` is rethrown unchanged.
- `test/retry.ts:1755` "shouldRetry returning undefined for NetworkError falls through to default retry": `undefined` from `shouldRetry` leads to the default rule, which retries.
- `test/retry.ts:1780` "beforeError hook receives NetworkError with cause chain": `beforeError` sees the wrapped error.
- `test/retry.ts:1807` "NetworkError is thrown when timeout is disabled": wrapping also covers the `timeout: false` branch.

Updated tests (the changes show where old behavior breaks):

- `test/hooks.ts:647`, `test/hooks.ts:1122`, `test/hooks.ts:2170`, `test/hooks.ts:3908`, `test/hooks.ts:4079`: the fake `fetch` used to throw `new Error('simulated network failure')` or `TypeError('network down'/'network-down')`. These now throw `TypeError('Failed to fetch')`, because arbitrary errors are no longer retried. The assertions now check `isNetworkError(error)` instead of the message or `instanceof TypeError` (`test/hooks.ts:664`, `test/hooks.ts:672`, `test/hooks.ts:1126`, `test/hooks.ts:1155`, `test/hooks.ts:2189`, `test/hooks.ts:3919`, `test/hooks.ts:4089`).
- `test/hooks.ts:1604` "beforeError hook receives network errors": it asserts `isNetworkError` instead of the message `Failed to fetch` (`test/hooks.ts:1627`). `test/hooks.ts:1974` is only renamed to "...for NetworkError".
- `test/headers.ts:127` "setting `content-length` to 0": the undici error code is now at `error.cause.cause.code`, one level deeper, because undici's `TypeError('fetch failed')` is wrapped (`test/headers.ts:142-143`).
- `test/memory-leak.ts:34` "failed stream request must not cause memory leak": it expects `instanceOf: NetworkError` instead of `TypeError` with the message `fetch failed` (`test/memory-leak.ts:43-45`).

## Open questions

- **Silent loss of retries.** Two kinds of network error are no longer retried: those from unrecognized runtimes, and those from custom `fetch` implementations or wrappers that throw their own error types (a plain `Error`, a non-`TypeError`, or a message outside the list). Before, ky retried them. Now they reach the caller unwrapped, on the first attempt. The maintainers accepted this in #545, and `shouldRetry` is the documented workaround. Nobody discussed how many real environments fall outside the message list.
- **The #545 workaround now breaks retries.** The workaround imports `isNetworkError` from the `is-network-error` package into a `beforeRetry` hook and throws when it returns false. That hook now gets a ky `NetworkError` (`name` is `'NetworkError'`, not `'TypeError'`), so the package check fails and every network error is thrown. That turns retries off. ky's new `isNetworkError` export has the same name but a different meaning. Neither the PR nor the release notes mention this migration step.
- **Code that inspects the raw error must change.** Code that read `error.cause.code` (undici), checked `instanceof TypeError`, or matched `error.message === 'Failed to fetch'` now has to go one level down through `cause`. The v2.0.0 notes call the PR breaking but do not spell this out.
- **Keeping the copy current.** The inlined `is-network-error` is pinned to v1.3.1, and nothing keeps it in sync with the upstream package. The maintainer's view is that it "won't update very often".
