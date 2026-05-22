# Orizn Visa MCP Server -- Registry Submission Guide

Practical, step-by-step instructions for listing `orizn-visa-mcp` on every major MCP registry and directory.

**Server details used throughout this guide:**

- **Package name:** `orizn-visa-mcp`
- **GitHub repo:** `https://github.com/MattJeff/orizn-mcp-server`
- **Homepage:** `https://visa.orizn.app`
- **npm command:** `npx -y orizn-visa-mcp`
- **Transport:** stdio
- **Category:** Travel / Data

---

## Table of Contents

1. [npm Publish](#1-npm-publish)
2. [Official MCP Registry](#2-official-mcp-registry)
3. [Smithery](#3-smithery)
4. [mcp.so](#4-mcpso)
5. [Glama](#5-glama)
6. [PulseMCP](#6-pulsemcp)
7. [awesome-mcp-servers (GitHub)](#7-awesome-mcp-servers-github)
8. [mcpservers.org](#8-mcpserversorg)
9. [Pre-Submission Checklist](#9-pre-submission-checklist)
10. [Submission Tracker](#10-submission-tracker)

---

## 1. npm Publish

> Publish first -- most other registries reference the npm package.

- **URL:** https://www.npmjs.com/package/orizn-visa-mcp
- **Submission method:** CLI (`npm publish`)
- **Estimated time:** Instant (package is live within seconds)

### Prerequisites

- Node.js >= 18 installed
- An npm account (`npm adduser` or `npm login`)
- The package name `orizn-visa-mcp` must be available (or you own it)

### Steps

**1.1 Verify the shebang line**

The entry point (`src/index.ts`) must start with:

```
#!/usr/bin/env node
```

This is required for `npx orizn-visa-mcp` to work. Without it, the OS does not know to run the file with Node.js.

**1.2 Verify `package.json` fields**

Confirm the following fields are present and correct:

```json
{
  "name": "orizn-visa-mcp",
  "version": "1.0.0",
  "bin": {
    "orizn-visa-mcp": "dist/index.js"
  },
  "type": "module",
  "files": ["dist"],
  "keywords": [
    "mcp", "visa", "travel", "passport", "ai-agent", "claude",
    "gpt", "model-context-protocol", "immigration", "country", "orizn"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/MattJeff/orizn-mcp-server"
  },
  "homepage": "https://visa.orizn.app",
  "license": "MIT",
  "engines": { "node": ">=18" }
}
```

**1.3 Build and publish**

```bash
# Build TypeScript
npm run build

# Verify the shebang is in the dist output
head -1 dist/index.js
# Should show: #!/usr/bin/env node

# Dry run to check what will be published
npm pack --dry-run

# Publish (first time)
npm publish

# Or, if using a scoped package:
# npm publish --access public
```

**1.4 Verify it works**

```bash
npx -y orizn-visa-mcp
```

**1.5 For subsequent versions**

```bash
npm version patch   # or minor / major
npm run build
npm publish
```

### Important Notes

- If the shebang is missing from `dist/index.js` after build, add a build step to prepend it. You can add this to the build script: `echo '#!/usr/bin/env node' | cat - dist/index.js > temp && mv temp dist/index.js`
- The `files` field ensures only `dist/` is published (no source code, no `node_modules`)
- The `prepublishOnly` script already runs `npm run build` before publish

---

## 2. Official MCP Registry

> The authoritative registry maintained by the MCP project. This is the most important listing.

- **URL:** https://registry.modelcontextprotocol.io
- **GitHub:** https://github.com/modelcontextprotocol/registry
- **Submission method:** CLI tool (`mcp-publisher`) with GitHub authentication
- **Estimated review time:** Automated (publish is instant after auth; discovery indexing may take hours)

### Prerequisites

- GitHub account that owns or has push access to `MattJeff/orizn-mcp-server`
- The package must be published on npm first

### Steps

**2.1 Create `server.json` in the repo root**

```json
{
  "$schema": "https://registry.modelcontextprotocol.io/schemas/server.json",
  "name": "io.github.mattjeff/orizn-visa-mcp",
  "description": "Visa requirements for 39,585 passport-destination pairs in 15 languages. Check visa types, required documents, and travel tips for any country combination.",
  "repository": {
    "url": "https://github.com/MattJeff/orizn-mcp-server",
    "source": "github"
  },
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "registryBaseUrl": "https://registry.npmjs.org",
      "identifier": "orizn-visa-mcp",
      "version": "1.0.0",
      "transport": {
        "type": "stdio"
      },
      "environmentVariables": [
        {
          "name": "ORIZN_API_KEY",
          "description": "API key for premium features (optional -- free tier works without key)",
          "isRequired": false
        }
      ]
    }
  ]
}
```

**2.2 Install and use the publisher CLI**

```bash
# Clone the registry repo to get the CLI
git clone https://github.com/modelcontextprotocol/registry.git /tmp/mcp-registry
cd /tmp/mcp-registry
make publisher

# Authenticate with GitHub
./bin/mcp-publisher login github

# Validate your server.json (dry run)
./bin/mcp-publisher publish --dry-run --file=/path/to/orizn-mcp-server/server.json

# Publish for real
./bin/mcp-publisher publish --file=/path/to/orizn-mcp-server/server.json
```

Alternatively, you can use `mcp-publisher init` to generate a starter `server.json` and edit it.

**2.3 Verify**

Visit `https://registry.modelcontextprotocol.io/servers/io.github.mattjeff/orizn-visa-mcp` to confirm your server appears.

### Notes

- The `name` field uses reverse-domain notation: `io.github.<owner>/<repo-or-package>`
- GitHub OIDC authentication is supported, so CI/CD pipelines can publish without storing secrets
- Re-publish after every version bump to keep the registry in sync

---

## 3. Smithery

> Large MCP marketplace. Good discoverability for end users.

- **URL:** https://smithery.ai
- **Submission method:** CLI (`smithery mcp publish`) or website
- **Estimated review time:** Near-instant after publish

### Prerequisites

- A Smithery.ai account and API key (sign up at https://smithery.ai)
- The `smithery.yaml` file in the repo root (already present)

### Steps

**3.1 Verify `smithery.yaml`**

The file already exists at the repo root with the correct configuration:

```yaml
name: orizn-visa
description: "Visa requirements for 39,585 passport-destination pairs in 15 languages..."
category: Travel
tags:
  - visa
  - travel
  - passport
  - immigration
  - multilingual
  - country-data
icon: "🌍"
startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      apiKey:
        type: string
        description: "Orizn API key for premium features (free tier works without key)"
    required: []
  commandFunction: |
    (config) => ({
      command: "npx",
      args: ["-y", "orizn-visa-mcp"],
      env: config.apiKey ? { ORIZN_API_KEY: config.apiKey } : {}
    })
```

**3.2 Publish via CLI**

```bash
# Install the Smithery CLI
npm install -g @smithery/cli

# Authenticate
smithery login

# Publish (from the repo root, or specify URL)
smithery mcp publish . -n orizn/orizn-visa

# Alternative: publish from a remote URL
# smithery mcp publish https://github.com/MattJeff/orizn-mcp-server -n orizn/orizn-visa
```

**3.3 Verify**

Visit `https://smithery.ai/server/orizn/orizn-visa` to confirm the listing.

### Category and Tags

- **Category:** Travel
- **Tags:** visa, travel, passport, immigration, multilingual, country-data
- These are defined in `smithery.yaml` and will be picked up automatically

---

## 4. mcp.so

> Community-driven MCP marketplace with 20,000+ servers. GitHub-issue-based submission.

- **URL:** https://mcp.so
- **GitHub repo:** https://github.com/chatmcp/mcpso
- **Submission method:** GitHub issue
- **Estimated review time:** 1-7 days (manual review)

### Steps

**4.1 Open a GitHub issue**

Go to: https://github.com/chatmcp/mcpso/issues/new

**4.2 Fill in the issue**

Use a title like:

```
[Submit] Orizn Visa MCP Server
```

Body:

```markdown
**Server Name:** Orizn Visa MCP Server
**GitHub URL:** https://github.com/MattJeff/orizn-mcp-server
**npm Package:** https://www.npmjs.com/package/orizn-visa-mcp
**Homepage:** https://visa.orizn.app
**Category:** Travel / Data

**Description:**
Visa requirements for 39,585 passport-destination pairs in 15 languages. 
Check visa types, required documents, and travel tips for any country combination.

**Install command:**
npx -y orizn-visa-mcp
```

**4.3 Ensure README quality**

mcp.so indexes content from your GitHub README. Make sure it includes:

- Clear server description
- List of available tools with descriptions
- Installation instructions (npx command)
- Usage examples
- API response format

---

## 5. Glama

> MCP registry with quality scoring. Scores are visible publicly and affect discoverability.

- **URL:** https://glama.ai/mcp/servers
- **Submission method:** Auto-indexed from GitHub + manual claim via `glama.json`
- **Estimated review time:** Auto-indexed (hours); claim is instant

### How Glama Works

Glama auto-discovers public MCP servers from GitHub. Your server may already be indexed. To claim ownership and unlock admin features, you add a `glama.json` file.

### Steps

**5.1 Check if already indexed**

Search for your server at: https://glama.ai/mcp/servers?query=orizn

**5.2 Create `glama.json` in the repo root**

```json
{
  "maintainers": [
    {
      "github": "MattJeff"
    }
  ]
}
```

**5.3 Claim ownership**

1. Go to https://glama.ai and sign in with GitHub
2. Search for your server
3. Click "Claim" on the server page
4. Glama will verify the `glama.json` in your repo
5. Once claimed, you can edit the server name, description, and other attributes

**5.4 (Optional) Create a Glama Release**

For deeper integration (security checks, hosted deployment):

1. Go to the server's admin/Dockerfile page on Glama
2. Configure the build spec
3. Click "Deploy" and wait for the build test
4. Click "Make Release", enter a version, and publish

### Scoring System

Glama scores servers automatically on a scale of A to F:

- **Tool Definition Quality (70%):** clarity, usage guidelines, parameter semantics, conciseness
- **Server Coherence (30%):** disambiguation between tools, naming consistency, completeness

**Target: Score B or above (>= 3.0)**

To maximize your score:

- Write clear, detailed tool descriptions
- Include usage guidelines in tool descriptions
- Use descriptive parameter names with good JSON Schema descriptions
- Keep tool count appropriate (not too many, not too few)
- Ensure tools are clearly distinguishable from each other

---

## 6. PulseMCP

> Curated MCP directory with 15,000+ servers. Newsletter and community features.

- **URL:** https://www.pulsemcp.com/servers
- **Submission method:** Auto-ingested from Official MCP Registry (weekly) OR direct submit
- **Estimated review time:** Automatic if in Official Registry; otherwise 1-2 weeks

### Steps

**6.1 Primary method: Publish to the Official MCP Registry first**

PulseMCP auto-ingests from the Official MCP Registry on a weekly cadence. If you completed [Step 2](#2-official-mcp-registry), your server will appear on PulseMCP automatically within a week. No separate submission is needed.

**6.2 Alternative: Direct submission**

If you want to appear sooner or if auto-ingestion has not picked you up:

1. Visit https://www.pulsemcp.com/servers
2. Look for a "Submit" button/link on the servers page
3. Provide your GitHub repo URL, npm package name, and description

**6.3 For partnership/featured placement**

Contact: info@pulsemcp.com

---

## 7. awesome-mcp-servers (GitHub)

> The most-starred community list. High SEO value and developer trust.

### 7a. punkpeye/awesome-mcp-servers (87K+ stars)

- **URL:** https://github.com/punkpeye/awesome-mcp-servers
- **Submission method:** Pull Request
- **Estimated review time:** 1-14 days

#### Steps

**Fork and clone:**

```bash
git clone https://github.com/<your-fork>/awesome-mcp-servers.git
cd awesome-mcp-servers
```

**Edit `README.md`:**

Find the appropriate category section (look for "Travel" or "Data" or similar). Add an entry in alphabetical order within that section:

```markdown
- [Orizn Visa](https://github.com/MattJeff/orizn-mcp-server) - Visa requirements for 39,585 passport-destination pairs in 15 languages. Check visa types, required documents, and travel tips.
```

**Commit and open a PR:**

```bash
git checkout -b add-orizn-visa
git add README.md
git commit -m "Add Orizn Visa MCP server"
git push origin add-orizn-visa
```

Then open a PR on GitHub. Keep the PR description brief:

```
Adding Orizn Visa MCP server under the Travel/Data category.

- Visa requirements for 39,585 passport-destination pairs
- 15 languages supported
- npm: npx -y orizn-visa-mcp
```

**Contributing guidelines:** Read https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md before submitting.


### 7b. appcypher/awesome-mcp-servers

- **URL:** https://github.com/appcypher/awesome-mcp-servers
- **Submission method:** Pull Request
- **Estimated review time:** 1-14 days

Same PR-based process as above. Look for a "Travel & Transportation" or "Data" category. Follow the same format:

```markdown
- [Orizn Visa](https://github.com/MattJeff/orizn-mcp-server) - Visa requirements for 39,585+ passport-destination combinations in 15 languages.
```

### 7c. wong2/awesome-mcp-servers

- **URL:** https://github.com/wong2/awesome-mcp-servers
- **Submission method:** Submit via https://mcpservers.org/submit (does NOT accept direct PRs)

See [Section 8](#8-mcpserversorg) below.

---

## 8. mcpservers.org

> Web directory linked to wong2/awesome-mcp-servers.

- **URL:** https://mcpservers.org
- **Submission URL:** https://mcpservers.org/submit
- **Submission method:** Web form
- **Estimated review time:** 1-7 days

### Steps

1. Go to https://mcpservers.org/submit
2. Fill in the form with:
   - **Server name:** Orizn Visa MCP Server
   - **GitHub URL:** https://github.com/MattJeff/orizn-mcp-server
   - **Description:** Visa requirements for 39,585 passport-destination pairs in 15 languages. Check visa types, required documents, and travel tips for any country combination.
   - **Category:** Travel / Data
3. Submit and wait for review

---

## 9. Pre-Submission Checklist

Run through this before submitting to any registry:

- [ ] **npm published:** `npm view orizn-visa-mcp` returns package info
- [ ] **npx works:** `npx -y orizn-visa-mcp` starts the server without errors
- [ ] **Shebang present:** `head -1 dist/index.js` shows `#!/usr/bin/env node`
- [ ] **README is complete:** description, tools list, install command, usage examples
- [ ] **LICENSE file present:** MIT license in repo root
- [ ] **server.json created:** for the Official MCP Registry
- [ ] **smithery.yaml verified:** for Smithery
- [ ] **glama.json created:** for Glama claim
- [ ] **GitHub repo is public:** all registries need to read the repo
- [ ] **package.json metadata complete:** keywords, repository, homepage, description

---

## 10. Submission Tracker

Use this table to track submission progress:

| # | Registry                            | Method    | Status      | Date Submitted | Date Listed | URL                |
|---|-------------------------------------|-----------|-------------|----------------|-------------|--------------------|
| 1 | npm                                 | CLI       | Not started |                |             |                    |
| 2 | Official MCP Registry               | CLI       | Not started |                |             |                    |
| 3 | Smithery                            | CLI       | Not started |                |             |                    |
| 4 | mcp.so                              | GH Issue  | Not started |                |             |                    |
| 5 | Glama                               | Auto+Claim| Not started |                |             |                    |
| 6 | PulseMCP                            | Auto      | Not started |                |             |                    |
| 7 | punkpeye/awesome-mcp-servers        | PR        | Not started |                |             |                    |
| 8 | appcypher/awesome-mcp-servers       | PR        | Not started |                |             |                    |
| 9 | mcpservers.org                      | Web form  | Not started |                |             |                    |

### Recommended Order of Submission

1. **npm** -- everything else depends on this
2. **Official MCP Registry** -- PulseMCP auto-ingests from here
3. **Smithery** -- large user base, quick publish
4. **Glama** -- auto-indexed, just claim it
5. **mcp.so** -- quick GitHub issue
6. **mcpservers.org** -- web form, also feeds wong2/awesome-mcp-servers
7. **punkpeye/awesome-mcp-servers** -- PR, may take a few days
8. **appcypher/awesome-mcp-servers** -- PR, may take a few days
9. **PulseMCP** -- should auto-appear after step 2; verify after one week
