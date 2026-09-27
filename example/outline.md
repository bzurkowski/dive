# Add NetworkError and tighten retry logic
Ky now wraps fetch network failures in a typed `NetworkError`. It retries only errors it knows: network, timeout and retriable HTTP status. Everything else is thrown at once.

## why
- card: the problem - raw fetch TypeErrors differ per runtime; Ky retried every unknown error, bugs included (#545) - notes/context.md Goal
- card: the decision - wrap known network errors, retry only known types (fail closed), `shouldRetry` as escape hatch, detector inlined to keep zero deps; links to #545 comments and PR thread - notes/context.md Decisions 1-4, Linked

## glossary
- terms: NetworkError, raw network error (`isRawNetworkError`), `isNetworkError` guard, retry decision (`#calculateRetryDelay`), `shouldRetry`, `cause`, retriable method - notes/source.md Terms, notes/tests-docs.md Terms

## big-picture
- diagram: request -> `#retry` -> `#fetch` -> fetch; `#fetch` catch -> `isRawNetworkError` -> `NetworkError`; `#retryFromError` -> `#calculateRetryDelay` -> retry or throw; public `isNetworkError` guard; notes walk: attempt, wrap, decide - notes/source.md Entry points, Flow 1-12
- sequence: GET fails once with `TypeError('Failed to fetch')`, then succeeds - notes/source.md Flow 2-3, 10; notes/tests-docs.md Flow 3
- quiz - which errors does Ky retry by default after this PR

## happy-path
- code source/core/Ky.ts:813-833 → source/utils/is-network-error.ts:7-48 → source/errors/NetworkError.ts:9-17 → test/retry.ts:1613-1631 - a fetch failure becomes a NetworkError: the fetch call moves into try (timeout() branch); the catch asks the classifier (exact-match message set first, then real Error, name TypeError, Safari `Load failed` rule, per-runtime prefixes, final exact match); recognized errors become a NetworkError with method+URL message, `request`, `cause`; the test pins the wrapped shape - notes/source.md Flow 2-6, notes/tests-docs.md Flow 2
- code source/core/Ky.ts:405-490 → source/utils/type-guards.ts:57-77, 31-33 → test/retry.ts:1675-1695 - only known errors are retried: limit, method gate and `shouldRetry` run first (unchanged; `shouldRetry` now sees the NetworkError); explicit `return this.#calculateDelay()` for timeout and HTTP; the new gate and the default backoff, with the old fall-through (side old); the gate calls the public `isNetworkError` guard (instanceof or name), which `isKyError` now includes; the test pins 2 failures then success = 3 calls - notes/source.md Flow 7-11, notes/tests-docs.md Flow 3
- quiz - GET, fetch rejects with `TypeError('Failed to fetch')` every time, retry limit 2: how many calls, and what reaches beforeError

## edge-cases
- code source/core/Ky.ts:832 → source/core/Ky.ts:485-488 → test/retry.ts:1633-1651 - a bug is thrown at once: a non-network TypeError is rethrown unwrapped by the catch, the gate throws it, limit 2 still gives 1 call (before: retried) - notes/source.md Edge cases, notes/tests-docs.md Flow 4
- code source/core/Ky.ts:424-435 → test/retry.ts:1653-1673 - `shouldRetry` is the escape hatch: it runs before the gate, `true` retries an unknown error; after the limit the raw TypeError is thrown, not a KyError - notes/tests-docs.md Flow 6, Risks
- code source/core/Ky.ts:418-420 → test/retry.ts:1697-1715 - POST: wrapped but not retried; the method gate runs first - notes/source.md Edge cases, notes/tests-docs.md Edge cases
- code source/core/Ky.ts:813-816 → test/retry.ts:1807-1821 - `timeout: false`: the no-timeout branch now does `return await`, so its rejection reaches the catch; the test pins it - notes/source.md Flow 2, notes/tests-docs.md Flow 10
- code source/utils/is-network-error.ts:7-16 → test/headers.ts:127-145 → test/memory-leak.ts:40-46 - undici calls client bugs `fetch failed`: a content-length mismatch and an `invalid:` URL become NetworkError, and GET/PUT retry them; contradicts readme "bugs are thrown immediately" - notes/tests-docs.md Flow 15-16, Risks
- code source/utils/type-guards.ts:75-77 - the name-based match also passes a DOMException named NetworkError: guard claims `.request`, and the gate retries it - notes/source.md Edge cases
- card: other unknown errors now thrown at once: non-Error throws, AbortError, custom fetch errors (node-fetch `FetchError`), unlisted or localized runtime messages, Safari `Load failed` with a stack; body-read errors (undici `terminated` in `.json()`) happen outside `#fetch` and are not wrapped - notes/source.md Edge cases
- quiz - custom fetch (node-fetch) throws `FetchError` on a GET: what happens by default, and what is the fix

## review-focus
- card: what to check - silent breaking change, fail-closed heuristic, undici `fetch failed` covers client bugs, DOMException name collision, body-read errors not wrapped, URL in message - notes/context.md Open questions, notes/source.md Risks, notes/tests-docs.md Risks

## recap
- card: in short - 4-5 bullets
- card: Also changed - `readme.md` (retry and NetworkError docs), `source/errors/HTTPError.ts`, `source/errors/KyError.ts`, `source/types/hooks.ts`, `source/types/retry.ts`, `source/types/options.ts` (doc comments only), `source/index.ts` (exports), import lines in `source/core/Ky.ts` and `source/utils/type-guards.ts`, `test/hooks.ts` (fake failures switched to `TypeError('Failed to fetch')`, required), `test/retry.ts` other new tests (not wrapped, `shouldRetry` receives NetworkError, `undefined` falls through, beforeError sees the cause chain) and imports - notes/source.md Mechanical, notes/tests-docs.md Flow 5, 7-9, 11-21
