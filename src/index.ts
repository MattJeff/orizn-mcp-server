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
const VERSION = "1.3.2";

/** Where a developer gets a free key, in ten seconds, without a card. */
const KEY_URL = "https://visa.orizn.app/visa-api";
/** Deep link straight to Starter checkout ($49/mo, 30,000 req) — Hobby is closed to new accounts. */
const UPGRADE_URL =
  "https://visa.orizn.app/visa-api/login?next=%2Fvisa-api%2Fdashboard%2Fbilling%3Fplan%3Dstarter%26source%3Dmcp";

/**
 * Referer sent on keyless calls.
 *
 * `/api/v1/visa/check` already serves keyless requests whose Referer is one of
 * ours, metered per IP (orizn-web `route.ts`, the `isWebDemo` branch). This
 * server is one of ours, so it takes that existing door rather than asking for
 * a new one — and names itself in the path so the anonymous traffic is legible
 * in the logs instead of masquerading as the website demo.
 */
const KEYLESS_REFERER = "https://visa.orizn.app/mcp";

/**
 * Keyless quick_visa_check calls allowed per server process per UTC day.
 *
 * 10 is not a guess: it is exactly what visa.orizn.app already grants an
 * anonymous IP (`ANON_DEMO_DAILY_LIMIT` in orizn-web/src/lib/visa-rate-limit.ts,
 * with a 30/month backstop). Matching it means this client refuses the 11th call
 * with a message that says the same thing the API would, instead of pretending
 * to allow what the API is about to reject. Enough for a real trip (a traveller
 * checks a handful of pairs); far short of an agent looping over a country list.
 *
 * ponytail: in-memory, so it resets when the MCP client restarts the server.
 * That is fine — the durable cap is the API's per-IP bucket. This counter exists
 * to produce a useful message, not to be a security boundary. If it ever has to
 * hold across restarts, persist `anonUsage` to a file under os.tmpdir().
 */
export const ANON_DAILY_LIMIT = 10;

const anonUsage = { day: "", count: 0 };

/** Take one keyless slot for today. Returns false when today's cap is spent. */
export function consumeAnonQuota(now: number = Date.now()): boolean {
  const day = new Date(now).toISOString().slice(0, 10);
  if (anonUsage.day !== day) {
    anonUsage.day = day;
    anonUsage.count = 0;
  }
  if (anonUsage.count >= ANON_DAILY_LIMIT) return false;
  anonUsage.count++;
  return true;
}

/** Test seam: forget today's keyless usage. */
export function resetAnonQuota(): void {
  anonUsage.day = "";
  anonUsage.count = 0;
}

export const ANON_LIMIT_MESSAGE =
  `Keyless daily limit reached (${ANON_DAILY_LIMIT} checks/day — the same allowance visa.orizn.app ` +
  `gives an anonymous visitor). A free API key raises it to 100 requests/month and unlocks documents, ` +
  `fees, processing times, transit rules and 15 languages: ${KEY_URL} (10 seconds, no credit card). ` +
  `Set ORIZN_API_KEY=<key> in the \`env\` block of your MCP config, then restart the client. ` +
  `The keyless allowance resets at 00:00 UTC.`;

const NO_KEY_MESSAGE =
  "No Orizn API key: quick_visa_check (yes/no + visa-free days + verification date, " +
  `${ANON_DAILY_LIMIT}/day) and get_coverage_stats still work — a free key at ` +
  KEY_URL +
  " (10 seconds, no card, 100 requests/month) lifts that cap and adds documents, fees, processing " +
  "times, transit rules and 15 languages; set ORIZN_API_KEY=<key> in the `env` block of your MCP " +
  "config, or start the server with --api-key <key>, then restart the client.";

const SUPPORTED_LANGUAGES = [
  "fr", "en", "es", "pt", "de",
  "ja", "ko", "zh", "ru", "it",
  "ar", "hi", "th", "vi", "tl",
] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Max destinations per compare_destinations call — mirrors the API's own cap. */
const MAX_BULK_DESTINATIONS = 25;

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
// Error messages
//
// These strings are the product's densest conversion point: an agent that hits
// one has just failed its user's request, and the next action has to be obvious
// from the message alone. Every branch names what went wrong AND the one URL
// that fixes it.
// ---------------------------------------------------------------------------

/** Pull the human-readable message out of an Orizn error body. */
export function apiErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    // Enveloppe serveur `{ error: { code, message } }` ou chaîne nue `{ error: "…" }`.
    const err = parsed.error;
    const msg = err && typeof err === "object" ? (err as { message?: unknown }).message : err;
    const parts = [msg, parsed.message].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (parts.length > 0) return parts.join(" ");
  } catch {
    /* not JSON — fall through to the raw text */
  }
  return body.slice(0, 300).trim();
}

/** Terminate a fragment so the sentence we append to it reads as a sentence.
 *  A trailing URL stays bare: a period glued to it ends up inside the link (source="api_429."). */
function sentence(s: string): string {
  const t = s.trim();
  return !t || /[.!?]$/.test(t) || /https?:\/\/\S+$/.test(t) ? t : `${t}.`;
}

export function apiErrorMessage(status: number, body: string): string {
  const detail = apiErrorDetail(body);

  // The API's own error text already carries the signup URL in some branches.
  // Repeating ours after it produces a two-URL wall nobody reads, so where our
  // copy is strictly better we replace the detail instead of appending to it.
  if (status === 401) {
    return NO_KEY_MESSAGE;
  }

  if (status === 403) {
    // 403 covers two very different problems: a bad key, and a good key on a
    // plan that does not include this endpoint. Sending someone to the signup
    // page when they already have a key (or to checkout when their key is a
    // typo) is the failure that loses them.
    if (/plan|upgrade|requires/i.test(detail)) {
      // The API appends its own bare billing link ("Upgrade at https://…/dashboard/billing").
      // Two upgrade URLs in one sentence is one too many, and ours preselects the plan.
      const withoutApiLink = detail.replace(/\s*Upgrade at\s+https?:\/\/\S+/i, "");
      return `${sentence(withoutApiLink)} Upgrade — Starter is $49/month for 30,000 requests, commercial licence: ${UPGRADE_URL}`;
    }
    return `Orizn rejected this API key (HTTP 403). Check ORIZN_API_KEY for typos or stray whitespace, ` +
      `confirm the key is still active in your dashboard, or get a fresh free key at ${KEY_URL}.`;
  }

  if (status === 429) {
    // Le serveur porte prix + lien checkout depuis sept. 2026 ; repli pour un vieux serveur ou une fixture.
    // Pas de pitch Starter sur un abuse_limit (plafond par passeport/jour, tous plans), ni quand NOTRE lien
    // est déjà là — un lien tiers (page 429 d'un proxy) ne compte pas.
    let code = "";
    try { code = String((JSON.parse(body) as { error?: { code?: unknown } }).error?.code ?? ""); } catch { /* corps non JSON */ }
    const fallback = code === "abuse_limit" || /https:\/\/visa\.orizn\.app\//.test(detail) ? "" : ` Starter is $49/month for 30,000 requests: ${UPGRADE_URL}`;
    return `${sentence(detail || "Rate limit reached.")}${fallback}`;
  }

  if (status === 404) {
    return `${sentence(detail || "No data for this pair.")} Check the codes before assuming the pair is uncovered — ` +
      `check that both codes are ISO 3166-1 alpha-3 (FRA, JPN, USA), not alpha-2 (FR, JP, US).`;
  }

  if (status === 503) {
    return `${sentence(detail || "Endpoint unavailable.")} This is temporary on Orizn's side, not a problem ` +
      `with your API key — retry later.`;
  }

  if (status === 400) {
    return sentence(detail || "Invalid request — check the parameters.");
  }

  return `Orizn API error ${status}. ${sentence(detail)}`;
}

export function networkErrorMessage(reason: string): string {
  return `Could not reach the Orizn API (${reason}). This is a network problem, not an API key problem — ` +
    `check your connection or proxy. ${API_BASE_URL}/stats answers without a key and is a quick way to test.`;
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
    throw new McpError(ErrorCode.InvalidRequest, NO_KEY_MESSAGE);
  }

  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": `orizn-mcp-server/${VERSION}`,
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  } else {
    // Keyless: go through the API's existing anonymous-demo door (see KEYLESS_REFERER).
    headers["Referer"] = KEYLESS_REFERER;
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

      const body = await response.text().catch(() => "");

      // Do not retry client errors, nor a deliberate 503 shutdown.
      if ((response.status >= 400 && response.status < 500) || response.status === 503) {
        const err = new McpError(ErrorCode.InvalidRequest, apiErrorMessage(response.status, body));
        // Callers that must branch on the status (get_recent_changes on 503) read this.
        (err as McpError & { httpStatus?: number }).httpStatus = response.status;
        throw err;
      }

      // Other 5xx - retry once
      lastError = new Error(apiErrorMessage(response.status, body));
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

      lastError = isAbort
        ? new Error(`timed out after ${REQUEST_TIMEOUT_MS}ms`)
        : (err instanceof Error ? err : new Error(String(err)));

      if (attempt < MAX_RETRIES) {
        log("warn", "Retrying after network error", { url: url.toString(), attempt, error: lastError.message });
        continue;
      }
      lastError = new Error(networkErrorMessage(lastError.message));
    }
  }

  throw new McpError(
    ErrorCode.InternalError,
    lastError?.message ?? networkErrorMessage("unknown error"),
  );
}

// ---------------------------------------------------------------------------
// Validation helpers
//
// ponytail: shape-only validation (3 letters), deliberately not a hardcoded
// country list. The previous 199-code allowlist rejected NCL, PYF, WLF, MAC and
// HKG client-side — all of which the API serves — and would silently rot again
// the next time coverage grows. The API is the authority; its 404 is the answer.
// ---------------------------------------------------------------------------

function validateISO3(code: unknown, paramName: string): string {
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `"${paramName}" is required and must be a non-empty string.`);
  }
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `"${paramName}" must be an ISO 3166-1 alpha-3 country code — three letters, e.g. FRA, JPN, USA. Got "${code}".`,
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

/** Parse the destinations argument of compare_destinations (array or CSV string). */
export function parseDestinationList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : null;

  if (!raw) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `"destinations" is required: 1 to ${MAX_BULK_DESTINATIONS} ISO 3166-1 alpha-3 codes, e.g. ["JPN","USA","DEU"].`,
    );
  }

  const codes = [...new Set(raw.map((c) => validateISO3(c, "destinations")))];

  if (codes.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `"destinations" must contain at least one country code.`);
  }
  if (codes.length > MAX_BULK_DESTINATIONS) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Too many destinations (${codes.length}). The API accepts at most ${MAX_BULK_DESTINATIONS} per call — split into several calls.`,
    );
  }
  return codes;
}

// ---------------------------------------------------------------------------
// Tool definitions
//
// The description is what the model reads to pick a tool. Each one states what
// it returns, what it costs (plan), and the situation that should trigger it.
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "check_visa_requirement",
    description:
      "THE default visa tool: full entry requirements for ONE passport travelling to ONE destination. " +
      "Returns visa type (visa_free / visa_required / e_visa / visa_on_arrival / eta / no_admission), days allowed, " +
      "description, required documents, application steps, visa types, cost, validity, max stay, processing time, " +
      "country info, plus passport validity months, visa fees, processing days, photo specs, vaccinations, " +
      "insurance, safety advisory, health requirements, overstay penalties, entry by mode (air/land/sea), " +
      "transit visa hubs, remote-work visa, extension rules, minor rules, dual-nationality and passport-stamp warnings, " +
      "and embassies. Answers in any of 15 languages (all plans, including free). " +
      "Call this whenever the user asks whether they need a visa, what documents or vaccinations are needed, " +
      "how much a visa costs, how long it takes, how long they can stay, or what happens if they overstay. " +
      "Requires an API key (free one at https://visa.orizn.app/visa-api). " +
      "On the free plan some deep fields come back as an {upgrade: ...} placeholder instead of data. " +
      "Reading the reply: every deep field carries a `granularity` — \"destination\" means the value describes the " +
      "destination country for all nationalities (fees, processing days, transit, overstay, safety), \"passport\" " +
      "means it describes the passport for all destinations (reciprocity history, stamp and dual-nationality " +
      "warnings). Only the top-level requirement, visa-free days, description and documents are pair-specific. " +
      "A field that Orizn does not have comes back as {status: \"unavailable\"} — say so rather than filling the " +
      "gap; and `as_of` is the reference date of that field, which is not live data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the traveller's passport (e.g. 'FRA' for France, 'USA' for United States).",
        },
        destination: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the country being entered (e.g. 'JPN' for Japan, 'THA' for Thailand).",
        },
        lang: {
          type: "string",
          description:
            "Language of the written fields (description, documents, steps, tips). One of: fr, en, es, pt, de, ja, ko, zh, ru, it, ar, hi, th, vi, tl. Defaults to 'en'. Available on every plan, free included.",
        },
      },
      required: ["passport", "destination"],
    },
  },
  {
    name: "quick_visa_check",
    description:
      "One-line answer for ONE passport/destination pair: the requirement code, the number of visa-free days, " +
      "and the date the pair was last verified. No documents, no process, no fees, and no translation — " +
      "use check_visa_requirement when the user needs any detail at all. " +
      "Prefer this only when the user wants a plain yes/no, or when checking many pairs and detail would be noise. " +
      "Works with NO API key, " + ANON_DAILY_LIMIT + " checks per day — the only tool that answers a traveller's " +
      "question keyless. A free key (https://visa.orizn.app/visa-api, no credit card) removes that daily cap. " +
      "The reply carries `last_verified`, the date this pair's data was last checked, or null when Orizn has no " +
      "verification date for it — report it rather than implying the answer is live.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the traveller's passport (e.g. 'FRA').",
        },
        destination: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the destination country (e.g. 'JPN').",
        },
      },
      required: ["passport", "destination"],
    },
  },
  {
    name: "compare_destinations",
    description:
      "Compare up to 25 destinations for ONE passport in a single call. Returns, per destination: requirement, " +
      "visa-free days, description, passport validity months, visa fee, safety advisory, health requirements, " +
      "vaccinations, insurance, entry by mode, and remote-work visa. " +
      "Use it for shortlists — 'where can I go visa-free in Asia', 'compare Thailand, Vietnam and Indonesia for my passport', " +
      "trip planning across several candidate countries. It does NOT return every country in the world: " +
      "pass the specific destinations to compare. Each destination returned counts as one request against the quota. " +
      "Requires a paid plan (Starter $49/month or above) — a free key gets HTTP 403 here.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the traveller's passport (e.g. 'FRA').",
        },
        destinations: {
          type: "array",
          items: { type: "string" },
          description:
            "1 to 25 ISO 3166-1 alpha-3 destination codes, e.g. ['JPN','THA','VNM']. A comma-separated string is also accepted.",
        },
        lang: {
          type: "string",
          description:
            "Language of the description field. One of: fr, en, es, pt, de, ja, ko, zh, ru, it, ar, hi, th, vi, tl. Defaults to 'en'.",
        },
      },
      required: ["passport", "destinations"],
    },
  },
  {
    name: "check_transit_visa",
    description:
      "Transit and layover rules for a country being connected through: airside/landside rules and how many " +
      "free transit hours its main hubs grant. " +
      "IMPORTANT — this data is modelled PER TRANSIT COUNTRY, not per passport nationality: the answer is the " +
      "same for every passport, and it is only available for 44 transit countries. The `passport` argument is " +
      "recorded but does not narrow the result. Treat the reply as general hub rules to confirm with the airline " +
      "or the transit country's authority, never as a per-nationality ruling. When the country is not covered, " +
      "the tool says so instead of guessing. " +
      "Call this for layovers, stopovers and connecting flights — not for entering a country as a destination " +
      "(use check_visa_requirement for that). Requires an API key; transit data needs a paid plan " +
      "(Starter $49/month or above), a free key gets an upgrade placeholder back.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the traveller's passport (e.g. 'IND').",
        },
        transit_country: {
          type: "string",
          description: "ISO 3166-1 alpha-3 code of the country being transited (e.g. 'ARE' for a Dubai layover, 'TUR' for Istanbul).",
        },
        lang: {
          type: "string",
          description: "Language code (fr, en, es, pt, de, ja, ko, zh, ru, it, ar, hi, th, vi, tl). Defaults to 'en'.",
        },
      },
      required: ["passport", "transit_country"],
    },
  },
  {
    name: "get_coverage_stats",
    description:
      "Coverage of the Orizn visa database itself: number of pairs, passports, destinations, translations, " +
      "languages, and the distribution of requirement types. Says nothing about any specific country pair. " +
      "Free, no API key needed — useful to confirm the server can reach the API. " +
      "Call it when the user asks how big or how complete the database is.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_recent_changes",
    description:
      "Recently changed visa rules — what changed, for which passport/destination pair, on what date, and from " +
      "which official source. " +
      "STATUS: Orizn's change feed is currently OFF and this tool returns {status:\"unavailable\", changes: []}. " +
      "It was shut down because it was publishing internally-detected inconsistencies between two Orizn tables as " +
      "if they were official policy changes. An empty answer here therefore means \"Orizn has no verified change " +
      "data\", NEVER \"nothing changed\" — do not tell the user rules are stable, tell them to check the " +
      "destination's official immigration source, and use check_visa_requirement for the current rule with its " +
      "verification date. When the feed comes back, only entries carrying a named source and a date are returned; " +
      "unverified entries are dropped rather than shown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        passport: {
          type: "string",
          description: "Optional ISO 3166-1 alpha-3 passport code to filter on (e.g. 'FRA').",
        },
        destination: {
          type: "string",
          description: "Optional ISO 3166-1 alpha-3 destination code to filter on (e.g. 'JPN').",
        },
        since: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD) — only changes detected on or after this date.",
        },
        limit: {
          type: "number",
          description: "Maximum number of changes to return (1-200, default 50).",
        },
      },
      required: [],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Tool dispatch
//
// Split out of the request handler so tests exercise the real path (argument
// validation, headers sent, keyless metering) instead of a copy of it.
// ---------------------------------------------------------------------------

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  apiKey: string | undefined,
): Promise<unknown> {
  switch (name) {
    case "check_visa_requirement": {
      const passport = validateISO3(args.passport, "passport");
      const destination = validateISO3(args.destination, "destination");
      const lang = validateLang(args.lang);
      return apiFetch("", { passport, destination, lang }, apiKey, true);
    }

    case "quick_visa_check": {
      const passport = validateISO3(args.passport, "passport");
      const destination = validateISO3(args.destination, "destination");
      // Keyless is a real, supported mode here — metered locally so the refusal
      // is a sentence the agent can act on, not the API's 429 after the fact.
      if (!apiKey && !consumeAnonQuota()) {
        throw new McpError(ErrorCode.InvalidRequest, ANON_LIMIT_MESSAGE);
      }
      return apiFetch("/check", { passport, destination }, apiKey, false);
    }

    case "compare_destinations": {
      const passport = validateISO3(args.passport, "passport");
      const destinations = parseDestinationList(args.destinations);
      const lang = validateLang(args.lang);
      return apiFetch("/bulk", { passport, destination: destinations.join(","), lang }, apiKey, true);
    }

    case "check_transit_visa": {
      const passport = validateISO3(args.passport, "passport");
      const transitCountry = validateISO3(args.transit_country, "transit_country");
      const lang = validateLang(args.lang);
      const full = await apiFetch("", { passport, destination: transitCountry, lang }, apiKey, true) as {
        data?: { transit_visa?: { status?: string; granularity?: string } };
      };
      const tv = full?.data?.transit_visa;
      // L'API répond `{status:"unavailable"}` quand elle n'a rien : on le
      // relaie tel quel plutôt que d'inventer une réponse. Et on répète la
      // maille dans la sortie — le modèle qui lit ça ne doit pas la présenter
      // comme un avis par nationalité.
      return {
        passport,
        transit_country: transitCountry,
        granularity: "destination",
        applies_to: `All nationalities transiting ${transitCountry}. Orizn does not model transit rules per passport; the ${passport} passport did not narrow this answer.`,
        transit_visa:
          tv && tv.status !== "unavailable"
            ? tv
            : {
                status: "unavailable",
                note: `Orizn has no transit-hub data for ${transitCountry} (44 transit countries covered). ` +
                  `Use check_visa_requirement for the general entry rules of ${transitCountry}.`,
              },
      };
    }

    case "get_coverage_stats":
      return apiFetch("/stats", {}, apiKey, false);

    case "get_recent_changes":
      return getRecentChanges(args, apiKey);

    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}. Available: ${TOOLS.map((t) => t.name).join(", ")}.`,
      );
  }
}

/** What the tool says while the feed is off. No entries, and no ambiguity about why. */
export const CHANGES_UNAVAILABLE = {
  status: "unavailable" as const,
  changes: [] as unknown[],
  reason:
    "Orizn's visa policy-change feed is being rebuilt on verified official sources. The previous feed " +
    "reported internal data inconsistencies as policy changes, so it was switched off rather than left " +
    "to mislead.",
  do_not_conclude:
    "This is NOT evidence that no visa rules changed. Orizn simply has no verified change data to show. " +
    "Do not tell the user the rules are unchanged or stable.",
  instead:
    "Call check_visa_requirement or quick_visa_check for the current rule and the date it was last verified, " +
    "and point the user at the destination's official immigration authority for anything time-critical.",
};

async function getRecentChanges(
  args: Record<string, unknown>,
  apiKey: string | undefined,
): Promise<unknown> {
  const params: Record<string, string> = {};
  if (args.passport !== undefined && args.passport !== "") params.passport = validateISO3(args.passport, "passport");
  if (args.destination !== undefined && args.destination !== "") {
    params.destination = validateISO3(args.destination, "destination");
  }
  if (typeof args.since === "string" && args.since !== "") params.since = args.since;
  if (typeof args.limit === "number") params.limit = String(Math.min(Math.max(1, args.limit), 200));

  let raw: unknown;
  try {
    raw = await apiFetch("/changes", params, apiKey, false);
  } catch (err) {
    // 503 is the deliberate shutdown documented above — degrade, don't fail.
    // Anything else (bad key, plan gate, network) is the caller's real problem
    // and keeps its own message.
    if ((err as { httpStatus?: number })?.httpStatus === 503) return CHANGES_UNAVAILABLE;
    throw err;
  }

  // The feed is back. Only entries that name a source and a date may be shown —
  // the exact failure that got the feed shut off in the first place.
  const rows = Array.isArray((raw as { data?: unknown[] })?.data) ? (raw as { data: Record<string, unknown>[] }).data : [];
  const changes = rows.filter((r) => r.verified === true && r.source_name && r.detected_at);
  return {
    status: "ok" as const,
    changes,
    ...(changes.length < rows.length
      ? { withheld: rows.length - changes.length, withheld_reason: "unverified or missing a named source" }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Resource data
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES_RESOURCE = {
  note: "All 15 languages are available on every plan, free included.",
  languages: SUPPORTED_LANGUAGES.map((code) => {
    const names: Record<string, string> = {
      fr: "French", en: "English", es: "Spanish", pt: "Portuguese", de: "German",
      ja: "Japanese", ko: "Korean", zh: "Chinese", ru: "Russian", it: "Italian",
      ar: "Arabic", hi: "Hindi", th: "Thai", vi: "Vietnamese", tl: "Filipino",
    };
    return { code, name: names[code] ?? code };
  }),
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
    log("info", `No API key — quick_visa_check runs keyless, ${ANON_DAILY_LIMIT}/day`);
    process.stderr.write(
      "\n" +
      "  Orizn Visa MCP — no API key found, running in keyless mode.\n" +
      `  Working now:  quick_visa_check (${ANON_DAILY_LIMIT} checks/day) · get_coverage_stats · get_recent_changes\n` +
      "  Needs a key:  check_visa_requirement · compare_destinations · check_transit_visa\n" +
      "\n" +
      "  Free key, 10 seconds, no credit card:  " + KEY_URL + "\n" +
      "  100 requests/month · all 15 languages · documents, fees, transit rules\n" +
      "\n" +
      "  Then add it to your MCP config:  \"env\": { \"ORIZN_API_KEY\": \"orizn_visa_...\" }\n" +
      "  or start the server with:        npx orizn-visa-mcp --api-key orizn_visa_...\n" +
      "\n"
    );
  }

  const server = new Server(
    {
      name: "orizn-visa",
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  // ---- Tools: list --------------------------------------------------------

  // Sans clé, trois outils sur six répondent. Le client MCP ne le sait pas :
  // il voit six outils identiques et en appelle un qui échouera. On le dit dans
  // la description plutôt que de masquer l'outil — l'agent doit pouvoir
  // expliquer ce qui débloque le reste, pas découvrir un mur.
  const KEY_ONLY = new Set(["check_visa_requirement", "compare_destinations", "check_transit_visa"]);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) =>
      apiKey || !KEY_ONLY.has(tool.name)
        ? tool
        : {
            ...tool,
            description:
              `[needs a free API key — this call will fail without one] ${tool.description} ` +
              `Get one at https://visa.orizn.app/visa-api?source=mcp (100 requests/month, no card), ` +
              `then set ORIZN_API_KEY in the env block of the MCP config.`,
          },
    ),
  }));

  // ---- Tools: call --------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      const result = await callTool(name, args, apiKey);

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
        description: "The 15 language codes accepted by the `lang` parameter, on every plan including free.",
        mimeType: "application/json",
      },
    ],
  }));

  // ---- Resources: read ----------------------------------------------------

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "visa://supported-languages") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(SUPPORTED_LANGUAGES_RESOURCE, null, 2),
          },
        ],
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
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
  log("info", `Orizn Visa MCP server ${VERSION} started on stdio`);
}

// Only boot when run as the executable — importing this module (tests) must not
// start a server on stdio.
if (process.env.ORIZN_MCP_NO_MAIN !== "1") {
  main().catch((err) => {
    log("error", "Fatal startup error", { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
