// Budget guard for a research session. Calls reserve their worst-case cost before they start
// (prompt estimate + full output allowance), so concurrent calls cannot jointly overshoot the cap.
import { ProviderError } from '../providers/errors.mjs';

export class Budget {
  constructor({ limitUsd = 0, limitTokens = 0, spentUsd = 0, spentTokens = 0, extraCheck = null } = {}) {
    this.limitUsd = limitUsd;
    this.limitTokens = limitTokens;
    this.spentUsd = spentUsd;
    this.spentTokens = spentTokens;
    this.reservedUsd = 0;
    this.reservedTokens = 0;
    this.extraCheck = extraCheck;
  }

  setLimits({ limitUsd, limitTokens }) {
    if (limitUsd != null) this.limitUsd = limitUsd;
    if (limitTokens != null) this.limitTokens = limitTokens;
  }

  remainingUsd() {
    return this.limitUsd > 0 ? Math.max(0, this.limitUsd - this.spentUsd - this.reservedUsd) : Infinity;
  }

  reserve({ usd = 0, tokens = 0 }) {
    if (this.limitUsd > 0 && this.spentUsd + this.reservedUsd + usd > this.limitUsd) {
      throw new ProviderError({ kind: 'budget', retryable: false, message: `本次调用预计最多花费 $${usd.toFixed(4)}，超出剩余预算 $${this.remainingUsd().toFixed(4)}` });
    }
    if (this.limitTokens > 0 && this.spentTokens + this.reservedTokens + tokens > this.limitTokens) {
      throw new ProviderError({ kind: 'budget', retryable: false, message: `本次调用预计最多消耗 ${tokens} tokens，超出剩余 Token 额度` });
    }
    this.extraCheck?.(usd);
    this.reservedUsd += usd;
    this.reservedTokens += tokens;
    return { usd, tokens };
  }

  settle(handle, actual) {
    if (!handle) return;
    this.reservedUsd = Math.max(0, this.reservedUsd - handle.usd);
    this.reservedTokens = Math.max(0, this.reservedTokens - handle.tokens);
    if (actual) {
      this.spentUsd += actual.usd || 0;
      this.spentTokens += actual.tokens || 0;
    }
  }
}
