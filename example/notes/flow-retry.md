# flow retry: Wrap a failed fetch and retry it
Trigger: app code sends a request, such as `ky.get(url)` (source/index.ts:12). Effect: the retried attempt succeeds and the request promise resolves with its `Response`.
Actors: app App (app), rhooks beforeRetry hooks (app), create `Ky.create` (ky), retry `Ky#retry` (ky), recover `Ky#retryFromError` (ky), decide `Ky#calculateRetryDelay` (ky, changed), kyfetch `Ky#fetch` (ky, changed), timeout `timeout` (ky), runtime Runtime fetch (outside)

## Hops
1. app → create: `ky.get(url)` merges the options, builds a `Ky` and starts its response promise - source/index.ts:12-17, source/core/Ky.ts:84-99
2. create → retry: `#retry(() => #fetch())` - source/core/Ky.ts:100, source/core/Ky.ts:689-691
3. retry → kyfetch: runs one attempt, cloning the request for the next one - source/core/Ky.ts:792-811
4. kyfetch → timeout: races the fetch against the remaining total timeout, now awaited inside a `try` (changed) - source/core/Ky.ts:813-826, old source/core/Ky.ts:809-812
5. timeout → runtime: `options.fetch(request, init)` - source/utils/timeout.ts:24-25
6. runtime → timeout: rejects with a `TypeError` such as `Failed to fetch` (error)
7. timeout → kyfetch: forwards the rejection and clears the timer (error) - source/utils/timeout.ts:27-30
8. kyfetch → retry: `isRawNetworkError` knows the message, so it throws `new NetworkError(this.request, {cause})` (error, added) - source/core/Ky.ts:827-830, source/utils/is-network-error.ts:19-49, source/errors/NetworkError.ts:9-17, test/retry.ts:1613-1631
9. retry → recover: the catch hands the `NetworkError` to the retry logic - source/core/Ky.ts:692-694
10. recover → decide: `#calculateRetryDelay(error)` - source/core/Ky.ts:700
11. decide → recover: the gates pass, it is not a timeout or HTTP error, and `isNetworkError` is true, so it returns the backoff delay (return, changed) - source/core/Ky.ts:485-490, source/core/Ky.ts:405-421, source/core/Ky.ts:441-447, source/core/Ky.ts:482, source/utils/type-guards.ts:75-77, source/core/Ky.ts:381-398, test/retry.ts:1675-1695
12. recover → rhooks: after the wait, each hook gets the `NetworkError` and `retryCount` - source/core/Ky.ts:737-746, source/core/Ky.ts:701-725, test/hooks.ts:647-685
13. recover → retry: `#retryCount++`, then `#retry(function_)` runs the next attempt - source/core/Ky.ts:782-783
14. retry → create: the second attempt (hops 3-7 again) resolves, and its `Response` returns up through each nested `#retry` and `#retryFromError` (return) - source/core/Ky.ts:691, source/core/Ky.ts:783, source/core/Ky.ts:693, source/core/Ky.ts:100
15. create → app: the afterResponse loop and the `throwHttpErrors` check pass, and the promise resolves (return) - source/core/Ky.ts:107-171, source/core/Ky.ts:174-176

## Branches
### fetch rejects with an error `isRawNetworkError` does not know -> it is thrown at once, not retried
Leaves at hop 8.
1. kyfetch → retry: rethrows the error unchanged (error, added) - source/core/Ky.ts:831-832, test/retry.ts:1740-1753
2. retry → recover: the catch hands the error to the retry logic - source/core/Ky.ts:692-694
3. recover → decide: `#calculateRetryDelay(error)` - source/core/Ky.ts:700
4. decide → recover: not a timeout, HTTP or network error, so it throws instead of returning the backoff (error, added) - source/core/Ky.ts:485-488, test/retry.ts:1633-1651
5. recover → create: the throw unwinds `#retry` into the `result` catch, and beforeError hooks run as in the next branch (error) - source/core/Ky.ts:174-187
6. create → app: the promise rejects with the original error after one fetch (error) - source/core/Ky.ts:204

### retries used up, or the method is not retriable (POST) -> the caller gets the `NetworkError`
Leaves at hop 11.
Actors: ehooks beforeError hooks (app)
1. decide → recover: throws the `NetworkError` when `retryCount` has reached `retry.limit` or the method is not in `retry.methods` (error) - source/core/Ky.ts:406-408, source/core/Ky.ts:419-421, test/retry.ts:1697-1715, test/hooks.ts:1631-1655
2. recover → create: the throw unwinds `#retry` into the `result` catch (error) - source/core/Ky.ts:174-187
3. create → ehooks: each hook gets `{request, options, error, retryCount}` - source/core/Ky.ts:188-196, test/hooks.ts:1604-1629, test/retry.ts:1780-1805
4. ehooks → create: may return a replacement `Error` (return) - source/core/Ky.ts:198-201
5. create → app: the promise rejects with the `NetworkError`, the runtime error at `error.cause` (error) - source/core/Ky.ts:204, test/headers.ts:127-144

### `timeout: false` -> fetch is called directly, and the same catch wraps its rejection detail
Leaves at hop 4.
1. kyfetch → runtime: `options.fetch(request, init)` with `return await`, so the `catch` sees the rejection (changed) - source/core/Ky.ts:814-816, old source/core/Ky.ts:800-802, test/retry.ts:1807-1821
2. runtime → kyfetch: rejects with a `TypeError`, and hop 8 wraps it (error)

## Not on this flow
- notes/ky.md C4 hops 1-3: unchanged code. `shouldRetry` runs inside hop 11 before the type checks, and returning `true` is how a user retries an error Ky no longer retries. Kept as a line on hop 11 under Flow, not as a branch.

## Corrections
- notes/ky.md C3 hop 4: cites `old source/core/Ky.ts:475-477` as the removed fall-through -> that `return this.#calculateDelay()` is not deleted: it is :490, now reached only by a `NetworkError`. The change is the added guard at :485-488 plus the explicit returns for timeout (:441-447, replacing old :439-440) and HTTP (:482).
- notes/ky.md C1 hop 14: anchors only :691 -> the `Response` also returns through `return this.#retry(function_)` at :783 and `return this.#retryFromError(...)` at :693, to `ky.#retry(...)` at :100.
- notes/ky.md C1 hop 12: anchors :701-746 as the hooks -> :701-725 are the wait and the total-timeout checks (which can throw `TimeoutError` instead of retrying); the hook call is :737-746.

## Other flows
- the total-timeout timer fires first - source/utils/timeout.ts:16-22: the `TimeoutError` passes the new catch unwrapped and is retried only with `retryOnTimeout`, now by an explicit return at source/core/Ky.ts:446.
- a non-ok response - source/core/Ky.ts:127-149: the `HTTPError` goes to `#retryFromError` and now returns its delay explicitly at source/core/Ky.ts:482.

## Detail

### Flow
- source/index.ts:12-17 Each `ky` call merges the instance defaults with the call's options and hands them to `Ky.create`. The method shortcuts only preset `method`.
- source/core/Ky.ts:84-99 `Ky.create` builds the `Ky` (retry options normalized: limit 2, backoff 0.3 s × 2^(n-1)), starts the total-timeout clock and runs the beforeRequest hooks.
- source/core/Ky.ts:100 With no Response from a beforeRequest hook, it wraps `#fetch` in `#retry`. `#retry` (:689-695) tries one attempt and sends any throw to `#retryFromError`.
- source/core/Ky.ts:792-811 `#fetch` resets an aborted controller. When `retry.limit > 0` it clones the request, so the next attempt has an unread body, and points `this.request` at the clone.
- source/core/Ky.ts:813-826 The send now sits inside `try`, and both branches use `return await`. Before (old :800-812), the promise was returned bare, so a `try` would not have caught its rejection. A `TimeoutError` thrown at :820 also passes this catch and is rethrown as is.
- source/utils/timeout.ts:24-25 `timeout` calls `options.fetch` and races it against a timer that aborts and rejects with `TimeoutError`.
- source/utils/timeout.ts:27-30 A fetch rejection is forwarded unchanged with `.catch(reject)`, and the timer is cleared either way.
- source/core/Ky.ts:827-830 The new catch classifies the error. A known raw network `TypeError` becomes a `NetworkError` with the original at `cause`, so the retry logic, the hooks and the caller all see a Ky error with `request`. `this.request` is the retry clone, the same request a `TimeoutError` gets.
- source/utils/is-network-error.ts:19-49 `isRawNetworkError` (inlined from `is-network-error` v1.3.1) needs a real `Error` named `TypeError`, then matches Safari's `Load failed` only without a stack, Deno's `error sending request for url` prefix, Chrome's `Failed to fetch` with an optional `(host)`, or an exact message from the set at :7-16.
- source/errors/NetworkError.ts:9-17 `NetworkError` extends `KyError`, sets `name = 'NetworkError'` (the guard checks it) and builds `Request failed due to a network error: <METHOD> <url>`.
- source/core/Ky.ts:692-694 Unchanged: the catch in `#retry` passes any error to `#retryFromError`.
- source/core/Ky.ts:700 `#retryFromError` awaits the decision and caps the delay at `maxSafeTimeout`.
- source/core/Ky.ts:485-490 The last default check changed from "retry anything" to "retry only a `NetworkError`" (`isNetworkError`, source/utils/type-guards.ts:75-77, an `instanceof` or `name` check). The order: limit reached → throw, `ForceRetryError` → retry, method not retriable → throw (:405-421), `shouldRetry` (:423-438), then the error type. The timeout (:441-447) and HTTP (:482) branches now return their delay themselves, because the fall-through no longer retries.
- source/core/Ky.ts:423-438 Unchanged: a `shouldRetry` callback gets the wrapped `NetworkError`. `true` returns the backoff and skips the type checks, so it still retries any error; `false` throws; `undefined` falls through (test/retry.ts:1653-1673, test/retry.ts:1717-1738, test/retry.ts:1755-1778).
- source/core/Ky.ts:381-398 `#calculateDelay` is `retry.delay(retryCount + 1)`, with optional jitter, capped by `backoffLimit`.
- source/core/Ky.ts:737-746 After the wait, each beforeRetry hook gets `error`, now a `NetworkError` with no `response`. A hook may return a `Request`, a `Response` or `stop` (:756-771); none of that changed.
- source/core/Ky.ts:701-725 The wait can be canceled only by the user's signal. Before and after it, the total-timeout budget is checked, and a spent budget throws `TimeoutError` instead of retrying.
- source/core/Ky.ts:782-783 Increments `#retryCount` and calls `#retry` again: one pass of the retry loop.
- source/core/Ky.ts:691 The next attempt's `Response` returns through `return await function_()`, then :783 and :693 in each nested frame, to :100.
- source/core/Ky.ts:107-171 The response goes through the afterResponse hooks and the `throwHttpErrors` check; the `result` wrapper (:174-176) resolves with it.
- source/core/Ky.ts:831-832 An unknown error is rethrown as is, so a plain `TypeError` bug keeps its type and message.
- source/core/Ky.ts:485-488 Any error that is not an `HTTPError`, `TimeoutError` or `NetworkError`, including a plain `Error` or a thrown non-Error from a custom `fetch`, now stops the loop on the first attempt. Before, it fell through to the backoff (old :477).
- source/core/Ky.ts:174-187 The `result` catch passes non-Errors and errors thrown by beforeRetry hooks through unchanged. Every other error goes to the beforeError hooks.
- source/core/Ky.ts:204 The caller receives the processed error.
- source/core/Ky.ts:406-408 The limit check runs first, so the last network failure is thrown as the `NetworkError` itself. Before this PR it was the raw `TypeError`.
- source/core/Ky.ts:419-421 A POST or PATCH is not in the default `retry.methods`, so its `NetworkError` is thrown on the first attempt.
- source/core/Ky.ts:188-196 Each beforeError hook gets `{request, options, error, retryCount}`.
- source/core/Ky.ts:198-201 Only a returned `Error` replaces the error.
- source/core/Ky.ts:814-816 The `timeout: false` branch now awaits too, so its rejection reaches the same catch.

### Risks and open questions
- Breaking change: network failures now reject with `NetworkError`, not `TypeError`. Checks on `instanceof TypeError`, `message === 'Failed to fetch'` or undici's `error.cause.code` break; the undici cause is now at `error.cause.cause` (test/headers.ts:142-143).
- Retries are narrower: errors from a custom `fetch`, thrown non-Errors, and network messages from runtimes the list does not know are no longer retried. Five hook tests switched to `Failed to fetch` to keep retrying. `shouldRetry: () => true` restores the old behavior.
- Undici's `fetch failed` also covers an invalid URL scheme (test/memory-leak.ts:40) and a content-length mismatch (test/headers.ts:127-143). These become `NetworkError` and are retried when the method is retriable, although the code comment at source/core/Ky.ts:485 says programming bugs are not.
- `isNetworkError` matches on `name`, so a `DOMException` named `NetworkError` passes it: Ky retries it, and TypeScript narrows it to a `NetworkError` with no `request`.
- Only the fetch call is wrapped. A network failure while reading the body (`.json()` at source/core/Ky.ts:226-246) stays a raw `TypeError` and is never retried.
- Detection depends on exact English runtime messages; if a runtime rewords one, wrapping and retrying stop silently.
