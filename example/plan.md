# Add NetworkError and tighten retry logic
Ky now wraps a fetch failure with a known network message in a typed `NetworkError`. By default it retries only `HTTPError`, `TimeoutError` and `NetworkError`, and throws every other error at once.

- Story: A failed fetch becomes a `NetworkError` in `Ky#fetch`, and the retry decision retries it, but no longer retries errors that it does not know.
- Level: new - 0 of your commits touch source/core, source/utils, source/errors in the last year (new below 10)
- Terms: raw network error (`isRawNetworkError`, a fetch `TypeError` with a known runtime message), `NetworkError`, `KyError`, `HTTPError`, `TimeoutError`, retry decision (`#calculateRetryDelay`), backoff (`#calculateDelay`), `retryOnTimeout`, `shouldRetry`, retry limit (`retry.limit`), retriable methods (`retry.methods`), `beforeRetry` and `beforeError` hooks

## Actors
None shared: the dive has one flow.

## flow retry: Retry a failed fetch as a NetworkError
Trigger: App code sends a request, such as `ky.get(url)` - source/index.ts:16
Effect: the app gets the `Response` of a later attempt (source/core/Ky.ts:176), or the error after the `beforeError` hooks (source/core/Ky.ts:204)
Path: source/index.ts, source/core/Ky.ts (`create`, `#retry`, `#fetch`), source/utils/timeout.ts, source/utils/is-network-error.ts, source/errors/NetworkError.ts, source/core/Ky.ts (`#retryFromError`, `#calculateRetryDelay`), source/utils/type-guards.ts
