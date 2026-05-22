---
title: Building an MCP Server for Visa Requirements in TypeScript
published: false
description: A practical walkthrough of building a Model Context Protocol server that gives AI agents reliable access to visa requirement data for 39,585 country pairs.
tags: mcp, typescript, ai, travel
---

## What is MCP, and why should you care?

The Model Context Protocol (MCP) is an open standard created by Anthropic that lets AI agents connect to external tools and data sources through a unified interface. Think of it as USB-C for AI: one protocol, any agent. Instead of building custom integrations for Claude, GPT, Gemini, and every other model, you build one MCP server and every compatible agent can use it.

MCP defines a simple contract. Your server exposes **tools** (functions the AI can call) and **resources** (data the AI can read). The agent discovers what's available, reads the descriptions, and decides when to use them. The transport layer is pluggable -- stdio for local tools, SSE or HTTP for remote ones.

The protocol is gaining traction fast. Claude Desktop, Cursor, Windsurf, and dozens of other clients already support it. If you have an API that AI agents should be able to use, wrapping it in MCP is one of the highest-leverage things you can do right now.

## Why visa requirements are perfect for MCP

Here's a problem every travel-focused AI agent has: visa requirements. Ask an LLM whether a Brazilian passport holder needs a visa for Japan, and you'll get an answer -- but it might be wrong. Models rely on training data that's months or years old, and visa policies change constantly. Thailand just launched a new 60-day visa exemption. Turkey updated its e-visa rules. The model doesn't know.

Visa data is structured, query-driven, and time-sensitive. It's exactly the kind of information that should come from a live API, not from parametric memory. An MCP server bridges that gap: the agent recognizes a visa question, calls the tool, and gets current data from a real database.

That's what we built with the **Orizn Visa MCP Server** -- a TypeScript MCP server backed by an API covering 39,585 passport-destination pairs in 15 languages.

## Architecture overview

The stack is deliberately minimal:

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **MCP SDK**: `@modelcontextprotocol/sdk` (v1.12+)
- **Transport**: stdio (runs locally alongside the AI client)
- **Backend**: Orizn Visa API at `https://visa.orizn.app/api/v1/visa`

The server exposes **5 tools** and **2 resources**:

| Tools | Description |
|-------|------------|
| `check_visa_requirement` | Full visa details for a passport-destination pair |
| `quick_visa_check` | Fast yes/no check (free, no API key) |
| `get_all_destinations` | All destinations for one passport at once |
| `get_visa_changes` | Recent visa policy updates |
| `get_coverage_stats` | Database coverage statistics |

| Resources | Description |
|-----------|------------|
| `visa://supported-languages` | The 15 supported language codes |
| `visa://country-codes` | All 199 ISO3 country codes the API accepts |

## Code walkthrough

### Server initialization

MCP servers start with a `Server` instance and a transport. We use `StdioServerTransport`, which communicates over stdin/stdout -- the standard for local MCP servers:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "orizn-visa", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

You register capabilities upfront -- `tools` and `resources` -- so the client knows what to expect.

### Defining tools

Tools are defined with a name, description, and JSON Schema for inputs. Here's the core visa check tool:

```typescript
{
  name: "check_visa_requirement",
  description:
    "Check visa requirements between any two countries. Returns visa type " +
    "(visa-free, e-visa, visa required, etc.), allowed stay duration, " +
    "required documents, step-by-step application process, and travel tips. " +
    "Covers 39,585 passport-destination pairs in 15 languages. " +
    "Use this tool when the user asks about visa rules, entry requirements, " +
    "or whether they need a visa to visit a country.",
  inputSchema: {
    type: "object",
    properties: {
      passport: {
        type: "string",
        description: "ISO 3166-1 alpha-3 code of the passport (e.g. 'FRA').",
      },
      destination: {
        type: "string",
        description: "ISO 3166-1 alpha-3 code of the destination (e.g. 'JPN').",
      },
      lang: {
        type: "string",
        description: "Language code for the response. Defaults to 'en'.",
      },
    },
    required: ["passport", "destination"],
  },
}
```

The tool handler validates inputs and calls the API:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case "check_visa_requirement": {
      const passport = validateISO3(args.passport, "passport");
      const destination = validateISO3(args.destination, "destination");
      const lang = validateLang(args.lang);
      const result = await apiFetch("", { passport, destination, lang }, apiKey, true);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    // ... other tools
  }
});
```

### Resources

Resources let the agent look up reference data without burning an API call. We expose two static resources -- supported languages and valid country codes:

```typescript
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  switch (request.params.uri) {
    case "visa://supported-languages":
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(SUPPORTED_LANGUAGES_RESOURCE, null, 2),
        }],
      };
    case "visa://country-codes":
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(COUNTRY_CODES_RESOURCE, null, 2),
        }],
      };
  }
});
```

This way, when the agent isn't sure of a country code, it can check the resource first instead of guessing.

### API client with retry logic

The API client handles timeouts, retries on 5xx errors, and fails fast on 4xx:

```typescript
async function apiFetch(path: string, params: Record<string, string>,
                        apiKey: string | undefined, requiresKey: boolean): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET", headers, signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) return await response.json();

      // Don't retry client errors -- the request itself is wrong
      if (response.status >= 400 && response.status < 500) {
        throw new McpError(ErrorCode.InvalidRequest,
          `API returned ${response.status}: ${await response.text()}`);
      }

      // 5xx: retry
      lastError = new Error(`API returned ${response.status}`);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof McpError) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new McpError(ErrorCode.InternalError,
    `API request failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}
```

The distinction between 4xx and 5xx is important. A 400 means the agent sent bad parameters -- retrying won't help. A 503 means the server hiccupped -- retrying might.

### ISO3 validation

Country codes are validated against a hardcoded set of 199 codes before hitting the API. This catches the most common error pattern (the LLM sends "JP" instead of "JPN") at the MCP layer with a clear error message, rather than letting it propagate as a cryptic API error:

```typescript
function validateISO3(code: unknown, paramName: string): string {
  const upper = (code as string).toUpperCase();
  if (!ISO3_COUNTRY_CODES.has(upper)) {
    throw new McpError(ErrorCode.InvalidParams,
      `"${paramName}" value "${code}" is not a valid ISO 3166-1 alpha-3 country code.`);
  }
  return upper;
}
```

## Key decisions and lessons learned

**Tool descriptions are your most important code.** The LLM reads them to decide *when* to invoke your tool. Vague descriptions mean the agent won't call your tool when it should. We explicitly state what each tool returns, what it covers (39,585 pairs, 15 languages), and when to use it versus alternatives. This isn't documentation -- it's prompt engineering.

**stdout is sacred.** In stdio transport, stdout carries MCP protocol messages. If you `console.log()` anything, you'll corrupt the protocol stream and crash the connection. All our logging goes to stderr via `process.stderr.write()`. This is the #1 mistake people make when building their first MCP server.

**Free tier drives adoption.** The `quick_visa_check` and `get_coverage_stats` tools work without an API key. This means anyone can `npx orizn-visa-mcp` and immediately test it. Zero friction. If they need full details, they add a key. But the first experience is instant.

**Validate before you fetch.** Catching "FR" vs "FRA" at the validation layer gives the agent a clear, actionable error ("not a valid ISO 3166-1 alpha-3 code") instead of a generic API 400. The agent can self-correct and retry with the right format.

## Publishing and distribution

Building the server is half the work. Getting it in front of developers is the other half.

1. **npm publish** -- This enables `npx orizn-visa-mcp`, the fastest path from discovery to running server. Set the `bin` field in `package.json` and add the shebang (`#!/usr/bin/env node`) to your entry point.

2. **MCP registries** -- Submit to [Smithery](https://smithery.ai), [mcp.so](https://mcp.so), and [Glama](https://glama.ai/mcp/servers). These are where developers browse for MCP servers. A `smithery.yaml` config file handles Smithery's hosted deployment.

3. **README as marketing** -- Your README is your landing page. Include a clear one-liner, a feature table, installation instructions for every major client (Claude Desktop, Cursor, VS Code), and example outputs. Most developers decide whether to try your server in 30 seconds of scanning the README.

## Try it

The server is open source and ready to use:

- **GitHub**: [github.com/MattJeff/orizn-mcp-server](https://github.com/MattJeff/orizn-mcp-server)
- **npm**: [npmjs.com/package/orizn-visa-mcp](https://www.npmjs.com/package/orizn-visa-mcp)
- **Run it**: `npx orizn-visa-mcp`
- **API docs**: [visa.orizn.app](https://visa.orizn.app)

If you're building an AI agent that touches travel, immigration, or international logistics, plug this in and your agent gets reliable visa data instead of hallucinated guesses. And if you're building your own MCP server -- steal the patterns. The protocol is simple, the SDK is solid, and the ecosystem is growing fast.
