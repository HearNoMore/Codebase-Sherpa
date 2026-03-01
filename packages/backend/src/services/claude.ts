import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-4-6";
const MAX_RETRIES = 2;

// Lazily initialised so tests that don't call Claude don't require the key.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * Send a single user message and return the full text response.
 * Retries up to MAX_RETRIES times on transient errors.
 */
export async function askClaude(
  prompt: string,
  options: { maxTokens?: number; system?: string } = {}
): Promise<string> {
  const { maxTokens = 4096, system } = options;
  const client = getClient();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      if (block.type !== "text") throw new Error("Unexpected response type from Claude");
      return block.text;
    } catch (err: unknown) {
      const isLast = attempt === MAX_RETRIES;
      if (isLast) throw err;

      // Only retry on rate-limit or server errors
      const status = (err as { status?: number }).status;
      if (status && status < 500 && status !== 429) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw new Error("unreachable");
}

/**
 * Send a prompt and parse the response as JSON.
 * Strips markdown code fences if Claude wraps the JSON in them.
 */
export async function askClaudeForJson<T>(
  prompt: string,
  options: { maxTokens?: number; system?: string } = {}
): Promise<T> {
  const raw = await askClaude(prompt, options);
  return parseJsonFromLlm<T>(raw);
}

/**
 * Extracts JSON from a Claude response that may be wrapped in markdown fences.
 */
export function parseJsonFromLlm<T>(raw: string): T {
  // Strip ```json ... ``` or ``` ... ``` wrappers
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Try to extract the first JSON array or object from the response
    const match = stripped.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      return JSON.parse(match[1]) as T;
    }
    throw new Error(`Failed to parse JSON from Claude response:\n${raw.slice(0, 500)}`);
  }
}

/**
 * Returns a streaming message creator for SSE chat endpoints.
 */
export function getStreamingClient(): Anthropic {
  return getClient();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
