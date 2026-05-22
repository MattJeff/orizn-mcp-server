# Orizn Visa MCP Server

[![npm version](https://img.shields.io/npm/v/orizn-visa-mcp.svg)](https://www.npmjs.com/package/orizn-visa-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io)

> Give any AI agent instant access to visa requirements for 39,585 passport-destination pairs in 15 languages.

---

## Features

| Tool | Description |
|------|-------------|
| `check_visa_requirement` | Full visa details with documents, process & tips |
| `quick_visa_check` | Fast yes/no visa check (no API key needed) |
| `get_all_destinations` | All 199 destinations for any passport |
| `get_visa_changes` | Track recent visa policy changes |
| `get_coverage_stats` | Database coverage statistics |

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

- *"Do I need a visa to travel from France to Thailand?"*
- *"Show me all visa-free countries for a Brazilian passport."*
- *"What documents do I need as a US citizen visiting China?"*
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
| `nl` | Dutch |
| `ru` | Russian |
| `zh` | Chinese |
| `ja` | Japanese |
| `ko` | Korean |
| `ar` | Arabic |
| `hi` | Hindi |
| `tr` | Turkish |
| `vi` | Vietnamese |

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

- **API Documentation** — [visa.orizn.app](https://visa.orizn.app)
- **GitHub** — [github.com/MattJeff/orizn-visa-api](https://github.com/MattJeff/orizn-visa-api)
- **Support** — [visa.orizn.app](https://visa.orizn.app)

---

## License

MIT
