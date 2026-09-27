# PR #842 context: Add `NetworkError` class and tighten retry logic

base `191057d` .. head `5703d62` (one commit, Sindre Sorhus, 2026-03-25). Merged 2026-03-25T10:20Z. Approved by sholladay.

## Goal

Close #545: users could not tell a real network failure ("Failed to fetch", "NetworkError when attempting to fetch resource.") from any other thrown error. Before this PR, Ky retried *every* non-HTTP, non-timeout error, programming bugs included. Fetch network errors reached users as vague raw `TypeError`s whose message depends on the runtime.

The PR does two things:
1. Wraps recognized raw fetch network errors in a new `NetworkError` (a `KyError` subclass). It carries `request`, and the original error is kept as `cause`.
2. Changes the default retry decision from "retry anything unknown" to "retry only known retriable types": `HTTPError` (per status rules), `TimeoutError` (if `retryOnTimeout`), and `NetworkError`. Anything else is thrown immediately.

## Decisions

1. **Normalize network errors into a `NetworkError` class, keeping the original as `cause`.**
   Source: sholladay, #545 comment 2024-08-11 ("wrap fetch errors in a `NetworkError` class when `isNetworkError()` returns `true` ... since the fetch errors are so inconsistent and vague"). sindresorhus replied "👍" on 2024-08-12. Code: `source/errors/NetworkError.ts`. The message is `Request failed due to a network error: <METHOD> <URL>`.

2. **Retry only `NetworkError` / `HTTPError` / `TimeoutError` by default, and throw unknown errors (fail closed).**
   Source: sholladay proposed it in #545 on 2024-08-11 ("only retry `NetworkError` and `HTTPError`, obviating the need for that hook"). He also named the downside: a new runtime's unrecognized network errors would stop being retried, and he said he would personally prefer to err toward retrying. sindresorhus chose the allowlist anyway on 2024-08-12: "That sounds like the most pragmatic solution ... the benefits may outweigh this single downside. New runtimes don't come along every day."
   Code: `#calculateRetryDelay` in `source/core/Ky.ts` adds `if (!isNetworkError(error)) throw error;` at the end. The timeout and HTTPError branches now `return this.#calculateDelay()` explicitly, because falling through would hit the new throw.

3. **`shouldRetry` is the escape hatch for anything the heuristic misses.**
   Source: sindresorhus first proposed `retry.shouldRetry` in #545 on 2023-11-17 as the cleaner alternative to a `beforeRetry` + `is-network-error` hook. It shipped in #767 (`f0fdbd4`, 2025-10-19). This PR's readme says: "Unrecognized runtimes may produce errors that are not wrapped in `NetworkError`. Use the `shouldRetry` option to handle such cases." `shouldRetry` still runs before the default checks, so `true` retries any error and `undefined` falls through to the new default.

4. **Inline `is-network-error` v1.3.1 instead of adding a dependency.**
   Source: PR thread. sholladay (2026-03-25): "Inlining the dependency seems a bit silly to me given that Ky already has a compile step. But overall, LGTM." sindresorhus: "Would be more complicated to do compile for dependency, and not worth the effort for a single one that won't update very often." Ky keeps zero runtime `dependencies` (package.json 1.14.3). Code: `source/utils/is-network-error.ts`, exported internally as `isRawNetworkError` so it does not clash with the public `isNetworkError` guard.

5. **Wrap at the `#fetch` boundary only.** A single `try/catch` covers both the `timeout: false` path and the `timeout()` path, and wraps only when `isRawNetworkError(error)` is true. Everything else is rethrown untouched. Source: diff to `Ky.ts`, and the test "NetworkError is thrown when timeout is disabled".

6. **Public type guard `isNetworkError()` uses the same cross-realm pattern as the other guards** (`instanceof NetworkError || error.name === 'NetworkError'`), and `isKyError()` now includes it. Source: `source/utils/type-guards.ts`, `source/index.ts` exports.

7. **The method gate still comes first.** A network error on a non-retriable method such as POST is not retried. Source: the existing order in `#calculateRetryDelay`, pinned by a new test.

8. **Incidental doc fixes** in `source/types/options.ts` and `retry.ts` JSDoc. The retry JSDoc now lists every retry field. The stale "Retries are not triggered following a timeout" is removed (`retryOnTimeout` exists). `maxRetryAfter` now reads "it will use `maxRetryAfter`" instead of "cancel the request". The RateLimit draft link moves from -02 to -05. The `HTTPError` JSDoc mentions `options`. Source: diff. These bring the JSDoc in line with the readme and are not tied to #545.

## Linked

- PR #842: https://github.com/sindresorhus/ky/pull/842
  - sholladay approval + inlining comment: https://github.com/sindresorhus/ky/pull/842#issuecomment-4124136417
  - sindresorhus reply on inlining: https://github.com/sindresorhus/ky/pull/842#issuecomment-4125351489
- Issue #545 "Best way to handle Fetch errors such as Failed to fetch, NetworkError when attempting to fetch resource, etc." (opened 2023-11-17, closed by this PR): https://github.com/sindresorhus/ky/issues/545
  - `beforeRetry` + `isNetworkError` hook workaround, first `shouldRetry` idea: https://github.com/sindresorhus/ky/issues/545#issuecomment-1815967114
  - Design proposal (wrap + retry allowlist + the downside): https://github.com/sindresorhus/ky/issues/545#issuecomment-2282900749
  - Maintainer sign-off ("most pragmatic"): https://github.com/sindresorhus/ky/issues/545#issuecomment-2284297812
  - Confirms old behavior, "We currently retry all fetch errors": https://github.com/sindresorhus/ky/issues/545#issuecomment-2387120439
  - Real-world report, `TypeError: Failed to fetch` from the Instagram in-app browser: https://github.com/sindresorhus/ky/issues/545#issuecomment-2391298182
- Upstream detector that was inlined: https://github.com/sindresorhus/is-network-error (v1.3.1)
- Prior PR #767, which added `retryOnTimeout` and `shouldRetry` (commit `f0fdbd4`): https://github.com/sindresorhus/ky/pull/767
- No external tickets. The PR body is only "Fixes #545".

## Tests

New tests in `test/retry.ts`:
- **NetworkError wraps fetch network errors**: `TypeError('Failed to fetch')` becomes a `NetworkError` that passes `instanceof`, `isNetworkError` and `isKyError`, with `name === 'NetworkError'`, a `request.url`, `cause` set to the original `TypeError`, and the exact message `Request failed due to a network error: GET https://example.com/`.
- **Non-network TypeError is not wrapped**: `TypeError('Cannot read properties of undefined')` comes through as a raw `TypeError`.
- **Non-network TypeError is not retried**: `limit: 2` still gives 1 fetch call. This is the "tighten" half.
- **shouldRetry can force retry of non-network errors**: `shouldRetry: () => true` gives 3 calls (1 initial + 2 retries). This pins the escape hatch.
- **NetworkError is retried by default**: 2 failures then success returns `'ok'` after 3 calls.
- **Not retried for POST**: the method gate beats the network-error rule (1 call, and the error is still a `NetworkError`).
- **shouldRetry receives NetworkError, not the raw TypeError**: wrapping happens before the retry decision.
- **shouldRetry returning `undefined` falls through to the default**, so `NetworkError` is retried.
- **beforeError receives NetworkError with the cause chain.**
- **NetworkError is thrown when `timeout: false`**: both fetch paths wrap.

Existing tests changed to match the new behavior:
- `test/hooks.ts`: mocks that threw arbitrary messages (`'simulated network failure'`, `'network-down'`, `'network down'`) now throw `TypeError('Failed to fetch')`. With arbitrary messages they would no longer be retried or wrapped. Assertions moved from `instanceof TypeError` / message checks to `isNetworkError(...)`. Covers `beforeRetry` (error has no `response`), `beforeError` for rethrown and initial network errors, and `beforeRetry` returning a `Response`.
- `test/headers.ts`: the undici code moved one level deeper, `error.cause.cause.code === 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH'`. This pins the wrapping on real undici `fetch failed` errors, not only on mocks.
- `test/memory-leak.ts`: a failed stream request now throws `NetworkError` instead of `TypeError('fetch failed')`.

Not covered: `NonError` (non-`Error` throws) and `AbortError` are no longer retried by default, and no test pins that. There is also no test for the Safari `Load failed`, Deno, Bun or Cloudflare message branches of the inlined detector.

## Open questions

1. **Main: fail-closed heuristic.** Only errors whose message matches the inlined allowlist are wrapped and retried. Any other runtime, message variant or wrapper around fetch (a custom `fetch`, a polyfill, a Safari `Load failed` whose stack was added by a monitoring tool other than Sentry) now gets **no retry**, where before it got one. sholladay flagged this and preferred retrying. It was accepted as a tradeoff, and nothing in the code or docs signals when an unrecognized error was skipped. Is `shouldRetry` enough as mitigation, or should there be a fallback?
2. **Breaking change not called out.** Callers who catch `instanceof TypeError` or read `error.cause` / `error.message` now see a `NetworkError`. Worse, the workaround recommended in #545 (a `beforeRetry` hook that does `if (!isNetworkError(error)) throw error` using the `is-network-error` package) now throws on every network error. That package requires `name === 'TypeError'` and `NetworkError.name` is `'NetworkError'`, so the hook silently turns retries off. Was this released as semver-major, with a migration note?
3. **Same name, different meaning.** Ky's exported `isNetworkError()` checks the wrapped Ky class. `is-network-error`'s `isNetworkError()` checks the raw `TypeError`. Users importing both could mix them up.
4. **The duck-typed guard is too broad.** `error.name === 'NetworkError'` also matches a standard `DOMException` named `NetworkError`. Such an error would pass `isNetworkError` and `isKyError`, and be retried, without having a `request` property.
5. **Scope of wrapping.** Only errors thrown inside `#fetch` are wrapped. Undici's `terminated` (in the allowlist) usually shows up while reading the body (`.json()` / `.text()`), outside `#fetch`, so users still get a raw `TypeError` there. Is that intended?
6. **Keeping the inlined copy in sync.** Nothing ties `source/utils/is-network-error.ts` to upstream releases. The maintainer's view is that it "won't update very often".
