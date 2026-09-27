# Add NetworkError and tighten retry logic
Ky now wraps fetch network failures in a typed `NetworkError`. It retries only errors it knows: network, timeout and retriable HTTP status. Everything else is thrown at once.

## why
- card: the problem - raw fetch TypeErrors differ per runtime; Ky retried every unknown error, bugs included (#545) - notes/context.md Goal
- card: the decision - wrap known network errors, retry only known types (fail closed), `shouldRetry` as escape hatch, detector inlined to keep zero deps; links to #545 comments and PR thread - notes/context.md Decisions 1-4, Linked

## glossary
- terms: NetworkError, raw network error (`isRawNetworkError`), `isNetworkError` guard, retry decision (`#calculateRetryDelay`), `shouldRetry`, `cause`, retriable method - notes/source.md Terms, notes/tests-docs.md Terms

## big-picture
- diagram: request -> `#retry` -> `#fetch` -> fetch; `#fetch` catch -> `isRawNetworkError` -> `NetworkError`; `#retryFromError` -> `#calculateRetryDelay` -> retry or throw; public `isNetworkError` guard; notes walk: attempt, wrap, decide - notes/source.md Entry points, Flow 1-12
- sequence: GET fails once with `TypeError('Failed to fetch')`, then succeeds (one pass of the loop, at most 10 messages): app -> Ky -> fetch, TypeError back, wrap, retry decision returns a delay, retry, 200 - notes/source.md Flow 2-3, 10; notes/tests-docs.md Flow 3
- quiz - which errors does Ky retry by default after this PR

## happy-path
- code source/core/Ky.ts:792-833 - the fetch call moves into try/catch; both branches `return await`; recognized errors become `NetworkError` - notes/source.md Flow 1-3
- code source/utils/is-network-error.ts:7-48 - the classifier: real Error, name TypeError, known message per runtime; Safari `Load failed` rule - notes/source.md Flow 4-5
- code source/errors/NetworkError.ts:1-17 - the class: message with method and URL, `request`, `cause` - notes/source.md Flow 6
- code source/core/Ky.ts:405-490 - retry decision: limit, method gate, `shouldRetry` first, explicit returns for timeout and HTTP, the new gate at 485-490; old fall-through as side old - notes/source.md Flow 7-10
- code source/utils/type-guards.ts:31-33,57-77 - `isKyError` includes NetworkError; public `isNetworkError` guard - notes/source.md Flow 11
- quiz - GET, fetch rejects with `TypeError('Failed to fetch')`, retry limit 2, fails every time: what reaches beforeError, how many calls

## edge-cases
- sequence: non-network TypeError (`Cannot read properties of undefined`) on GET with retries left: not wrapped, gate throws, 1 call - notes/tests-docs.md Flow 4-5
- code test/retry.ts:1633-1673 - tests pin: unknown TypeError not retried; `shouldRetry: () => true` still forces retry - notes/tests-docs.md Flow 4, 6
- code test/retry.ts:1697-1715 - POST: method gate first, still a NetworkError, 1 call - notes/tests-docs.md Edge cases
- code test/retry.ts:1807-1821 - `timeout: false` still wraps, guards the added `return await` - notes/tests-docs.md Flow 10
- code source/utils/type-guards.ts:75-77 - name-based match also passes a DOMException named NetworkError - notes/source.md Edge cases
- code test/headers.ts:127-145 - real undici reports a content-length bug as `fetch failed`, so it becomes NetworkError (cause.cause.code) and GET/PUT retry it - notes/tests-docs.md Flow 15, Risks
- card: other unknown errors now thrown at once: non-Error throws, AbortError, custom fetch errors (node-fetch `FetchError`), unlisted runtime messages, Safari `Load failed` with a stack; body-read errors outside `#fetch` are not wrapped - notes/source.md Edge cases
- quiz - custom fetch (node-fetch) throws `FetchError` on a GET: what happens by default, and what is the fix

## review-focus
- card: what to check - silent breaking change (`instanceof TypeError`, #545 workaround hook now disables retries), fail-closed heuristic with no signal, undici `fetch failed` covers client bugs (contradicts readme), DOMException name collision, body-read errors not wrapped, URL in message can leak tokens - notes/context.md Open questions, notes/source.md Risks, notes/tests-docs.md Risks

## recap
- card: in short - 4-5 bullets
- card: Also changed - `readme.md` (retry and NetworkError docs), `source/errors/HTTPError.ts`, `source/errors/KyError.ts`, `source/types/hooks.ts`, `source/types/retry.ts`, `source/types/options.ts` (doc comments only), `test/hooks.ts` (fake failures switched to `TypeError('Failed to fetch')`, required), `test/memory-leak.ts` (expects NetworkError), `test/retry.ts` (new tests, imports), `source/index.ts` (exports), import lines in `source/core/Ky.ts` and `source/utils/type-guards.ts` - notes/source.md Mechanical, notes/tests-docs.md Flow 11-21
