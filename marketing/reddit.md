# Reddit Launch Posts — Orizn Visa MCP Server

---

## Post 1 — r/artificial

**Title:** Built the first MCP server for visa requirements — any AI agent can now check 40K passport-destination pairs in 15 languages

**Body:**

I've been working on something at the intersection of AI tooling and travel data, and wanted to share it here since this community thinks a lot about how we make AI agents actually useful.

**The problem:** LLMs hallucinate visa requirements. Ask Claude or GPT whether you need a visa to visit Vietnam with a US passport and you'll get a confident, detailed — and sometimes wrong — answer. Visa rules change constantly, vary by passport, and have edge cases (transit visas, e-visas, visa on arrival) that trip up even humans.

**The solution:** I built an MCP server that gives any AI agent access to real, sourced visa data covering 199 passports x 199 destinations (39,585 pairs), pulled from 136 official government sources and kept up to date.

**What's MCP?** Model Context Protocol is an open standard (originally from Anthropic) that lets AI agents call external tools in a standardized way — think of it like USB-C for AI integrations. Instead of every app building its own plugin system, MCP gives you one protocol that works across Claude Desktop, Cursor, Windsurf, and any other MCP-compatible client.

**How it works:** Install the server via npm, add it to your MCP client config, and your AI assistant gains access to three tools:

- `check_visa` — get full visa requirements for any passport-destination pair
- `compare_visas` — compare requirements across multiple destinations or passports at once
- `get_visa_summary` — quick yes/no overview with key details

All responses include the original government source URL, so the agent can cite where the info comes from. Responses are available in 15 languages.

The server is written in TypeScript, runs locally via stdio, and makes standard HTTPS calls to the Orizn Visa API under the hood. No API key needed for basic usage.

I think visa data is a near-perfect MCP use case: it's structured, changes frequently, has high stakes if wrong, and is something people naturally ask AI assistants about. Curious what other domains you think would benefit from this kind of tool-augmented approach?

**Links:**
- GitHub: https://github.com/MattJeff/orizn-mcp-server
- API docs: https://visa.orizn.app
- npm: https://www.npmjs.com/package/orizn-visa-mcp

---

## Post 2 — r/digitalnomad

**Title:** I built an API that lets AI assistants check visa requirements for any country — 199 passports x 199 destinations

**Body:**

Fellow nomads — I'm currently based in Vietnam and if you're anything like me, you've spent way too many hours digging through embassy websites, cross-referencing Timatic data, and scrolling through year-old Reddit threads trying to figure out visa situations before your next move.

The information is out there, but it's scattered across hundreds of government websites, often contradictory, sometimes outdated, and almost never in a format you can quickly compare. "Can I do 90 days in Thailand, then hop to Malaysia, then come back?" shouldn't require an hour of research.

So I built something to fix this. The Orizn Visa API covers 39,585 passport-destination combinations, sourced from 136 official government sources. Every response links back to the original source so you can verify it yourself.

But the part I'm most excited about: I wrapped it in an MCP server, which means if you use Claude Desktop, Cursor, or any MCP-compatible AI tool, you can just ask in plain language:

- "Do I need a visa for Indonesia with a French passport?"
- "Compare visa requirements for Colombia, Mexico, and Portugal for UK passport holders"
- "What's the maximum stay I can get in Thailand without a visa?"

And you'll get accurate, sourced answers — not the hallucinated guesses LLMs usually give for visa questions.

It supports 15 languages, so if you're traveling with a partner who speaks a different language, they can query in their own language and get localized results.

There's a free tier so you can try it without committing to anything. I built this because I needed it myself, and I figured others in this community would find it useful too.

Would love to hear what features would make this more useful for your workflow. I'm thinking about adding things like "nomad route planning" where you could ask for optimal visa-hop sequences.

**Links:**
- GitHub: https://github.com/MattJeff/orizn-mcp-server
- API docs: https://visa.orizn.app
- npm: https://www.npmjs.com/package/orizn-visa-mcp

---

## Post 3 — r/SideProject

**Title:** From API to MCP server: making visa data accessible to every AI agent

**Body:**

Wanted to share the journey of a side project that recently hit a milestone I'm pretty happy about.

**Where it started:** I kept running into the same problem — visa requirements are scattered across hundreds of embassy websites, often in different formats, sometimes contradictory. I started building the Orizn Visa API to aggregate all of this into one clean, structured source. Today it covers 39,585 passport-destination pairs from 136 official government sources in 15 languages.

**The pivot moment:** I noticed something interesting in my API logs. People weren't just building travel apps on top of it — they were trying to pipe the data into AI assistants. And when I tested asking LLMs about visa requirements without the API, they hallucinated confidently. A French passport holder being told they need a visa for Japan (they don't). An Indian passport holder being told Thailand is visa-free (it's not, though there's a visa on arrival). This is dangerous misinformation for travelers.

**The build:** I decided to create an MCP (Model Context Protocol) server — an open standard that lets AI agents call external tools. The server is written in TypeScript, published on npm, and takes about 2 minutes to set up. It exposes three tools to any MCP-compatible AI client: single visa checks, multi-destination comparisons, and quick summaries. Every response includes the government source URL.

**Some technical decisions:**
- TypeScript for broad compatibility and strong typing on the tool schemas
- stdio transport (runs locally, no separate server process to manage)
- Structured tool descriptions so LLMs understand when and how to call each tool
- No API key required for basic usage to minimize friction

**Numbers so far:** 39,585 visa pairs, 136 government sources, 15 languages, 3 MCP tools. The API is live, the MCP server is published on npm, and you can have it running in Claude Desktop or Cursor in under 2 minutes.

**What's next:** Expanding to work permit data, adding real-time policy change alerts, and exploring integrations with travel planning agents.

Would love feedback from other builders here. If you've shipped an MCP server, I'd especially like to hear what you learned.

**Links:**
- GitHub: https://github.com/MattJeff/orizn-mcp-server
- API docs: https://visa.orizn.app
- npm: https://www.npmjs.com/package/orizn-visa-mcp
