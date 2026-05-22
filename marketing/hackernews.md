**Show HN: I built the first MCP server for visa requirements -- any AI agent can now check 40K pairs in 15 languages**

If you've ever asked Claude or ChatGPT "do I need a visa to go to Thailand?", you've probably gotten a confident answer that was either outdated or flat-out wrong. AI agents hallucinate visa requirements because there's simply no structured, reliable data source they can tap into. Visa rules change constantly -- new e-visa programs launch, bilateral agreements shift, COVID-era policies get rolled back -- and LLM training data can't keep up. For something as consequential as whether you'll be allowed into a country, "probably correct based on 2023 data" isn't good enough.

So I built an MCP server that connects any AI agent directly to the Orizn Visa API. It covers 39,585 passport-destination pairs across 15 languages, verified against 136 government sources. It works with Claude Desktop, Cursor, Windsurf, or any MCP-compatible client. There's a free tier with no API key required for basic visa checks, so you can try it out immediately. When an agent needs to answer a visa question, it calls the server, gets structured data back (visa type, validity, required documents, processing times), and gives the user an accurate answer instead of a guess.

Technically, MCP (Model Context Protocol) is Anthropic's open standard for giving AI agents access to external tools and data sources. The server exposes 5 tools: check visa requirements for a specific pair, list all destinations accessible from a passport, get detailed visa information, search countries, and check supported languages. Install is one line: `npx orizn-visa-mcp`. Under the hood, the API classifies every pair into one of 6 visa categories -- visa-free, visa required, e-visa, visa on arrival, ETA (electronic travel authorization), and no admission -- with structured metadata for each.

The goal is to become the default visa data layer for the agentic era. The server is published on npm and listed on Smithery and other MCP registries. I'm actively maintaining the data and expanding coverage. Would love feedback from the HN community -- both on the MCP implementation and on the data coverage. If you find a pair that's wrong, I want to know.

---

- GitHub: https://github.com/MattJeff/orizn-mcp-server
- npm: https://www.npmjs.com/package/orizn-visa-mcp
- API: https://visa.orizn.app
