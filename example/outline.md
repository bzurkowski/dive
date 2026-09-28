# Add NetworkError and tighten retry logic
Ky now wraps a fetch network failure in a typed `NetworkError`. By default it retries only errors it knows, and throws every other error at once.

## Story plan
- Change: `#fetch` wraps a recognized fetch `TypeError` in the new `NetworkError`. The end of `#calculateRetryDelay` now retries only a `NetworkError` and throws any unknown error, where before it retried everything.
- Layers: the runtime message set and `isRawNetworkError` (inlined, one note) → the `NetworkError` class and the `isNetworkError` guard → `#fetch` wraps the error → `#calculateRetryDelay` decides retry or throw
- Diagrams: one diagram of the request path: `#retry` → `#fetch` → fetch → `isRawNetworkError` → `NetworkError` → `#calculateRetryDelay`
- Left out: `is-network-error.ts` internals such as the Safari `Load failed` stack rule and the Deno prefix (inlined code the change does not use); unchanged checks in `#calculateRetryDelay` (limit, `ForceRetryError`, method, `shouldRetry`), said once in a `say`; `TimeoutError` passing through the catch unchanged (said by the catch note); the hook tests (listed in Also changed); tests that only repeat a behavior note (NetworkError shape, retried by default, not wrapped, POST, `undefined` falls through, `beforeError` sees the cause, `timeout: false`); doc comment edits (Also changed); the "network error" test at status 99_999 (unchanged test)

Names used in every chapter: `NetworkError`, raw network error (`isRawNetworkError`), `isNetworkError`, retry decision (`#calculateRetryDelay`), `shouldRetry`, `cause`, retriable method (`retry.methods`), retry limit (`retry.limit`).

## why
- card: The problem - fetch rejects with a raw `TypeError` whose message differs per runtime (`Failed to fetch`, `fetch failed`, `Load failed`); Ky retried every thrown error, so a bug in a custom `fetch` or a hook was retried like a network blip (#545) - notes/context.md Goal, Linked
- card: The decision - wrap recognized network errors in `NetworkError`; retry only known error types and throw the rest (allowlist, chosen over a denylist, accepted that unknown runtimes lose retries); `shouldRetry` is the escape hatch; `is-network-error` v1.3.1 is inlined to keep zero dependencies. Links: #545, the proposal comment, the sign-off comment, the PR comment on inlining - notes/context.md Decisions, Linked

## glossary
- terms: the 8 names above, each with its identifier - notes/source.md Terms, notes/tests-docs.md Terms

## big-picture
- diagram: the request path. Nodes: caller, `#retry`, `#fetch`, fetch implementation (`options.fetch`), `isRawNetworkError`, `NetworkError`, `#calculateRetryDelay`, `shouldRetry`. Notes walk it in 3 parts: one attempt (`#retry` → `#fetch` → fetch), the wrap (`#fetch` asks `isRawNetworkError`, throws `NetworkError`), the decision (`#retry` hands the error to `#calculateRetryDelay`, which may ask `shouldRetry`, then retries or throws to the caller) - notes/source.md Entry points, Flow 4-8 (Ky.ts:100, 689-700)
- sequence: a GET whose fetch rejects once with `TypeError('Failed to fetch')`, then succeeds. Actors: caller, `#retry`, `#fetch`, fetch, `#calculateRetryDelay`. One pass: call, reject, wrap, ask for a delay, delay returned, second call, response - notes/source.md Flow 4-5, notes/tests-docs.md Flow 5
- quiz - a GET whose custom fetch always throws `TypeError('Failed to fetch')`, retry limit 2: how many fetch calls, and what does the caller catch (3 calls, `NetworkError` with the `TypeError` in `cause`)

## walkthrough
- code source/errors/NetworkError.ts:9-17 → source/utils/type-guards.ts:75-77 → source/utils/type-guards.ts:31-33 - the new type: `NetworkError` extends `KyError`, message with method and URL, `request`, raw error in `cause`; the guard matches `instanceof` or `name` (works across realms, like the other guards); `isKyError` now includes it - notes/source.md Flow 2-3
- code source/utils/is-network-error.ts:7-16 → source/utils/is-network-error.ts:48 → source/core/Ky.ts:813-826 → source/core/Ky.ts:827-830 → test/headers.ts:140-143 - a fetch failure becomes a `NetworkError`: `errorMessages`, the runtime message list in the inlined copy of `is-network-error` v1.3.1; the line where `isRawNetworkError` looks up a `TypeError` message in that list; the try now covers both fetch paths and both use `return await` so a rejection reaches the catch (before, the promise was returned without await); a recognized error is thrown as `NetworkError` with the raw error in `cause`; the undici test shows the low-level code now sits at `error.cause.cause.code` - notes/source.md Flow 1, 4, Edge cases; notes/tests-docs.md Flow 1, 15
- code source/core/Ky.ts:440-447 → source/core/Ky.ts:478-483 → source/core/Ky.ts:485-490 - the retry decision ends in an allowlist. `say` gives the unchanged order once: retry limit, `ForceRetryError`, retriable method, `shouldRetry` run first. Notes: the timeout branch now returns its own delay (before, it fell through to a shared return at the end); the HTTP branch does the same; the new tail gives a delay only to a `NetworkError` and throws any other error - notes/source.md Flow 5-8; notes/tests-docs.md Flow 2-3
- quiz - a POST whose fetch rejects with `TypeError('Failed to fetch')`, retry limit 2: how many calls, and what error (1 call, `NetworkError`, because the method check runs before the type check)

## edge-cases
- code source/core/Ky.ts:832 → old source/core/Ky.ts:477 → test/retry.ts:1633-1651 - a bug fails on the first try: the catch rethrows an unrecognized error unchanged, so the caller gets the raw `TypeError`; before, that error reached the shared return and was retried with backoff (#545); the test: `TypeError('Cannot read properties of undefined')` with limit 2 makes exactly 1 fetch call - notes/source.md Flow 5, Edge cases; notes/tests-docs.md Flow 6-7
- code readme.md:1185-1186 → test/retry.ts:1717-1738 → test/retry.ts:1653-1673 - `shouldRetry` can still force a retry: the readme says detection is a heuristic and points to `shouldRetry` for unrecognized runtimes; `shouldRetry` now receives the `NetworkError`, not the raw `TypeError`; `() => true` retries the bug `TypeError` (3 calls with limit 2) - notes/tests-docs.md Flow 8-9, 17; notes/context.md Decisions
- quiz - a custom fetch on a GET throws `new Error('socket hang up')` (name `Error`), default retry options: what happens (thrown at once, not wrapped, not retried; `shouldRetry` would retry it)

## review-focus
- card: What to check - at most 5 bullets:
  - Breaking for callers, and the PR does not say how it ships: code that catches `TypeError`, matches `'Failed to fetch'`, reads `error.cause.code`, or uses the `is-network-error` package in `beforeRetry` (the #545 workaround) stops matching.
  - Fail closed: a network failure with an unknown message (custom fetch, polyfill, localized or new browser text) is no longer retried. Only `shouldRetry` brings retries back.
  - undici's `fetch failed` also covers client bugs (content-length mismatch, an `invalid:` URL). These become `NetworkError` and GET/PUT retry them, which contradicts the readme line "programming bugs are thrown immediately".
  - `isNetworkError` and `isKyError` match any error named `NetworkError`, which is also a DOMException name. Such an error has no `request` and the retry decision retries it.
  - Only the fetch call is wrapped. A failure while reading the body (undici `terminated` in `.json()`) stays a raw `TypeError` and is not retried.
  - notes/context.md Open questions, notes/source.md Risks, notes/tests-docs.md Risks

## recap
- card: Also changed - `readme.md` (retry policy, new `NetworkError` section, hook docs); `source/index.ts` (exports `NetworkError`, `isNetworkError`); doc comments in `source/types/options.ts`, `source/types/retry.ts`, `source/types/hooks.ts`, `source/errors/KyError.ts`, `source/errors/HTTPError.ts` (the retry doc also drops the stale "Retries are not triggered following a timeout"); `test/hooks.ts` (fake failures now throw `TypeError('Failed to fetch')`, because other errors no longer reach `beforeRetry`) and `test/memory-leak.ts` (expects `NetworkError`); `test/retry.ts` other new tests: the `NetworkError` shape, retried by default, not wrapped, POST, `undefined` falls through, `beforeError` sees the cause, `timeout: false` - notes/source.md Mechanical, notes/tests-docs.md Flow 4-5, 7, 10-14, 16, Mechanical
