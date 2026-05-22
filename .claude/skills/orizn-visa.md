---
name: orizn-visa
description: Check visa requirements for any passport-destination pair
---

# Orizn Visa Checker

When asked about visa requirements between countries:

1. Identify the passport country and destination country
2. Convert to ISO 3166-1 alpha-3 codes
3. Use the Orizn MCP server to get real data

## Setup

Add to your MCP config:

```json
{
  "mcpServers": {
    "orizn-visa": {
      "command": "npx",
      "args": ["-y", "orizn-visa-mcp"],
      "env": { "ORIZN_API_KEY": "YOUR_KEY" }
    }
  }
}
```

## Example prompts

- "Do I need a visa from France to Thailand?"
- "What documents do I need for US citizen visiting China?"
- "List all visa-free countries for Brazilian passport"
