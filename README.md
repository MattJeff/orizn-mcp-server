# Orizn Visa MCP Server

[![npm version](https://img.shields.io/npm/v/orizn-visa-mcp.svg)](https://www.npmjs.com/package/orizn-visa-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

> Give any AI agent instant access to visa requirements for **39,585 passport-destination pairs** in **15 languages**, with **32 data points per visa** — fees, processing times, photo specs, transit visas, embassies, overstay penalties, safety advisories, and more.

---

## Tools

| Tool | Auth | Description |
|------|------|-------------|
| `check_visa_requirement` | API key | Full visa details — documents, process, tips, transit, fees, processing days, photo specs, vaccinations, insurance, overstay penalties, embassies, safety, health, remote work, extensions, and more |
| `quick_visa_check` | API key | Fast yes/no visa check (visa-free / e-visa / required / on arrival / ETA / no admission) |
| `get_all_destinations` | Key (Pro) | All 199 destinations for any passport |
| `get_visa_changes` | Key (Starter) | Track recent visa policy changes |
| `check_transit_visa` | API key | Transit visa rules + free transit hours for top 50 layover hubs (DXB, IST, DOH, SIN, ...) |
| `get_coverage_stats` | Free | Database coverage statistics |

Each tool description tells the agent exactly **when** to call it (transit, overstay, photos, vaccinations, etc.), so models pick the right one without prompting tricks.

### What `check_visa_requirement` returns

Every full visa response includes up to **32 fields**:

- **Core:** `requirement`, `visa_free_days`, `description`, `documents_required`, `process`, `tips`, `country_info`, `verified`
- **Cost & timing:** `visa_fee` (single / multiple entry), `processing_days` (standard / express / rush), `best_apply_period`
- **Entry:** `passport_validity_months`, `entry_by_mode` (air / land / sea), `transit_visa` (per-hub rules)
- **Documents:** `photo_specs` (mm dimensions, background, glasses rules)
- **Health & safety:** `vaccinations_required`, `health_requirements`, `insurance_required`, `safety` (advisory level 1–4)
- **Penalties & warnings:** `overstay_penalty` (fine, ban, criminal), `dual_nationality_warnings`, `stamp_warnings`
- **Long-stay:** `remote_work_visa` (digital nomad), `extension_rules`, `minor_rules`
- **Embassies:** `embassy.your_embassy_at_destination` (emergencies) + `embassy.visa_application_embassy` (where to apply)
- **History:** `reciprocity_history` (past policy changes between the two countries)

Anything not relevant to a given pair is omitted (e.g. `remote_work_visa` only appears when a digital nomad visa exists).

---

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"],
      "env": {
        "ORIZN_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"],
      "env": {
        "ORIZN_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Codex Desktop

OpenAI Codex Desktop supports MCP natively. Add to your Codex MCP config:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"],
      "env": {
        "ORIZN_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Composio

[Composio](https://composio.dev) connects AI agents to 500+ tools via MCP. Use Orizn Visa through Composio's MCP support:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"],
      "env": {
        "ORIZN_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Any MCP Client

```bash
npx orizn-visa-mcp
```

Or with an API key:

```bash
npx orizn-visa-mcp --api-key YOUR_KEY
```

---

## Configuration

| Option | Description |
|--------|-------------|
| `ORIZN_API_KEY` env var | Set your API key via environment variable |
| `--api-key` CLI arg | Pass your API key as a command-line argument |

**Free tier** works without a key — you get access to `quick_visa_check` and `get_coverage_stats`.

Get your API key at **[visa.orizn.app](https://visa.orizn.app)**

---

## Examples

Just ask your AI agent in natural language:

**Basic checks**
- *"Do I need a visa to travel from France to Thailand?"*
- *"Show me all visa-free countries for a Brazilian passport."*
- *"What documents do I need as a US citizen visiting China?"*

**Layovers & transit**
- *"Do I need a transit visa if I'm Indian and connecting through Dubai?"*
- *"Can I leave the airport during a 12h layover in Istanbul on a Chinese passport?"*

**Cost & timing**
- *"How much does a Schengen visa cost for a Filipino passport holder?"*
- *"What's the processing time for a US tourist visa right now?"*

**Health & insurance**
- *"Which vaccinations do I need to enter Brazil with a French passport?"*
- *"What's the minimum travel insurance coverage required for Schengen?"*

**Documents & photos**
- *"What are the photo specs for a Chinese visa application?"*
- *"How long does my passport need to be valid to enter Vietnam?"*

**Penalties & rules**
- *"What's the fine if I overstay my Thai visa by 3 days?"*
- *"Are there entry restrictions if my passport has an Israeli stamp?"*

**Long-stay & remote work**
- *"Does Portugal have a digital nomad visa, and what does it cost?"*
- *"Can I extend my Thai tourist visa inside Thailand?"*

**Recent changes**
- *"Have any visa policies changed recently for Indian passport holders?"*

---

## Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `fr` | French |
| `es` | Spanish |
| `de` | German |
| `it` | Italian |
| `pt` | Portuguese |
| `ru` | Russian |
| `zh` | Chinese |
| `ja` | Japanese |
| `ko` | Korean |
| `ar` | Arabic |
| `hi` | Hindi |
| `th` | Thai |
| `vi` | Vietnamese |
| `tl` | Filipino |

---

## Visa Types

| Type | Description |
|------|-------------|
| `visa_free` | No visa required |
| `visa_required` | Visa must be obtained before travel |
| `e_visa` | Electronic visa available online |
| `visa_on_arrival` | Visa issued at the port of entry |
| `eta` | Electronic Travel Authorization |
| `no_admission` | Entry not permitted |

---

## Pricing

| Plan | Price | Requests/month |
|------|-------|----------------|
| **Free** | $0 | Limited |
| **Starter** | $49/mo | — |
| **Pro** | $199/mo | — |
| **Business** | $699/mo | — |
| **Enterprise** | Custom | Unlimited |

See full plan details at **[visa.orizn.app](https://visa.orizn.app)**

---

## Links

- **API Documentation** — [visa.orizn.app/visa-api/dashboard/docs](https://visa.orizn.app/visa-api/dashboard/docs)
- **GitHub** — [github.com/MattJeff/orizn-mcp-server](https://github.com/MattJeff/orizn-mcp-server)
- **Support** — [api@orizn.app](mailto:api@orizn.app)

---

## Feedback

Building a travel agent or visa tool? We'd love to hear what you're building.

→ **api@orizn.app** — Feature requests, partnerships, and questions welcome.

## License

MIT
