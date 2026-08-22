# Orizn Visa API MCP Server

Orizn Visa API MCP Server is a Model Context Protocol (MCP) server that gives an AI assistant the visa and entry requirements for any passport/destination pair, answered in 15 languages.

Coverage grows: rather than print a number here that goes stale, the `get_coverage_stats` tool reads it live from the API (also public at <https://visa.orizn.app/api/v1/visa/stats>).

[![npm version](https://img.shields.io/npm/v/orizn-visa-mcp.svg)](https://www.npmjs.com/package/orizn-visa-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

It answers questions like "do I need a visa to go from France to Japan", "what documents does a US citizen need for China", "can I leave the airport during a layover in Istanbul on an Indian passport" — with data, not a guess.

## Compatibility

The server speaks MCP over **stdio** and runs on **Node.js 18 or later**. It works with any MCP client that can launch a stdio server, including Claude Desktop, Claude Code and Cursor. The configuration block below is the same for all of them.

## Install

```bash
npx orizn-visa-mcp
```

Nothing to build, nothing to clone. Add it to your MCP client config:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"]
    }
  }
}
```

Restart the client, then ask: *"Do I need a visa to go from France to Japan?"* — **that works with no API key**, 10 checks a day.

For everything else (documents, fees, processing times, transit rules, 15 languages), add a free key:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"],
      "env": {
        "ORIZN_API_KEY": "orizn_visa_..."
      }
    }
  }
}
```

The key can also be passed as an argument, which takes precedence over the environment variable:

```bash
npx orizn-visa-mcp --api-key orizn_visa_...
```

## Example questions

- *"Do I need a visa to travel from France to Thailand?"*
- *"What documents do I need as a US citizen visiting China?"*
- *"Compare Thailand, Vietnam and Indonesia for a Brazilian passport."*
- *"Can I leave the airport during a 12h layover in Istanbul on a Chinese passport?"*
- *"How much does a Schengen visa cost for a Filipino passport holder?"*
- *"Which vaccinations do I need to enter Brazil with a French passport?"*
- *"What's the fine if I overstay my Thai visa by 3 days?"*
- *"Does Portugal have a digital nomad visa, and what does it cost?"*
- *"Réponds en français : ai-je besoin d'un visa pour le Japon avec un passeport marocain ?"*

## Tools

| Tool | Arguments | What it returns | Plan |
|------|-----------|-----------------|------|
| `check_visa_requirement` | `passport`, `destination`, `lang` | Full entry requirements for one passport into one destination: requirement type, days allowed, documents, application steps, fees, processing times, passport validity, photo specs, vaccinations, insurance, safety advisory, overstay penalties, entry by air/land/sea, remote-work visa, extension and minor rules, embassies. | Any key |
| `quick_visa_check` | `passport`, `destination` | One line: the requirement code, the number of visa-free days, and the date the pair was last verified. No documents, no fees, no translation. | **None** — 10/day keyless, unlimited with any key |
| `compare_destinations` | `passport`, `destinations` (1–25), `lang` | Up to 25 destinations for one passport side by side: requirement, visa-free days, description, passport validity, fee, safety, health, vaccinations, insurance, entry by mode, remote-work visa. Each destination returned counts as one request. | Hobby or above |
| `check_transit_visa` | `passport`, `transit_country`, `lang` | Layover rules only: whether the traveller may stay airside or leave the airport while connecting, and how many free transit hours the main hubs grant. | Hobby or above |
| `get_coverage_stats` | none | Size of the database: pairs, passports, destinations, translations, languages, and the distribution of requirement types. Says nothing about a specific pair. | None |
| `get_recent_changes` | `passport`, `destination`, `since`, `limit` (all optional) | Visa rules that changed recently, with the source that reported them and the date. **The feed is currently off** — see below. | None |

Country codes are **ISO 3166-1 alpha-3** (`FRA`, `JPN`, `USA`), not alpha-2.

`requirement` is one of `visa_free`, `visa_required`, `e_visa`, `visa_on_arrival`, `eta`, `no_admission`, plus the rarer `partial_restrictions`, `admission_refused`, `not_applicable` and `special`.

### Resource

`visa://supported-languages` — the 15 codes accepted by `lang`, available on every plan including free: `en` `fr` `es` `pt` `de` `ja` `ko` `zh` `ru` `it` `ar` `hi` `th` `vi` `tl`.

### `get_recent_changes` returns nothing on purpose

Orizn's policy-change feed is switched off. It was serving inconsistencies detected between two internal Orizn tables as if they were official policy changes, so it now returns HTTP 503 and this tool degrades to:

```json
{ "status": "unavailable", "changes": [], "do_not_conclude": "This is NOT evidence that no visa rules changed..." }
```

The tool is shipped in this state deliberately: an empty, clearly-labelled answer is the honest one, and the tool starts returning real entries the day the feed runs on verified official sources — at which point entries without a named source and a date are withheld rather than shown.

## Authentication and free tier

`quick_visa_check`, `get_coverage_stats` and `get_recent_changes` work with **no API key at all**. Keyless `quick_visa_check` is capped at **10 checks per day** — the same allowance visa.orizn.app gives an anonymous visitor. Past that the tool says so and points at the free key rather than failing silently. The cap is per running server process and resets at 00:00 UTC.

The other three tools need an API key, sent as the `x-api-key` header to `https://visa.orizn.app/api/v1/visa`.

Get a free one at **[visa.orizn.app/visa-api](https://visa.orizn.app/visa-api)** — no credit card. The free tier is **50 requests/month** (5 until you confirm your email address) and includes the core fields and all 15 languages. On the free plan the deeper fields — fees, processing days, photo specs, vaccinations, insurance, transit visas, entry by mode, overstay penalties, remote-work visas, embassies — come back as an `{"upgrade": "..."}` placeholder, and `compare_destinations` and `check_transit_visa` are gated.

**Hobby is $9/month for 10,000 requests** and unlocks all of it: [upgrade](https://visa.orizn.app/visa-api/login?next=%2Fvisa-api%2Fdashboard%2Fbilling%3Fplan%3Dhobby). Higher-volume plans are listed on the pricing page.

Pass the key in the `env` block of the MCP config — MCP clients do not inherit your shell environment, so exporting `ORIZN_API_KEY` in a terminal is not enough.

Check a key without any MCP client:

```bash
curl -H "x-api-key: $ORIZN_API_KEY" \
  "https://visa.orizn.app/api/v1/visa/check?passport=FRA&destination=JPN"
```

```json
{ "passport": "FRA", "destination": "JPN", "requirement": "visa_free", "visa_free_days": 90 }
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| *"No Orizn API key"* | Expected on the key-only tools. `quick_visa_check` still answers. To lift it, put the key in the `env` block of the config file — not your shell — then restart the client |
| *"Keyless daily limit reached"* | The 10 free checks for today are spent. A free key removes the cap |
| HTTP 403, *"check ORIZN_API_KEY for typos"* | Key is wrong, revoked, or has whitespace |
| HTTP 403, *"requires Hobby plan or above"* | Right key, wrong plan — this tool is paid |
| HTTP 429 | Monthly quota spent |
| HTTP 404 on a real country | Use alpha-3 codes (`FRA`, `JPN`), not alpha-2 (`FR`, `JP`) |
| Nothing works at all | Call `get_coverage_stats` — it needs no key. If that fails too, it is the network |
| `get_recent_changes` returns an empty list | Expected — the feed is being rebuilt. It does not mean the rules are unchanged |

## Links

- **Website** — [visa.orizn.app](https://visa.orizn.app)
- **API documentation** — [visa.orizn.app/visa-api/dashboard/docs](https://visa.orizn.app/visa-api/dashboard/docs)
- **Get a free key** — [visa.orizn.app/visa-api](https://visa.orizn.app/visa-api)
- **GitHub** — [github.com/MattJeff/orizn-mcp-server](https://github.com/MattJeff/orizn-mcp-server)
- **Support** — [api@orizn.app](mailto:api@orizn.app)

## License

MIT
