# Add NetworkError and tighten retry logic
Ky now wraps a recognized fetch network failure in a typed `NetworkError`. By default it retries only the errors it knows, and throws every other error at once.
PR: https://github.com/sindresorhus/ky/pull/842 · base 191057d135c1cfe07f9fa16978c2482969ccac20 · head 5703d624c6990817662a827be06dd006870acde8

## Story plan
- Change: `Ky#fetch` rethrows a fetch `TypeError` with a known runtime message as a `NetworkError`, and `#calculateRetryDelay` now retries only `HTTPError`, `TimeoutError` and `NetworkError`, where before it retried every other error too.
- Level: new - 0 of your commits touch source/core, source/utils, source/errors in the last year (new below 10)
- Flows: `retry` Wrap a failed fetch and retry it - trigger: a request such as `ky.get(url)`. One flow: every chain starts from the same request, and the backoff wait is a timer, not a stop.
- New names: `timeout`, `isRawNetworkError`, `errorMessages`, `NetworkError`, `isKyError`, `#calculateRetryDelay`, `isNetworkError`, `retryOnTimeout`, `shouldRetry` → `retry`
- Left out:
  - The `timeout: false` branch (notes/flow-retry.md Branches, notes/ky.md C5): a side path marked detail. Its changed `return await` is a code note in `wrap`.
  - `shouldRetry` deciding first (notes/ky.md C4, notes/flow-retry.md Not on this flow): unchanged code. The `decide` step says in one sentence that it runs before the type checks.
  - A total-timeout `TimeoutError` and a non-ok response's `HTTPError` (notes/flow-retry.md Other flows): other triggers whose paths the PR only touches with explicit returns. Those returns are code notes in `decide`; the flows go in the recap card "Other flows".
  - The other checks inside the inlined `isRawNetworkError` (the `isError` check, the Deno and Chrome message forms): internals of inlined code. The message list and the Safari rule carry the story.
  - Docs, imports and exports (notes/ky.md Mechanical): the recap card "Also changed".

## intro
- card Fetch errors are vague - fetch rejects with a plain `TypeError` whose message differs per runtime, and a bug can throw a `TypeError` too - notes/context.md Goal
- card Ky retried every error - before, any error that was not an `HTTPError` or a `TimeoutError` fell through to a retry, bugs included; issue #545 asked how to retry only real network errors. Links: #545 - notes/context.md Goal, Linked
- card The decision - wrap known network errors in `NetworkError` and retry only known error types; network errors from unknown runtimes lose retries, and `shouldRetry` is the escape hatch. Links: the two #545 decision comments - notes/context.md Decisions, Linked
- card Why the detector is inlined - `is-network-error` v1.3.1 is copied in and named `isRawNetworkError`, so it does not clash with the public `isNetworkError`. Links: is-network-error, the two PR comments - notes/context.md Decisions, Linked
- card A breaking change - it shipped under "Breaking" in v2.0.0. Links: the v2.0.0 release notes - notes/context.md Decisions (Ship as a breaking change), Linked

## glossary
- card Ky in five facts - the primer: Ky wraps `fetch`, each request is a `Ky` instance, a failed attempt goes to the retry decision, a retry waits a backoff, hooks let app code see each retry and each final error - notes/ky.md Purpose, Terms, Calls out
- terms Errors from fetch - raw network error (`isRawNetworkError`), runtime message list (`errorMessages`), `cause` - notes/ky.md Terms, notes/context.md Goal
- terms Ky's error types - `KyError`, `HTTPError`, `TimeoutError`, `NetworkError`, `isNetworkError` - notes/ky.md Terms, source/errors/KyError.ts, source/errors/NetworkError.ts
- terms The retry decision - retry decision (`#calculateRetryDelay`), retry limit (`retry.limit`), retriable methods (`retry.methods`), custom retry rule (`shouldRetry`), backoff (`#calculateDelay`), `beforeRetry` and `beforeError` hooks - notes/ky.md Terms, Calls out

## big-picture
One flow, so no overview sequence.
- diagram Which errors Ky retries - the three error sources (a non-ok response, the total timeout, a fetch rejection) and where each ends: `HTTPError` and `TimeoutError` retry by their options, a known fetch message becomes `NetworkError` and retries, any other error is thrown. Notes build from the sources to the outcomes - notes/flow-retry.md Flow, notes/flow-retry.md Other flows, source/core/Ky.ts:441-490
- quiz - a custom `fetch` throws `new Error('boom')` on a GET: how many fetch calls happen, and what does the caller get?

## walkthrough
### flow retry: Wrap a failed fetch and retry it
Trigger: app code sends a request, such as `ky.get(url)` - source/index.ts:12
Chains: notes/ky.md C1, notes/ky.md C2, notes/ky.md C3, notes/ky.md C4, notes/ky.md C5
Actors: app App (app), rhooks beforeRetry hooks (app), create `Ky.create` (ky), retry `Ky#retry` (ky), recover `Ky#retryFromError` (ky), decide `Ky#calculateRetryDelay` (ky, changed), kyfetch `Ky#fetch` (ky, changed), timeout `timeout` (ky), runtime Runtime fetch (outside)
1. app → create: `ky.get(url)` - source/index.ts:12-17, source/core/Ky.ts:84-99
2. create → retry: `#retry(() => #fetch())` - source/core/Ky.ts:100, source/core/Ky.ts:689-691
3. retry → kyfetch: `#fetch()` - source/core/Ky.ts:792-811
4. kyfetch → timeout: `await timeout(...)` inside a `try` (changed) - source/core/Ky.ts:813-826, old source/core/Ky.ts:809-812 → wrap
5. timeout → runtime: `options.fetch(request, init)` - source/utils/timeout.ts:24-25
6. runtime → timeout: `TypeError: Failed to fetch` (error)
7. timeout → kyfetch: rejection, timer cleared (error) - source/utils/timeout.ts:27-30
8. kyfetch → retry: `throw new NetworkError(request, {cause})` (error, added) - source/core/Ky.ts:827-830, source/utils/is-network-error.ts:18-49, source/errors/NetworkError.ts:9-17, test/retry.ts:1613-1631 → classify
9. retry → recover: `#retryFromError(error)` - source/core/Ky.ts:692-694
10. recover → decide: `#calculateRetryDelay(error)` - source/core/Ky.ts:700
11. decide → recover: backoff delay (return, changed) - source/core/Ky.ts:485-490, source/core/Ky.ts:405-421, source/core/Ky.ts:441-447, source/core/Ky.ts:482, source/utils/type-guards.ts:75-77, source/core/Ky.ts:381-398, test/retry.ts:1675-1695 → decide
12. recover → rhooks: `beforeRetry({error, retryCount})` - source/core/Ky.ts:701-725, source/core/Ky.ts:737-746, test/hooks.ts:647-685
13. recover → retry: `#retry(fn)`, second attempt - source/core/Ky.ts:782-783
14. retry → create: `Response` (return) - source/core/Ky.ts:691, source/core/Ky.ts:783, source/core/Ky.ts:693, source/core/Ky.ts:100
15. create → app: `Response` (return) - source/core/Ky.ts:107-171, source/core/Ky.ts:174-176
- code wrap - source/core/Ky.ts:813-826, source/core/Ky.ts:831-833, old source/core/Ky.ts:800-812 - both fetch paths (`timeout: false` at :814-816 and the timeout race) now run awaited inside one `try`, so its `catch` sees every rejection; an error it does not know, a `TimeoutError` included, is rethrown as it is - notes/flow-retry.md Flow, notes/flow-retry.md Branches (the `timeout: false` branch), notes/ky.md Tests (test/retry.ts:1740-1753, test/retry.ts:1807-1821)
- code classify - source/core/Ky.ts:827-830, source/utils/is-network-error.ts:48, source/utils/is-network-error.ts:7-16, source/utils/is-network-error.ts:31-35, source/errors/NetworkError.ts:9-17, source/utils/type-guards.ts:31-33, test/retry.ts:1613-1631 - a message from the runtime list turns the `TypeError` into a `NetworkError` that keeps the original at `cause`; Safari's "Load failed" counts only without a stack; `isKyError` now includes `NetworkError` - notes/flow-retry.md Flow, notes/ky.md Terms, notes/ky.md Edge cases (is-network-error.ts:30-35), notes/ky.md Tests (test/retry.ts:1613-1631)
- code decide - source/core/Ky.ts:441-447, old source/core/Ky.ts:439-440, source/core/Ky.ts:482, source/core/Ky.ts:485-490, source/utils/type-guards.ts:75-77, test/retry.ts:1675-1695 - the timeout and HTTP branches now return their delay, then a guard throws any error that is not a `NetworkError`, so only a `NetworkError` reaches the old backoff line; `say` names the unchanged gates that run first (limit, `ForceRetryError`, method, `shouldRetry`) - notes/flow-retry.md Flow, notes/flow-retry.md Corrections, notes/ky.md Tests (test/retry.ts:1633-1651, test/retry.ts:1675-1695)
- quiz - the runtime rejects a GET with "fetch failed" on the first try and succeeds on the second: what does the app get, and what did the `beforeRetry` hook see?
- edge An unknown error fails on the first try
  1. kyfetch → retry: rethrow the original error (error, added) - source/core/Ky.ts:831-832, test/retry.ts:1740-1753 → wrap
  2. retry → recover: `#retryFromError(error)` - source/core/Ky.ts:692-694
  3. recover → decide: `#calculateRetryDelay(error)` - source/core/Ky.ts:700
  4. decide → recover: throw error (error, added) - source/core/Ky.ts:485-488, test/retry.ts:1633-1651 → decide
  5. recover → create: throw (error) - source/core/Ky.ts:174-187
  6. create → app: reject with the original error (error) - source/core/Ky.ts:204
- edge Retries run out, and the app gets the NetworkError
  Actors: ehooks beforeError hooks (app)
  1. decide → recover: throw `NetworkError` (error) - source/core/Ky.ts:406-408, source/core/Ky.ts:419-421, test/retry.ts:1697-1715, test/hooks.ts:1631-1655
  2. recover → create: throw (error) - source/core/Ky.ts:174-187
  3. create → ehooks: `beforeError({request, options, error, retryCount})` - source/core/Ky.ts:188-196, test/hooks.ts:1604-1629, test/retry.ts:1780-1805
  4. ehooks → create: error (return) - source/core/Ky.ts:198-201
  5. create → app: reject with `NetworkError`, runtime error at `cause` (error) - source/core/Ky.ts:204, test/headers.ts:127-144

## review-focus
- card What to check - what the new classification gets wrong: undici's "fetch failed" also covers an invalid URL scheme and a content-length mismatch, which now retry; body-read failures stay raw `TypeError`s; a `DOMException` named `NetworkError` passes `isNetworkError`; detection depends on exact English messages - notes/ky.md Risks and open questions, notes/flow-retry.md Risks and open questions
- card Who loses retries or breaks - callers that check `instanceof TypeError` or `error.cause.code`; custom `fetch` errors and unknown runtimes no longer retry; the #545 `beforeRetry` workaround with `is-network-error` now sees a `NetworkError` and stops retrying; neither the PR nor the release notes mention it - notes/ky.md Risks and open questions, notes/flow-retry.md Risks and open questions, notes/context.md Open questions

## recap
- card Also changed - one line per item - notes/ky.md Mechanical
- card Other tests - the tests the walkthrough did not show: `shouldRetry` forcing and falling through, beforeRetry rethrowing, the hook tests that switched to "Failed to fetch", the memory-leak test - notes/ky.md Tests, notes/context.md Tests
- card Other flows - a total-timeout `TimeoutError` (source/utils/timeout.ts:16-22) and a non-ok response's `HTTPError` (source/core/Ky.ts:127-149); then where to read next: the readme's NetworkError section and #545 - notes/flow-retry.md Other flows, notes/context.md Linked
