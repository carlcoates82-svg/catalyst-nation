import Anthropic from "@anthropic-ai/sdk";

export const AGENT_MODEL = "claude-sonnet-5";

// Rough estimate only (USD per million tokens / per search) — check current
// pricing at anthropic.com/pricing before treating this as accurate for
// real spend tracking. Good enough to flag relative cost and rough budget
// burn.
const PRICE_PER_MILLION_TOKENS = { input: 3, output: 15 };
const PRICE_PER_WEB_SEARCH = 0.01;

// Caps how many searches a single task run can make — cost/safety control,
// not a quality setting.
export const MAX_WEB_SEARCHES_PER_TASK = 5;

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  webSearches = 0
): number {
  return (
    (inputTokens / 1_000_000) * PRICE_PER_MILLION_TOKENS.input +
    (outputTokens / 1_000_000) * PRICE_PER_MILLION_TOKENS.output +
    webSearches * PRICE_PER_WEB_SEARCH
  );
}

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it to .env.local.");
  }
  return new Anthropic({ apiKey });
}
