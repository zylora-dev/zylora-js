import { resolveConfig, type ResolvedConfig } from "./config.js";
import { mapError } from "./errors.js";
import type {
  AsyncJobResponse,
  AsyncJobResult,
  BatchOptions,
  BatchResponse,
  ErrorResponse,
  InvokeOptions,
  StreamOptions,
  ZyloraOptions,
} from "./types.js";

const SDK_VERSION = "0.1.0";

/**
 * Zylora API client. Invocation-only in Phase 1.
 *
 * @example
 * ```ts
 * const zy = new Zylora({ apiKey: "zy_..." });
 * const result = await zy.invoke("my-function", { text: "hello" });
 * ```
 */
export class Zylora {
  private readonly config: ResolvedConfig;

  constructor(options?: ZyloraOptions) {
    this.config = resolveConfig(options);
  }

  // ── Invocation methods ───────────────────────────────────────────────────

  /**
   * Invoke a function synchronously and return the result.
   */
  async invoke<T = unknown>(
    functionId: string,
    input?: unknown,
    options?: InvokeOptions,
  ): Promise<T> {
    const response = await this.request(
      `${this.functionsUrl(functionId)}/invoke`,
      input,
      options,
    );
    return (response as { output: T }).output;
  }

  /**
   * Invoke a function with multiple inputs in batch.
   */
  async batch(
    functionId: string,
    inputs: unknown[],
    options?: BatchOptions,
  ): Promise<BatchResponse> {
    const body = {
      inputs,
      concurrency: options?.concurrency ?? 10,
    };
    const response = await this.request(
      `${this.functionsUrl(functionId)}/map`,
      body,
      options,
    );
    return response as BatchResponse;
  }

  /**
   * Invoke a function with streaming response. Returns an AsyncIterable
   * that yields parsed chunks as they arrive.
   */
  async *stream(
    functionId: string,
    input?: unknown,
    options?: StreamOptions,
  ): AsyncIterable<string> {
    const url = `${this.functionsUrl(functionId)}/invoke/stream`;

    const response = await this.rawRequest(url, input, {
      ...options,
      headers: {
        ...options?.headers,
        Accept: "text/event-stream",
      },
    });

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw mapError(response.status, error, response.headers);
    }

    if (!response.body) {
      throw new Error("Response body is null — streaming not supported in this environment");
    }

    yield* this.parseSSE(response.body, options?.signal);
  }

  /**
   * Invoke a function asynchronously. Returns an AsyncJob handle that
   * can be polled for the result.
   */
  async invokeAsync(
    functionId: string,
    input?: unknown,
    options?: InvokeOptions,
  ): Promise<AsyncJob> {
    const url = `${this.functionsUrl(functionId)}/invoke/async`;

    const response = await this.rawRequest(url, input, options);

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw mapError(response.status, error, response.headers);
    }

    const job = (await response.json()) as AsyncJobResponse;
    return new AsyncJob(this, functionId, job.job_id);
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /** @internal — Poll an async job. Used by AsyncJob. */
  async _pollJob(functionId: string, jobId: string): Promise<AsyncJobResult> {
    const url = `${this.functionsUrl(functionId)}/invoke/${jobId}`;
    const response = await this.rawRequest(url, undefined, {}, "GET");
    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw mapError(response.status, error, response.headers);
    }
    return (await response.json()) as AsyncJobResult;
  }

  private functionsUrl(functionId: string): string {
    return `${this.config.baseUrl}/v1/functions/${encodeURIComponent(functionId)}`;
  }

  private defaultHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `zylora-sdk-ts/${SDK_VERSION}`,
      "X-SDK-Version": SDK_VERSION,
      ...extra,
    };
  }

  /** Make a raw HTTP request with retry logic. */
  private async rawRequest(
    url: string,
    body: unknown,
    options?: InvokeOptions,
    method = "POST",
  ): Promise<Response> {
    const headers = this.defaultHeaders(options?.headers);
    const timeout = options?.timeout ?? this.config.timeout;
    let lastError: unknown;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: method !== "GET" && body !== undefined ? JSON.stringify(body) : null,
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Retry on 5xx (server errors) — but not on the last attempt
        if (response.status >= 500 && attempt < this.config.maxRetries - 1) {
          await this.backoff(attempt);
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (attempt < this.config.maxRetries - 1) {
          await this.backoff(attempt);
          continue;
        }
      }
    }

    throw lastError;
  }

  /**
   * Make a request, parse the response, and throw on error status.
   */
  private async request(
    url: string,
    body: unknown,
    options?: InvokeOptions,
  ): Promise<unknown> {
    const response = await this.rawRequest(url, body, options);

    if (!response.ok) {
      const error = await this.parseErrorResponse(response);
      throw mapError(response.status, error, response.headers);
    }

    return response.json();
  }

  /** Parse SSE events from a ReadableStream<Uint8Array>. */
  private async *parseSSE(
    body: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        if (signal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "") continue;

          // Parse SSE event types
          if (trimmed.startsWith("event: done")) {
            return;
          }
          if (trimmed.startsWith("event: error")) {
            // Next data line contains the error
            continue;
          }
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            try {
              const parsed = JSON.parse(data) as { chunk?: string; error?: { message?: string } };
              if (parsed.error) {
                throw new Error(parsed.error.message ?? "Stream error");
              }
              if (parsed.chunk !== undefined) {
                yield parsed.chunk;
              }
            } catch (e) {
              // If it's not JSON, yield raw data
              if (e instanceof SyntaxError) {
                yield data;
              } else {
                throw e;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async parseErrorResponse(
    response: Response,
  ): Promise<ErrorResponse["error"] | undefined> {
    try {
      const body = (await response.json()) as ErrorResponse;
      return body.error;
    } catch {
      return undefined;
    }
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(1000 * 2 ** attempt, 10_000);
    const jitter = Math.random() * delay * 0.1;
    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
  }
}

// ── AsyncJob ─────────────────────────────────────────────────────────────────

/**
 * A handle to an asynchronous invocation. Poll for the result with `.result()`.
 */
export class AsyncJob {
  readonly jobId: string;
  private readonly client: Zylora;
  private readonly functionId: string;

  constructor(client: Zylora, functionId: string, jobId: string) {
    this.client = client;
    this.functionId = functionId;
    this.jobId = jobId;
  }

  /**
   * Poll until the job completes and return the result.
   *
   * @param timeout - Maximum time to wait in milliseconds (default: 300_000)
   * @param pollInterval - Interval between polls in milliseconds (default: 1000)
   */
  async result<T = unknown>(timeout = 300_000, pollInterval = 1_000): Promise<T> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const job = await this.client._pollJob(this.functionId, this.jobId);

      if (job.status === "completed") {
        return job.output as T;
      }

      if (job.status === "failed" || job.status === "timeout" || job.status === "cancelled") {
        throw new Error(
          job.error?.message ?? `Job ${this.jobId} ${job.status}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Job ${this.jobId} timed out after ${timeout}ms`);
  }
}
