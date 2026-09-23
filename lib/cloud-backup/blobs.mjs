// The SDK retries thrown fetch errors, 403, 429 and 5xx with five-second sleeps.
// A scheduled invocation cannot afford those hidden retries. Fail this operation
// immediately with a non-retryable response; the runner records a safe stage code.
export function boundedBlobFetch(budget, signal, fetchImpl = fetch) {
  return async (url, options = {}) => {
    try {
      const response = await fetchImpl(url, { ...options,
        signal: AbortSignal.any([signal, ...(options.signal ? [options.signal] : []),
          AbortSignal.timeout(Math.max(1, Math.min(4000, budget.remaining())))]) });
      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        await response.body?.cancel().catch(() => {});
        return new Response(null, { status: 408 });
      }
      return response;
    } catch { return new Response(null, { status: 408 }); }
  };
}
