import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveConfig } from "../src/config.js";

describe("resolveConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear any Zylora env vars
    delete process.env["ZYLORA_API_KEY"];
    delete process.env["ZYLORA_API_URL"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses explicit apiKey option", () => {
    const config = resolveConfig({ apiKey: "zy_test_123" });
    expect(config.apiKey).toBe("zy_test_123");
    expect(config.baseUrl).toBe("https://api.zylora.dev");
  });

  it("discovers apiKey from ZYLORA_API_KEY env", () => {
    process.env["ZYLORA_API_KEY"] = "zy_env_456";
    const config = resolveConfig();
    expect(config.apiKey).toBe("zy_env_456");
  });

  it("explicit apiKey takes precedence over env", () => {
    process.env["ZYLORA_API_KEY"] = "zy_env_456";
    const config = resolveConfig({ apiKey: "zy_explicit" });
    expect(config.apiKey).toBe("zy_explicit");
  });

  it("throws if no apiKey found", () => {
    expect(() => resolveConfig()).toThrow("Missing API key");
  });

  it("uses explicit baseUrl option", () => {
    const config = resolveConfig({ apiKey: "zy_test", baseUrl: "https://custom.api.dev" });
    expect(config.baseUrl).toBe("https://custom.api.dev");
  });

  it("discovers baseUrl from ZYLORA_API_URL env", () => {
    process.env["ZYLORA_API_KEY"] = "zy_test";
    process.env["ZYLORA_API_URL"] = "https://env.api.dev";
    const config = resolveConfig();
    expect(config.baseUrl).toBe("https://env.api.dev");
  });

  it("uses default timeout and maxRetries", () => {
    const config = resolveConfig({ apiKey: "zy_test" });
    expect(config.timeout).toBe(300_000);
    expect(config.maxRetries).toBe(3);
  });

  it("accepts custom timeout and maxRetries", () => {
    const config = resolveConfig({ apiKey: "zy_test", timeout: 60_000, maxRetries: 5 });
    expect(config.timeout).toBe(60_000);
    expect(config.maxRetries).toBe(5);
  });
});
