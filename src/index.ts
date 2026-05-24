#!/usr/bin/env node

/**
 * Orizn Visa API - MCP Server
 *
 * A Model Context Protocol server exposing the Orizn Visa API as tools and resources.
 * Transport: stdio | Auth: x-api-key header | Runtime: Node.js
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = "https://visa.orizn.app/api/v1/visa";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

const SUPPORTED_LANGUAGES = [
  "fr", "en", "es", "pt", "de",
  "ja", "ko", "zh", "ru", "it",
  "ar", "hi", "th", "vi", "tl",
] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** All 199 ISO 3166-1 alpha-3 country codes. */
const ISO3_COUNTRY_CODES = new Set<string>([
  "AFG", "ALB", "DZA", "AND", "AGO", "ATG", "ARG", "ARM", "AUS", "AUT",
  "AZE", "BHS", "BHR", "BGD", "BRB", "BLR", "BEL", "BLZ", "BEN", "BTN",
  "BOL", "BIH", "BWA", "BRA", "BRN", "BGR", "BFA", "BDI", "CPV", "KHM",
  "CMR", "CAN", "CAF", "TCD", "CHL", "CHN", "COL", "COM", "COG", "COD",
  "CRI", "CIV", "HRV", "CUB", "CYP", "CZE", "DNK", "DJI", "DMA", "DOM",
  "ECU", "EGY", "SLV", "GNQ", "ERI", "EST", "SWZ", "ETH", "FJI", "FIN",
  "FRA", "GAB", "GMB", "GEO", "DEU", "GHA", "GRC", "GRD", "GTM", "GIN",
  "GNB", "GUY", "HTI", "HND", "HUN", "ISL", "IND", "IDN", "IRN", "IRQ",
  "IRL", "ISR", "ITA", "JAM", "JPN", "JOR", "KAZ", "KEN", "KIR", "PRK",
  "KOR", "KWT", "KGZ", "LAO", "LVA", "LBN", "LSO", "LBR", "LBY", "LIE",
  "LTU", "LUX", "MDG", "MWI", "MYS", "MDV", "MLI", "MLT", "MHL", "MRT",
  "MUS", "MEX", "FSM", "MDA", "MCO", "MNG", "MNE", "MAR", "MOZ", "MMR",
  "NAM", "NRU", "NPL", "NLD", "NZL", "NIC", "NER", "NGA", "MKD", "NOR",
  "OMN", "PAK", "PLW", "PAN", "PNG", "PRY", "PER", "PHL", "POL", "PRT",
  "QAT", "ROU", "RUS", "RWA", "KNA", "LCA", "VCT", "WSM", "SMR", "STP",
  "SAU", "SEN", "SRB", "SYC", "SLE", "SGP", "SVK", "SVN", "SLB", "SOM",
  "ZAF", "SSD", "ESP", "LKA", "SDN", "SUR", "SWE", "CHE", "SYR", "TWN",
  "TJK", "TZA", "THA", "TLS", "TGO", "TON", "TTO", "TUN", "TUR", "TKM",
  "TUV", "UGA", "UKR", "ARE", "GBR", "USA", "URY", "UZB", "VUT", "VAT",
  "VEN", "VNM", "YEM", "ZMB", "ZWE", "PSE", "XKX", "COK", "NIU",
]);

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseCliArgs(): { apiKey?: string } {
  const args = process.argv.slice(2);
  let apiKey: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--api-key" && i + 1 < args.length) {
      apiKey = args[i + 1];
      i++;
    } else if (args[i]?.startsWith("--api-key=")) {
      apiKey = args[i].split("=").slice(1).join("=");
    }
  }

  return { apiKey };
}

// ---------------------------------------------------------------------------
// Logging (stderr only - stdout is reserved for MCP protocol)
// ---------------------------------------------------------------------------

function log(level: "info" | "warn" | "error", message: string, data?: unknown): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

function resolveApiKey(cliKey?: string): string | undefined {
  return cliKey ?? process.env.ORIZN_API_KEY;
}

async function apiFetch(
  path: string,
  params: Record<string, string>,
  apiKey: string | undefined,
  requiresKey: boolean,
): Promise<unknown> {
  if (requiresKey && !apiKey) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      "This endpoint requires an API key. Set the ORIZN_API_KEY environment variable or pass --api-key.",
    );
  }

  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "orizn-mcp-server/1.0",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return await response.json();
      }

      // Do not retry client errors
      if (response.status >= 400 && response.status < 500) {
        const body = await response.text().catch(() => "");
        throw new McpError(
          ErrorCode.InvalidRequest,
          `API returned ${response.status}: ${body || response.statusText}`,
        );
      }

      // 5xx - retry once
      lastError = new Error(`API returned ${response.status}: ${response.statusText}`);
      if (attempt < MAX_RETRIES) {
        log("warn", `Retrying after ${response.status}`, { url: url.toString(), attempt });
        continue;
      }
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof McpError) throw err;

      const isAbort =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");

      if (isAbort) {
        lastError = new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < MAX_RETRIES) {
        log("warn", "Retrying after network error", { url: url.toString(), attempt, error: lastError.message });
        continue;
      }
    }
  }

  throw new McpError(
    ErrorCode.InternalError,
    `API request failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message ?? "unknown error"}`,
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateISO3(code: unknown, paramName: string): string {
  if (typeof code !== "string" || code.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `"${paramName}" is required and must be a non-empty string.`);
  }
  const upper = code.toUpperCase();
  if (!ISO3_COUNTRY_CODES.has(upper)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `"${paramName}" value "${code}" is not a valid ISO 3166-1 alpha-3 country code.`,
    );
  }
  return upper;
}

function validateLang(lang: unknown): SupportedLanguage {
  if (lang === undefined || lang === null || lang === "") return "en";
  if (typeof lang !== "string") {
    throw new McpError(ErrorCode.InvalidParams, `"lang" must be a string.`);
  }
  const lower = lang.toLowerCase() as SupportedLanguage;
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lower)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Unsupported language "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
    );
  }
  return lower;
}

function optionalISO3(code: unknown, paramName: string): string | undefined {
  if (code === undefined || code === null || code === "") return undefined;
  return validateISO3(code, paramName);
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "check_visa_requirement",
    description:
      "Check visa requirements between any two countries. Returns visa type (visa-free, e-visa, visa required, etc.), " +
      "allowed stay duration, required documents, step-by-step application process, and travel tips. " +
      "Covers 39,585 passport-destination pairs in 15 languages. " +
      "Use this tool when the user asks about visa rules, entry requirements, travel documents, or whether they need a visa to visit a country. " +
      "Requires an API key.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 country code of the passport holder (e.g. 'FRA' for France, 'USA' for United States).",
        },
        destination: {
          type: "string",
          description: "ISO 3166-1 alpha-3 country code of the destination country (e.g. 'JPN' for Japan, 'THA' for Thailand).",
        },
        lang: {
          type: "string",
          description:
            "Language code for the response. Supported: fr, en, es, pt, de, ja, ko, zh, ru, it, ar, hi, th, vi, tl. Defaults to 'en'.",
        },
      },
      required: ["passport", "destination"],
    },
  },
  {
    name: "quick_visa_check",
    description:
      "Quickly check whether a visa is required between two countries. Returns only the visa status (visa-free, e-visa, visa required, etc.) " +
      "without detailed documents or process steps. Requires a free API key. Get one at https://visa.orizn.app " +
      "Use this tool for simple yes/no visa requirement checks or when no API key is available. " +
      "For full details, use check_visa_requirement instead.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 country code of the passport holder (e.g. 'FRA' for France).",
        },
        destination: {
          type: "string",
          description: "ISO 3166-1 alpha-3 country code of the destination country (e.g. 'JPN' for Japan).",
        },
      },
      required: ["passport", "destination"],
    },
  },
  {
    name: "get_all_destinations",
    description:
      "Get visa requirements for ALL destinations from a single passport country at once. " +
      "Returns a complete list of every country with visa status, stay duration, and details for each. " +
      "Ideal for travel planning, building visa maps, or comparing access across destinations. " +
      "Requires a Pro plan API key. Use this when the user wants a full overview of where their passport lets them travel.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 country code of the passport holder (e.g. 'FRA' for France).",
        },
        lang: {
          type: "string",
          description:
            "Language code for the response. Supported: fr, en, es, pt, de, ja, ko, zh, ru, it, ar, hi, th, vi, tl. Defaults to 'en'.",
        },
      },
      required: ["passport"],
    },
  },
  {
    name: "get_visa_changes",
    description:
      "Get recent changes to visa policies worldwide. Returns newly announced visa requirement updates, " +
      "visa exemptions, and policy modifications. Optionally filter by passport country or destination country. " +
      "Requires a Starter plan API key. Use this tool when the user asks about recent visa news, policy updates, " +
      "or changes in entry requirements for a country.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "Optional ISO 3166-1 alpha-3 code to filter changes affecting holders of this passport.",
        },
        destination: {
          type: "string",
          description: "Optional ISO 3166-1 alpha-3 code to filter changes for this destination country.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_coverage_stats",
    description:
      "Get coverage statistics for the Orizn Visa database. Returns the total number of passport-destination pairs covered, " +
      "number of countries, and supported languages. This endpoint is free and requires no API key. " +
      "Use this tool when the user asks about the size, scope, or coverage of the visa database.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Resource data
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES_RESOURCE = {
  languages: SUPPORTED_LANGUAGES.map((code) => {
    const names: Record<string, string> = {
      fr: "French", en: "English", es: "Spanish", pt: "Portuguese", de: "German",
      ja: "Japanese", ko: "Korean", zh: "Chinese", ru: "Russian", it: "Italian",
      ar: "Arabic", hi: "Hindi", th: "Thai", vi: "Vietnamese", tl: "Filipino",
    };
    return { code, name: names[code] ?? code };
  }),
};

const COUNTRY_CODES_RESOURCE = {
  codes: Array.from(ISO3_COUNTRY_CODES).sort(),
  total: ISO3_COUNTRY_CODES.size,
};

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cliArgs = parseCliArgs();
  const apiKey = resolveApiKey(cliArgs.apiKey);

  if (apiKey) {
    log("info", "API key loaded — all tools available");
  } else {
    log("info", "Running in free mode — quick_visa_check and get_coverage_stats only");
    process.stderr.write(
      "\n" +
      "  ╭─────────────────────────────────────────────────────╮\n" +
      "  │  Orizn Visa MCP — free mode                        │\n" +
      "  │                                                     │\n" +
      "  │  Get your free API key for full access:             │\n" +
      "  │  → https://visa.orizn.app                          │\n" +
      "  │                                                     │\n" +
      "  │  3,000 req/month · 15 languages · no credit card   │\n" +
      "  │                                                     │\n" +
      "  │  Then set: ORIZN_API_KEY=orizn_visa_...            │\n" +
      "  ╰─────────────────────────────────────────────────────╯\n" +
      "\n"
    );
  }

  const server = new Server(
    {
      name: "orizn-visa",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  // ---- Tools: list --------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...TOOLS],
  }));

  // ---- Tools: call --------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case "check_visa_requirement": {
          const passport = validateISO3(args.passport, "passport");
          const destination = validateISO3(args.destination, "destination");
          const lang = validateLang(args.lang);
          result = await apiFetch("", { passport, destination, lang }, apiKey, true);
          break;
        }

        case "quick_visa_check": {
          const passport = validateISO3(args.passport, "passport");
          const destination = validateISO3(args.destination, "destination");
          result = await apiFetch("/check", { passport, destination }, apiKey, true);
          break;
        }

        case "get_all_destinations": {
          const passport = validateISO3(args.passport, "passport");
          const lang = validateLang(args.lang);
          result = await apiFetch("/bulk", { passport, lang }, apiKey, true);
          break;
        }

        case "get_visa_changes": {
          const params: Record<string, string> = {};
          const passport = optionalISO3(args.passport, "passport");
          const destination = optionalISO3(args.destination, "destination");
          if (passport) params.passport = passport;
          if (destination) params.destination = destination;
          result = await apiFetch("/changes", params, apiKey, true);
          break;
        }

        case "get_coverage_stats": {
          result = await apiFetch("/stats", {}, apiKey, false);
          break;
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      if (err instanceof McpError) throw err;

      const message = err instanceof Error ? err.message : String(err);
      log("error", `Tool "${name}" failed`, { error: message });
      throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
    }
  });

  // ---- Resources: list ----------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "visa://supported-languages",
        name: "Supported Languages",
        description: "List of 15 language codes supported by the Orizn Visa API for localized responses.",
        mimeType: "application/json",
      },
      {
        uri: "visa://country-codes",
        name: "ISO 3166-1 Alpha-3 Country Codes",
        description: "Complete list of 199 ISO 3166-1 alpha-3 country codes accepted by the Orizn Visa API.",
        mimeType: "application/json",
      },
    ],
  }));

  // ---- Resources: read ----------------------------------------------------

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    switch (uri) {
      case "visa://supported-languages":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(SUPPORTED_LANGUAGES_RESOURCE, null, 2),
            },
          ],
        };

      case "visa://country-codes":
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(COUNTRY_CODES_RESOURCE, null, 2),
            },
          ],
        };

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    }
  });

  // ---- Error handling -----------------------------------------------------

  server.onerror = (error: Error) => {
    log("error", "Server error", { error: error.message, stack: error.stack });
  };

  process.on("SIGINT", async () => {
    log("info", "Shutting down");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log("info", "Shutting down");
    await server.close();
    process.exit(0);
  });

  // ---- Start --------------------------------------------------------------

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("info", "Orizn Visa MCP server started on stdio");
}

main().catch((err) => {
  log("error", "Fatal startup error", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
