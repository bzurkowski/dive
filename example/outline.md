# Add NetworkError and tighten retry logic
Ky now wraps a recognized fetch network failure in a typed `NetworkError`. By default it retries only errors it knows, and throws every other error at once.

PR: https://github.com/sindresorhus/ky/pull/842 · base `191057d135c1cfe07f9fa16978c2482969ccac20` · head `5703d624c6990817662a827be06dd006870acde8`

## Story plan
- Change: `Ky#fetch` rethrows a fetch `TypeError` with a known runtime message as a new `NetworkError` (raw error in `cause`). The end of `Ky#calculateRetryDelay` now retries only a `NetworkError` and throws any other unknown error, where before it retried everything.
- Level: new (0 of your commits touch source/core, source/errors, source/utils in the last year)
- Flows: `retry` A failed fetch is wrapped and retried - trigger: any request, such as `ky.get(url)`. One flow: the only stop in the chain is the backoff wait, and the steps after it are unchanged.
- New names: `NetworkError`, `isRawNetworkError`, `isNetworkError`, `cause`, `#calculateRetryDelay`, `shouldRetry` → `retry` (the only flow). The glossary defines them first; the flow's code notes still say in a few words what each does at first use.
- Left out:
  - The detection details inside the inlined `is-network-error` (the Safari `Load failed` stack rule, the Deno prefix, the Chrome `(host)` suffix, the `Object.prototype.toString` check; notes/ky.md Edge cases lines 1-4): internals of inlined code; the message list and its lookup carry the story.
  - `retry: 0`, `shouldRetry` returning true, a non-Error value wrapped in `NonError`, a `beforeRetry` hook that rethrows or returns a `Response` (Edge cases lines 7-11): unchanged behavior that now simply sees a `NetworkError`.
  - A `TimeoutError` inside the new try is rethrown unwrapped (Edge cases line 6) and the undici code now at `error.cause.cause.code` (line 12): said in notes of the `wrap` step, not as edge steps.
  - The delay internals (`source/utils/delay.ts`) and the `timeout()` internals: unchanged; one self-message and one hop.
  - Doc and test-only edits: listed in "Also changed".

## intro
- card Fetch errors are vague - fetch rejects with a raw `TypeError`, and its message differs per runtime ("Failed to fetch", "fetch failed", "Load failed", ...) - notes/context.md Goal
- card Ky retried every error - an error Ky did not recognize fell through to a retry, so a bug in a custom `fetch` or a hook was retried like a network blip; issue #545 asked how to retry only real network errors - notes/context.md Goal, Linked
- card The decision - wrap recognized network errors in `NetworkError`; retry only known error types; accept that network errors from unknown runtimes lose retries; `shouldRetry` is the escape hatch. Links: #545 and its decision comments - notes/context.md Decisions, Linked
- card Why the detector is inlined - `is-network-error` v1.3.1 is copied in as `isRawNetworkError` instead of added as a dependency, and renamed so it does not clash with the public `isNetworkError`. Link: the PR comment - notes/context.md Decisions, Linked

## glossary
- terms Errors from fetch - raw network error (`isRawNetworkError`), runtime message list (`errorMessages`) - notes/ky.md Terms
- terms Ky's error types - `KyError`, `NetworkError`, `cause`, `isNetworkError`, `HTTPError`, `TimeoutError` - notes/ky.md Terms
- terms The retry decision - retry decision (`#calculateRetryDelay`), retry limit (`retry.limit`), retriable method (`retry.methods`), `shouldRetry`, `beforeRetry` and `beforeError` hooks - notes/ky.md Terms, Calls out

## big-picture
One flow, so no overview sequence.
- diagram Which errors retry now - one question: "An attempt failed. Which errors does Ky retry now?" Nodes: failed attempt; checks that run first (limit, method, `shouldRetry`); `TimeoutError`; `HTTPError`; `NetworkError`; other error; retry; throw. Notes build up in order: the failed attempt → the unchanged checks run first → `TimeoutError` retries only with `retryOnTimeout` → `HTTPError` retries on a retriable status → `NetworkError` retries (new) → any other error throws (new; before, it retried). Every node in some note's focus - notes/ky.md Chains (4th chain), notes/context.md Goal
- quiz - `shouldRetry` returns `undefined` for a `TypeError` that is not a network error, GET, limit 2: how many attempts? (1; wrong: 3 because shouldRetry did not stop it; 3 because GET is retriable; 2)

## walkthrough
### flow retry: A failed fetch is wrapped and retried
Actors: app App (your code), should `retry.shouldRetry` (your code), before `hooks.beforeRetry` (your code), create `Ky.create` (Ky), kyretry `Ky#retry` (Ky), fetch `Ky#fetch` (Ky, changed), calc `Ky#calculateRetryDelay` (Ky, changed), timeout `timeout` (ky utils), raw `isRawNetworkError` (ky utils, added), guard `isNetworkError` (ky utils, added), fetchapi Fetch API (runtime)
1. app → create: ky.get(url) - source/index.ts:10-17
2. create → kyretry: #retry(() => #fetch()) - source/core/Ky.ts:87-100
3. kyretry → fetch: one attempt - source/core/Ky.ts:689-692
4. fetch → timeout: timeout(request, init) (changed) - source/core/Ky.ts:813-826 → send
5. timeout → fetchapi: fetch(request, init) - source/utils/timeout.ts:24-27
6. fetchapi → timeout: TypeError (error) - external, e.g. 'Failed to fetch'
7. timeout → fetch: rejection (error, changed) - source/core/Ky.ts:823-827 → send
8. fetch → raw: isRawNetworkError(error) (added) - source/core/Ky.ts:828, source/utils/is-network-error.ts:18-49 → detect
9. raw → fetch: true (return, added) - source/utils/is-network-error.ts:48
10. fetch → kyretry: throw NetworkError (error, added) - source/core/Ky.ts:829, source/errors/NetworkError.ts:9-17 → wrap
11. kyretry → calc: #calculateRetryDelay(error) - source/core/Ky.ts:697-700 (through `#retryFromError`)
12. calc → should: shouldRetry({error}) - source/core/Ky.ts:424-438 (only when set; it runs after the limit and method checks)
13. should → calc: undefined (return) - falls through to the default logic
14. calc → guard: isNetworkError(error) (added) - source/core/Ky.ts:485-490, source/utils/type-guards.ts:75-77 → decide
15. guard → calc: true (return, added)
16. calc → kyretry: delay in ms (return, changed) - source/core/Ky.ts:490 → decide
17. kyretry → kyretry: wait the delay - source/core/Ky.ts:703-725, source/utils/delay.ts:9-29
18. kyretry → before: beforeRetry({error}) - source/core/Ky.ts:737-772 (the hook now gets the `NetworkError`)
19. kyretry → fetch: next attempt - source/core/Ky.ts:782-783
20. fetch → create: Response (return) - source/core/Ky.ts:100
21. create → app: Response (return) - source/core/Ky.ts:100-171
- code send - source/core/Ky.ts:813-826 (new), plus the old lines of the same block (`git show <base>:source/core/Ky.ts`) - the try now covers both fetch paths (`timeout: false` and `timeout()`), and both use `return await`, so a rejection reaches the catch; before, the promise was returned without await - notes/ky.md Flow (grep `Ky.ts:813`, `Ky.ts:823`), test/retry.ts:1807-1821 only if it adds something
- code detect - source/core/Ky.ts:828 → source/utils/is-network-error.ts:48 → source/utils/is-network-error.ts:7-16 - the catch asks `isRawNetworkError`; the line that looks the message up in the list; the list of runtime messages in the inlined copy of `is-network-error` v1.3.1 (say the version once) - notes/ky.md Flow (grep `is-network-error`), notes/context.md Decisions (inlining)
- code wrap - source/core/Ky.ts:829-832 → source/errors/NetworkError.ts:9-17 → test/headers.ts:140-143 - a recognized error is thrown as `NetworkError` with the raw error in `cause`; any other error (a `TimeoutError`, a non-network `TypeError`) is rethrown as is; the class: extends `KyError`, message with method and URL, `request`; the undici test shows the low-level code now at `error.cause.cause.code` - notes/ky.md Flow (grep `NetworkError.ts`, `headers.ts`), Edge cases lines 6 and 12
- code decide - `say` gives the unchanged order once: retry limit, retriable method, `shouldRetry`, then the error type. Notes: source/core/Ky.ts:441-447 (the timeout branch now returns its own delay; old lines where it fell through) → the `return this.#calculateDelay()` that now ends the HTTP branch (inside source/core/Ky.ts:449-483; note only those lines) → source/core/Ky.ts:485-490 (the new tail: only a `NetworkError` gets a delay, any other error is thrown; old side: the shared return that retried everything) → source/utils/type-guards.ts:75-77 (`isNetworkError`: `instanceof` or `name`, so it works across realms) → source/utils/type-guards.ts:31-33 (`isKyError` now includes it) → test/retry.ts:1633-1651 (a non-network error is not retried) - notes/ky.md Flow (grep `Ky.ts:441`, `Ky.ts:449`, `Ky.ts:485`, `type-guards`), Chains (4th chain)
- quiz - a GET whose custom fetch always rejects with `TypeError('Failed to fetch')`, retry limit 2, no `shouldRetry`: how many fetch calls, and what does the caller catch? (3 calls, a `NetworkError` with the `TypeError` in `cause`; wrong: 1 call and the raw `TypeError`; 3 calls and the raw `TypeError`; 1 call and a `NetworkError`)
- edge A bug in a custom fetch fails at once (added behavior; notes/ky.md 3rd chain)
  Actors: app App (your code), create `Ky.create` (Ky), kyretry `Ky#retry` (Ky), fetch `Ky#fetch` (Ky, changed), calc `Ky#calculateRetryDelay` (Ky, changed), timeout `timeout` (ky utils), raw `isRawNetworkError` (ky utils, added), guard `isNetworkError` (ky utils, added), fetchapi custom fetch (your code). Keep each group's actors together.
  1. fetchapi → timeout: TypeError, not a network message (error) - e.g. 'Cannot read properties of undefined'
  2. timeout → fetch: rejection (error, changed) - source/core/Ky.ts:823-827 → send
  3. fetch → raw: isRawNetworkError(error) (added) - source/core/Ky.ts:828 → detect
  4. raw → fetch: false (return, added) - source/utils/is-network-error.ts:48
  5. fetch → kyretry: rethrow the raw TypeError (error, changed) - source/core/Ky.ts:831 → wrap
  6. kyretry → calc: #calculateRetryDelay(error) - source/core/Ky.ts:697-700
  7. calc → guard: isNetworkError(error) (added) - source/core/Ky.ts:485 → decide
  8. guard → calc: false (return, added)
  9. calc → kyretry: throw error (error, changed) - source/core/Ky.ts:488 → decide (before: a delay, so it retried)
  10. kyretry → create: error leaves #retry (error) - source/core/Ky.ts:100
  11. create → app: rejects with the raw TypeError (error) - source/core/Ky.ts:174-204, test/retry.ts:1633-1651
- edge A POST gets the NetworkError at once (changed outcome: the caller now gets a `NetworkError`; notes/ky.md 2nd chain)
  Actors: app App (your code), beforeError `hooks.beforeError` (your code), create `Ky.create` (Ky), kyretry `Ky#retry` (Ky), fetch `Ky#fetch` (Ky, changed), calc `Ky#calculateRetryDelay` (Ky)
  1. fetch → kyretry: throw NetworkError (error, added) - source/core/Ky.ts:829 → wrap
  2. kyretry → calc: #calculateRetryDelay(error) - source/core/Ky.ts:700
  3. calc → kyretry: throw, POST is not in retry.methods (error) - source/core/Ky.ts:419-421 (the method check runs before the type check)
  4. kyretry → create: error leaves #retry (error) - source/core/Ky.ts:100,174-187
  5. create → beforeError: beforeError({error}) - source/core/Ky.ts:188-202 (the hook now gets the `NetworkError`, test/retry.ts:1780-1805)
  6. beforeError → create: error (return)
  7. create → app: rejects with NetworkError (error) - source/core/Ky.ts:204 (`cause` holds the raw `TypeError`; the caller narrows with `isNetworkError`)

## review-focus
- card What to check before merge - notes/ky.md Risks and open questions (sed), notes/context.md Open questions: retries now depend on the message list (node-fetch `FetchError`, Safari `Load failed` with a stack, body-read `terminated`); undici's generic `fetch failed` also covers client-side mistakes that are now retried; callers that check `instanceof TypeError`, `error.message` or `error.cause.code` break, yet the release notes list the PR under "New"; a DOMException named `NetworkError` passes `isNetworkError` without `request`

## recap
- card Also changed - every Mechanical item of notes/ky.md, one line per file, paths in backticks: test/hooks.ts, test/memory-leak.ts, test/retry.ts imports, source/core/Ky.ts imports, source/errors/KyError.ts, source/errors/HTTPError.ts, source/types/hooks.ts, source/types/options.ts, source/types/retry.ts, readme.md, source/index.ts exports
- card Other tests - the new tests in test/retry.ts that no step shows (grep `test/retry.ts` in notes/ky.md Flow), one line each on the behavior they pin
- card Where to read next - `source/core/Ky.ts` `#calculateRetryDelay` in full, `source/utils/is-network-error.ts`, the readme `NetworkError` section
