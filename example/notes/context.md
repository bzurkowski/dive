# PR 842 context: `NetworkError` and tighter retries

PR https://github.com/sindresorhus/ky/pull/842 by sindresorhus. Opened 2026-03-24, merged 2026-03-25. It is one commit (`5703d62`) whose message and PR body both say only "Fixes #545". sholladay approved it. It shipped in v2.0.0-0 (2026-03-29), where the release notes list it under "New", not under "Breaking".

## Goal

Fetch rejects with a vague `TypeError` whose message depends on the runtime ("Failed to fetch", "NetworkError when attempting to fetch resource.", "fetch failed", "Load failed", ...). Before this PR, Ky retried every error it did not recognise, so network failures and programming bugs were both retried. Issue #545 asked how to retry only real network errors.

The PR does two things:

1. **Normalize.** When fetch (or the `timeout()` wrapper around it) rejects with an error that the inlined `is-network-error` heuristic recognises, `#fetch` in `source/core/Ky.ts` rethrows it as a new `NetworkError extends KyError`. The new error has `request`, `cause` set to the original error, and the message `Request failed due to a network error: <METHOD> <URL>`. `NetworkError` and an `isNetworkError()` type guard are exported, and `isKyError()` now recognises `NetworkError` too.
2. **Tighten retries.** In `#calculateRetryDelay`, the default logic now retries only `TimeoutError` (when `retryOnTimeout` is set), `HTTPError` (retriable status codes) and `NetworkError`. Any other error is thrown at once. `shouldRetry` still runs first: returning `true` forces a retry of any error, and `undefined` falls through to the default logic.

## Decisions

- **Wrap recognised fetch errors in a `NetworkError` class**, "to normalize them and make it more obvious what's going on, since the fetch errors are so inconsistent and vague." Source: sholladay's comment on #545, answered with a thumbs-up from sindresorhus.
- **Retry only `NetworkError` and `HTTPError` by default** (and `TimeoutError` when opted in). sholladay suggested this so users no longer need a `beforeRetry` hook to filter out non-network errors, and sindresorhus called it "the most pragmatic solution". Source: #545 comments.
- **Accept that network errors from unknown runtimes are no longer retried.** sholladay raised the downside, offered an alternative (detect errors that should *not* be retried and retry the rest), and said "I would prefer retries, myself." sindresorhus overruled this: "the benefits may outweigh this single downside. New runtimes don't come along every day." Source: #545 comments. The mitigation is a readme `[!NOTE]` telling users to handle such errors with `shouldRetry`. Source: diff, `readme.md`.
- **`shouldRetry` is the escape hatch.** sindresorhus proposed a `retry.shouldRetry` function in his first reply on #545. It already existed at the base commit, and this PR documents it as the way to override the new default ("Unrecognized error types are not retried"). Source: #545 first comment; diff to `readme.md` and `source/types/retry.ts`.
- **Inline `is-network-error` v1.3.1 instead of depending on it** (`source/utils/is-network-error.ts`, renamed `isRawNetworkError` so it does not clash with the public `isNetworkError` guard). sholladay found inlining "a bit silly" because Ky already has a compile step. sindresorhus replied that compiling a dependency "would be more complicated ... and not worth the effort for a single one that won't update very often." Source: PR 842 comments.
- **Keep the original error on `cause` and wrap only after the fetch or timeout call.** Errors thrown before or outside that call (hooks, option handling) pass through unwrapped, and a `TypeError` that is not a network error is rethrown as is. Source: diff, `source/core/Ky.ts` `#fetch`, and the tests below.
- **Return explicitly from the timeout and HTTP branches.** The fallback at the end of `#calculateRetryDelay` now throws, so the `retryOnTimeout` and retriable-status paths each need their own `return this.#calculateDelay()`. Source: diff, `source/core/Ky.ts`.
- **Update the docs at the same time.** The `retry` JSDoc in `source/types/options.ts` now matches the readme. The PR removes the stale "Retries are not triggered following a timeout" line and changes the `maxRetryAfter` wording from "cancel the request" to "use `maxRetryAfter`". The hook docs now name `NetworkError` where they used to say "network errors" or "not an HTTPError". Source: diff.

## Linked

- PR: https://github.com/sindresorhus/ky/pull/842
- Issue #545, "Best way to handle Fetch errors such as Failed to fetch, NetworkError when attempting to fetch resource, etc.", by thojanssens, opened 2023-11-17 and closed by this PR: https://github.com/sindresorhus/ky/issues/545. The reporter saw occasional "Failed to fetch" errors that they could not reproduce and asked whether Ky could retry only network errors. The thread includes the design discussion above. A later user (gvillo) reported an Instagram in-app browser `TypeError: Failed to fetch`, and sholladay confirmed that Ky "currently retr[ies] all fetch errors, whether they are network errors or not", which is the behavior this PR changes.
- Upstream heuristic that was inlined: https://github.com/sindresorhus/is-network-error (v1.3.1). The issue links its source at https://github.com/sindresorhus/is-network-error/blob/main/index.js
- Release that shipped the change: https://github.com/sindresorhus/ky/releases/tag/v2.0.0-0

## Tests

New in `test/retry.ts`:
- `NetworkError wraps fetch network errors`: `TypeError('Failed to fetch')` becomes a `NetworkError`. The test checks `instanceof`, `isNetworkError`, `isKyError`, `name`, `request.url`, `cause` (the original `TypeError`) and the exact message `Request failed due to a network error: GET https://example.com/`.
- `non-network TypeError is not retried`: `TypeError('Cannot read properties of undefined')` with `limit: 2` gives exactly 1 fetch call. This is the core behavior change.
- `non-network TypeError is not wrapped in NetworkError`: that error surfaces as the raw `TypeError` with its message unchanged.
- `shouldRetry can force retry of non-network errors`: `shouldRetry: () => true` gives 3 fetch calls (1 initial and 2 retries).
- `NetworkError is retried by default`: two network failures and then a success give `'ok'` after 3 calls.
- `NetworkError is not retried for non-retriable method (POST)`: the method check still applies, so there is 1 call.
- `shouldRetry receives NetworkError (not raw TypeError)`: the wrapped error is what reaches `shouldRetry`, with the raw `TypeError` on `cause`.
- `shouldRetry returning undefined for NetworkError falls through to default retry`: the network error is retried under the default logic.
- `beforeError hook receives NetworkError with cause chain`: the error passed to `beforeError` is the wrapped one.
- `NetworkError is thrown when timeout is disabled`: wrapping also covers the `timeout: false` branch, which calls `options.fetch` directly.

Updated existing tests:
- `test/hooks.ts`: fake fetch failures changed from arbitrary messages (`'simulated network failure'`, `'network-down'`, `'network down'`) to `'Failed to fetch'`, because unrecognised messages are no longer treated as network errors or retried. Assertions changed from `instanceof TypeError` and message checks to `isNetworkError(...)`.
- `test/headers.ts`: the undici code moves from `error.cause.code` to `error.cause.cause.code`, because undici's "fetch failed" `TypeError` is now wrapped. Anyone reading `error.cause` will see this break.
- `test/memory-leak.ts`: the failed stream request now rejects with `NetworkError` instead of `TypeError('fetch failed')`.

## Open questions

- **Network errors that are not recognised stop being retried, and nothing tells the user.** A network error from a runtime or wrapper whose message is not in the list is no longer retried. Examples: a fetch polyfill with a custom message, or Safari "Load failed" when a stack is present from a monitoring tool other than Sentry. sholladay preferred retrying in this case and was overruled. Only a readme note and `shouldRetry` cover the gap. Is there any telemetry or follow-up on how many of these cases exist?
- **Is this a breaking change that the release notes list as "New"?** Code that followed the workaround in #545 (calling the `is-network-error` package's `isNetworkError` inside `beforeRetry` and throwing otherwise) now receives a `NetworkError` whose `name` is `'NetworkError'`, not `'TypeError'`. The package's check fails, so that hook throws and retries stop. `instanceof TypeError` checks and `error.cause.code` reads also change. v2.0.0-0 lists #842 under "New", not "Breaking".
- **The `isNetworkError` guard matches by name.** It returns `error instanceof NetworkError || error?.name === 'NetworkError'`, so any error named `NetworkError` passes, for example a browser `DOMException` with that name. Such an error would be retried and typed as having `request`, even though it has none. Is that intended cross-realm leniency?
- **Nothing keeps the inlined heuristic in sync.** The copy is pinned to is-network-error v1.3.1 and has no check against upstream. Since unrecognised messages now mean "no retry", a new runtime message added upstream reaches Ky users only when someone copies it over by hand.
- **Non-`Error` throws (`NonError`) are no longer retried** under the default logic, because they are not `NetworkError`. This is probably intended, but no test or note covers it.
