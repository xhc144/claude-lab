// Cost accounting. Prices are per 1M tokens in the model's billing currency; totals are kept in USD.

export const DEFAULT_RATES = { USD: 1, CNY: 7.1 };

export function toUsd(amount, currency, rates = DEFAULT_RATES) {
  if (!amount) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = rates[currency] ?? DEFAULT_RATES[currency];
  return rate ? amount / rate : amount;
}

export function hasPrice(price) {
  return !!price && Number.isFinite(+price.input) && Number.isFinite(+price.output);
}

/** Cost in USD for a usage record {inputTokens, outputTokens}. Reasoning tokens are already part of output. */
export function costUsd(price, usage, rates) {
  if (!hasPrice(price) || !usage) return 0;
  const native = ((usage.inputTokens || 0) * +price.input + (usage.outputTokens || 0) * +price.output) / 1e6;
  return toUsd(native, price.currency, rates);
}

/** Upper-bound cost for a call before it runs: estimated prompt + full output allowance. */
export function projectCostUsd(price, inputTokens, maxOutputTokens, rates) {
  return costUsd(price, { inputTokens, outputTokens: maxOutputTokens }, rates);
}
