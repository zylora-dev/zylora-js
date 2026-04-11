# @zylora/sdk

TypeScript SDK for the Zylora GPU platform — invoke serverless GPU functions from any JavaScript/TypeScript runtime.

## Installation

```bash
pnpm add @zylora/sdk
# or
npm install @zylora/sdk
```

## Quickstart

```typescript
import { Zylora } from "@zylora/sdk";

const zy = new Zylora({ apiKey: process.env.ZYLORA_API_KEY });

// Invoke a function
const result = await zy.invoke("my-embed-fn", { text: "hello world" });
console.log(result);
```

## Authentication

The SDK discovers your API key in this order:

1. Explicit `apiKey` option passed to the constructor
2. `ZYLORA_API_KEY` environment variable

```bash
export ZYLORA_API_KEY="zy_live_..."
```

## Usage

### Synchronous invocation

```typescript
const result = await zy.invoke("embed", { text: "hello" });
```

### Batch invocation

```typescript
const batch = await zy.batch("embed", [
  { text: "hello" },
  { text: "world" },
], { concurrency: 20 });

for (const item of batch.results) {
  console.log(item.index, item.result);
}
```

### Streaming (for LLMs)

```typescript
for await (const chunk of zy.stream("generate", { prompt: "Tell me a joke" })) {
  process.stdout.write(chunk);
}
```

### Async invocation

```typescript
const job = await zy.invokeAsync("long-task", { data: largePayload });
console.log("Job submitted:", job.jobId);

// Poll for result (blocks until complete)
const result = await job.result();
```

## Client options

| Option       | Type     | Default                    | Description                    |
|-------------|----------|----------------------------|--------------------------------|
| `apiKey`    | `string` | `ZYLORA_API_KEY` env       | API key for authentication     |
| `baseUrl`   | `string` | `https://api.zylora.dev`   | API base URL                   |
| `timeout`   | `number` | `300000` (5 min)           | Request timeout in ms          |
| `maxRetries`| `number` | `3`                        | Max retry attempts on 5xx      |

## Error handling

```typescript
import { Zylora, AuthenticationError, RateLimitError } from "@zylora/sdk";

try {
  await zy.invoke("fn", input);
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("Bad API key");
  } else if (err instanceof RateLimitError) {
    console.error(`Rate limited — retry after ${err.retryAfter}s`);
  }
}
```

### Error types

| Error class              | HTTP status | Description                     |
|-------------------------|-------------|---------------------------------|
| `AuthenticationError`    | 401         | Invalid or missing API key      |
| `InsufficientCreditsError` | 402      | Account needs more credits      |
| `FunctionNotFoundError`  | 404         | Function ID doesn't exist       |
| `TimeoutError`           | 408         | Invocation timed out            |
| `ValidationError`        | 422         | Invalid request body            |
| `RateLimitError`         | 429         | Rate limit exceeded             |
| `NoCapacityError`        | 503         | No GPU capacity available       |

## Runtime compatibility

Works in **Node.js 18+**, **Deno**, **Bun**, and **Cloudflare Workers** — uses the standard `fetch` API.

## License

MIT
