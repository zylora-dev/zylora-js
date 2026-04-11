const DEFAULT_BASE_URL = "https://api.zylora.dev";
const DEFAULT_TIMEOUT = 300_000; // 5 minutes
const DEFAULT_MAX_RETRIES = 3;

export interface ResolvedConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

/**
 * Resolve configuration from explicit options, environment variables, or defaults.
 *
 * Discovery order for API key:
 *  1. Explicit `apiKey` option
 *  2. `ZYLORA_API_KEY` environment variable
 *
 * Discovery order for base URL:
 *  1. Explicit `baseUrl` option
 *  2. `ZYLORA_API_URL` environment variable
 *  3. Default: https://api.zylora.dev
 */
export function resolveConfig(options?: {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}): ResolvedConfig {
  const apiKey =
    options?.apiKey ??
    getEnv("ZYLORA_API_KEY");

  if (!apiKey) {
    throw new Error(
      "Missing API key. Set ZYLORA_API_KEY environment variable or pass apiKey to the Zylora constructor.",
    );
  }

  return {
    apiKey,
    baseUrl: options?.baseUrl ?? getEnv("ZYLORA_API_URL") ?? DEFAULT_BASE_URL,
    timeout: options?.timeout ?? DEFAULT_TIMEOUT,
    maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
  };
}

/** Safe env access that works in Node, Deno, Bun, and edge runtimes. */
function getEnv(name: string): string | undefined {
  try {
    // Node.js / Bun — process is a global in these runtimes
    const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
    if (g.process?.env) {
      return g.process.env[name];
    }
  } catch {
    // Ignore — not a Node-like runtime
  }
  try {
    // Deno
    const g = globalThis as unknown as { Deno?: { env: { get(key: string): string } } };
    if (g.Deno) {
      return g.Deno.env.get(name);
    }
  } catch {
    // Ignore — not Deno or permission denied
  }
  return undefined;
}
