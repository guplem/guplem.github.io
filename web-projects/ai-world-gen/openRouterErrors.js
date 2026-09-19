// What a failed call means, in words a person can act on.
//
// `openRouterClient.js` answers `{ok: false, status, message}` and nothing
// more. This file turns that into a sentence that names the fix: a wrong key,
// no credits, a model that is not served, a rate limit, or a network that never
// let the request out. The status code is the signal; OpenRouter's own message
// is kept only where it adds something.

/**
 * @param {{status?: number, message?: string} | null} failure
 * @returns {string}
 */
export function describeFailure(failure) {
  const status = Number(failure?.status ?? 0);
  const message = typeof failure?.message === "string" ? failure.message : "";

  if (status === 0) {
    return "The request did not reach OpenRouter. Check that you are online, that nothing blocked the call (an ad blocker, a network filter), and try again.";
  }
  if (status === 401 || status === 403) {
    return "OpenRouter rejected the key. Check that you pasted the whole key and that it has not been deleted on openrouter.ai.";
  }
  if (status === 402) {
    return "The key has no credits left. Add credits on openrouter.ai, or pick a free model.";
  }
  if (status === 404 || (status === 400 && /model/i.test(message))) {
    return `That model is not available right now on OpenRouter (${message || "no endpoint"}). Pick another model in AI Setup.`;
  }
  if (status === 429) {
    return "OpenRouter is rate-limiting this key. Wait a moment and try again, or slow the generation down.";
  }
  if (status >= 500) {
    return `The provider behind OpenRouter failed (${status}: ${message || "no detail"}). Try again in a moment, or pick another model.`;
  }
  return `OpenRouter answered ${status}: ${message || "no detail"}.`;
}
