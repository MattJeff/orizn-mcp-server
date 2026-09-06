# Changelog

## 1.3.2 — 2026-09-06

### Changed

- **The 429 shows the server's message as-is.** Since September 2026 the API's
  quota error carries the next plan, its price, the reset date and a checkout
  link; the server now handles both the string and the `{ error: { message } }`
  envelope, and only adds its own Starter line when no visa.orizn.app link is
  present. No more truncated JSON, no double URL.
- Free tier is **100 requests/month** everywhere (was still written 50), the
  upgrade link opens Starter ($49/month, 30,000 requests) instead of the closed
  Hobby plan, and the User-Agent version matches the package.

## 1.3.0 — 2026-08-12

### Added

- **`quick_visa_check` works with no API key**, capped at **10 checks per UTC day**.
  Until now the only keyless tool was `get_coverage_stats`, which reports the size
  of the database and answers no traveller's question — so an agent that installed
  the server discovered the product through an error message. It now discovers it
  through an answer. The cap matches exactly what `visa.orizn.app` already grants an
  anonymous visitor (`ANON_DEMO_DAILY_LIMIT`), and keyless calls go through the API's
  existing anonymous path (`Referer: https://visa.orizn.app/mcp`) rather than a new
  endpoint. The 11th call of the day is refused locally, before the network, with a
  message that names the free key, where to put it, and when the allowance resets.
- **`get_recent_changes`** — visa rules that changed recently, with their source and
  date. Orizn's change feed is currently **off** (it was publishing internal data
  inconsistencies as official policy changes), so the tool returns
  `{status: "unavailable", changes: []}` plus an explicit "this is NOT evidence that
  nothing changed". It is shipped in that state on purpose: the shape is right, the
  data is honest, and it starts serving the day a verified feed exists. When it does,
  entries without a named source and a date are withheld rather than shown.

### Changed

- **The no-key message stopped being an error and became an offer**: it says what
  still works without a key, what a free key adds, and the link — in one sentence.
  Same for the startup banner, which now lists working tools and gated ones separately.
- The API key is no longer declared as required in `server.json` and `smithery.yaml`.
  Registry installers were forcing a key before the first call, which is precisely the
  wall this release removes.
- `quick_visa_check`'s description states the keyless allowance and that the reply
  carries `last_verified` — the date the pair was checked, `null` when Orizn has none.
  No description was loosened: the honesty about `granularity`, transit modelled per
  destination and `status: "unavailable"` is untouched.

### Internal

- Tool dispatch extracted into `callTool()` so the tests exercise the real request
  path (validation, headers, keyless metering) instead of a re-implementation of it.

## 1.2.0 — 2026-08-07

### Removed

- **`get_visa_changes` is gone.** The `/api/v1/visa/changes` endpoint now returns
  503: the feed was serving internally-detected inconsistencies as if they were
  official policy changes, and has been shut off until it runs on verified
  sources. A tool that always fails is worse than no tool.
- **The hardcoded 199-code country allowlist is gone.** It rejected `NCL`, `PYF`,
  `WLF`, `MAC` and `HKG` client-side — all of which the API answers with 200 —
  and would rot again on the next coverage change. Codes are now validated for
  shape only (three letters); the API decides what exists.
- The `visa://country-codes` resource, which published that same stale list.

### Fixed

- **`get_all_destinations` was broken and is replaced by `compare_destinations`.**
  The `/bulk` endpoint made `destination` mandatory (anti-scraping, max 25 codes),
  so every call the old tool made returned HTTP 400. The new tool takes an explicit
  list of 1–25 destinations.
- `check_transit_visa` no longer reports "no transit visa data" when the API
  actually returned an upgrade placeholder.

### Changed

- **Every error message now names the fix and the URL.** Missing key points to the
  free-key page and shows exactly where to put the key; a rejected key says to check
  it rather than to pay; a plan gate and a quota overrun link to Hobby checkout; a
  network failure says so instead of blaming the key. Previously the API's raw
  status code was passed through — 297 monthly installs hit "This endpoint requires
  an API key" with no link.
- A plan-gate 403 now shows one upgrade URL, not two: the API appends its own bare
  `/dashboard/billing` link, which is stripped in favour of the deep link that
  preselects Hobby.
- Tool descriptions rewritten so a model picks the right tool first time: what each
  returns, what plan it needs, and when *not* to call it.
- The no-key startup banner tells the truth — only `get_coverage_stats` works
  without a key, the free tier is 50 requests/month (not 3,000), and all 15
  languages are included on every plan.
- README rewritten key-first: get a key, run one curl, then configure the client.
  Corrected the tool table, the pricing table, the coverage numbers (40,027 pairs,
  199 passports, 202 destinations) and the "languages are a paid feature" claim.
- Added a troubleshooting table mapping each error to its fix.
- `server.json` now marks `ORIZN_API_KEY` as required, so registry installers ask
  for it up front.

## 1.1.0

- Extended visa intelligence fields, transit visa tool, 15 languages.

## 1.0.x

- Initial release.
