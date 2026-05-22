# Orizn Visa MCP Server -- Twitter/X Launch Thread

Mentions: @AnthropicAI @OpenAI @LangChainAI

---

## Tweet 1 -- Hook + Result (extended format)

> I just gave every AI agent in the world the ability to check visa requirements.
>
> Built the first MCP server for visa data:
> - 39,585 passport-destination pairs
> - 15 languages
> - 136 government sources
> - Works with Claude, GPT, Cursor, any MCP client
>
> One line install: npx orizn-visa-mcp

**Character count: ~310 -- uses Twitter/X extended tweet format (OK for first tweet in thread)**

---

## Tweet 2 -- The Problem

> Ask your AI "do I need a visa for Thailand?" and watch it hallucinate.
>
> Training data is outdated. No structured visa database exists for agents.
>
> Until now.

**Character count: ~163 -- UNDER 280**

---

## Tweet 3 -- Demo

> What it looks like in practice:
>
> Me: "Do I need a visa to travel from France to Japan?"
> Claude calls check_visa_requirement ->
> visa_free, 90 days, documents list, process steps, travel tips.
>
> Real data. Real sources. No hallucination.
>
> [screenshot / GIF placeholder]

**Character count: ~270 -- UNDER 280**

---

## Tweet 4 -- How to Install

> Add this to your Claude Desktop config:
>
> ```json
> {
>   "mcpServers": {
>     "orizn-visa": {
>       "command": "npx",
>       "args": ["-y", "orizn-visa-mcp"]
>     }
>   }
> }
> ```
>
> That's it. Free tier, no API key needed for basic checks.

**Character count: ~220 (code blocks are counted differently on X) -- UNDER 280**

Note: Twitter does not render code blocks natively. Consider posting the JSON as a screenshot/image instead, with the text:

> Add this to your Claude Desktop config and you're done. Free tier, no API key needed.
>
> [screenshot of JSON config]

**Alt version character count: ~105 -- UNDER 280**

---

## Tweet 5 -- CTA

> GitHub: github.com/anthropic/orizn-visa-mcp
> npm: npmjs.com/package/orizn-visa-mcp
> API docs: docs.orizn.com
>
> @AnthropicAI @modelaboratory

**Character count: ~150 -- UNDER 280**

**Alt version (more engagement):**

> Ship your own travel AI agent this weekend.
>
> GitHub: github.com/anthropic/orizn-visa-mcp
> npm: npmjs.com/package/orizn-visa-mcp
> Docs: docs.orizn.com
>
> @AnthropicAI @modelaboratory

**Character count: ~185 -- UNDER 280**

---

## Notes

- **Tweet 1** uses the extended format (over 280 chars). Twitter/X allows longer posts now (up to 4,000 chars for premium). If posting from a free account, split into two tweets or trim to:

> I built the first MCP server for visa data.
>
> 39,585 passport-destination pairs. 15 languages. 136 government sources. Works with Claude, GPT, Cursor, any MCP client.
>
> npx orizn-visa-mcp

**Trimmed version: ~198 chars -- UNDER 280**

- **Tweet 3**: attach a screenshot or GIF of Claude Desktop showing the tool call and response. High impact visual.
- **Tweet 4**: post the JSON config as an image, not inline code. Twitter mangles formatting.
- Replace placeholder URLs with actual links before posting.
- Post during US morning hours (9-11am ET) for max reach on dev Twitter.
