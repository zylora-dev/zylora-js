import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Zylora } from "../src/client.js";
import { AuthenticationError, FunctionNotFoundError, ZyloraError } from "../src/errors.js";

// Helper to create mock Response objects
function mockResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

describe("Zylora client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("invoke sends correct request", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { embedding: [0.1, 0.2, 0.3] }),
    );

    const zy = new Zylora({ apiKey: "zy_test_key" });
    const result = await zy.invoke("embed-fn", { text: "hello" });

    expect(result).toEqual({ embedding: [0.1, 0.2, 0.3] });

    // Verify request details
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.zylora.dev/v1/functions/embed-fn/invoke");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ text: "hello" }));
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer zy_test_key");
  });

  it("invoke throws AuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(401, {
        error: { code: "auth_error", message: "Invalid API key", request_id: "req-1" },
      }),
    );

    const zy = new Zylora({ apiKey: "zy_bad_key" });
    await expect(zy.invoke("fn", {})).rejects.toThrow(AuthenticationError);
  });

  it("invoke throws FunctionNotFoundError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(404, {
        error: { code: "not_found", message: "Function not found", request_id: "req-2" },
      }),
    );

    const zy = new Zylora({ apiKey: "zy_test" });
    await expect(zy.invoke("nonexistent", {})).rejects.toThrow(FunctionNotFoundError);
  });

  it("batch sends correct request shape", async () => {
    const batchBody = {
      results: [
        { index: 0, status: "completed", result: [0.1], error: null },
        { index: 1, status: "completed", result: [0.2], error: null },
      ],
      total: 2,
      succeeded: 2,
      failed: 0,
    };
    fetchSpy.mockResolvedValueOnce(mockResponse(200, batchBody));

    const zy = new Zylora({ apiKey: "zy_test" });
    const result = await zy.batch("embed-fn", [{ text: "a" }, { text: "b" }]);

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.zylora.dev/v1/functions/embed-fn/map");
    const body = JSON.parse(init?.body as string) as { inputs: unknown[]; concurrency: number };
    expect(body.inputs).toHaveLength(2);
    expect(body.concurrency).toBe(10);
  });

  it("batch uses custom concurrency", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, { results: [], total: 0, succeeded: 0, failed: 0 }),
    );

    const zy = new Zylora({ apiKey: "zy_test" });
    await zy.batch("fn", [{ a: 1 }], { concurrency: 50 });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string) as { concurrency: number };
    expect(body.concurrency).toBe(50);
  });

  it("invokeAsync returns AsyncJob", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockResponse(202, {
        job_id: "job-abc-123",
        status: "queued",
        created_at: "2026-04-10T14:30:00Z",
      }),
    );

    const zy = new Zylora({ apiKey: "zy_test" });
    const job = await zy.invokeAsync("embed-fn", { text: "hello" });

    expect(job.jobId).toBe("job-abc-123");

    // Now mock polling — first call returns running, second returns completed
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, {
        job_id: "job-abc-123",
        status: "running",
        result: null,
        error: null,
        created_at: "2026-04-10T14:30:00Z",
        completed_at: null,
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      mockResponse(200, {
        job_id: "job-abc-123",
        status: "completed",
        result: { embedding: [0.1] },
        error: null,
        created_at: "2026-04-10T14:30:00Z",
        completed_at: "2026-04-10T14:30:02Z",
      }),
    );

    const result = await job.result(10_000, 10); // Short poll interval for test
    expect(result).toEqual({ embedding: [0.1] });
  });

  it("retries on 5xx errors", async () => {
    fetchSpy
      .mockResolvedValueOnce(mockResponse(500, { error: { code: "internal", message: "oops", request_id: "r1" } }))
      .mockResolvedValueOnce(mockResponse(200, { ok: true }));

    const zy = new Zylora({ apiKey: "zy_test", maxRetries: 2 });
    const result = await zy.invoke("fn", {});

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("sends SDK version header", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, {}));

    const zy = new Zylora({ apiKey: "zy_test" });
    await zy.invoke("fn", {});

    const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers["X-SDK-Version"]).toBe("0.1.0");
    expect(headers["User-Agent"]).toContain("zylora-sdk-ts");
  });

  it("encodes function ID in URL", async () => {
    fetchSpy.mockResolvedValueOnce(mockResponse(200, {}));

    const zy = new Zylora({ apiKey: "zy_test" });
    await zy.invoke("fn with spaces", {});

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("fn%20with%20spaces");
  });
});
