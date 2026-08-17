// Exercises the real tool dispatch (callTool) with fetch stubbed, so a green run
// means the actual request path was taken — headers included — not a copy of it.
// Run: npm test   (requires `npm run build` first)
import assert from "node:assert/strict";
import test from "node:test";

process.env.ORIZN_MCP_NO_MAIN = "1";
const {
  callTool,
  ANON_DAILY_LIMIT,
  resetAnonQuota,
} = await import("../dist/index.js");

/** Stub global fetch; returns the log of calls made. */
function stubFetch(responder) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} });
    return responder(String(url));
  };
  calls.restore = () => { globalThis.fetch = original; };
  return calls;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ---------------------------------------------------------------------------
// quick_visa_check without a key
// ---------------------------------------------------------------------------

test("keyless quick_visa_check answers, and goes through the anonymous door", async () => {
  resetAnonQuota();
  const calls = stubFetch(() => json({ passport: "FRA", destination: "JPN", requirement: "visa free", last_verified: "2026-07-01" }));
  try {
    const res = await callTool("quick_visa_check", { passport: "fra", destination: "jpn" }, undefined);
    assert.equal(res.requirement, "visa free");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/check\?/);
    assert.equal(calls[0].headers["Referer"], "https://visa.orizn.app/mcp",
      "keyless calls must use the API's existing anonymous-demo referer path");
    assert.equal(calls[0].headers["x-api-key"], undefined);
  } finally {
    calls.restore();
  }
});

test(`the ${ANON_DAILY_LIMIT + 1}th keyless check is refused locally, with the way out`, async () => {
  resetAnonQuota();
  const calls = stubFetch(() => json({ requirement: "visa free" }));
  try {
    for (let i = 0; i < ANON_DAILY_LIMIT; i++) {
      await callTool("quick_visa_check", { passport: "FRA", destination: "JPN" }, undefined);
    }
    assert.equal(calls.length, ANON_DAILY_LIMIT);

    await assert.rejects(
      () => callTool("quick_visa_check", { passport: "FRA", destination: "JPN" }, undefined),
      (err) => {
        assert.match(err.message, /https:\/\/visa\.orizn\.app\/visa-api/, "must say where the free key is");
        assert.match(err.message, /ORIZN_API_KEY/, "must say where to put it");
        assert.match(err.message, /00:00 UTC/, "must say when it resets");
        return true;
      },
    );
    assert.equal(calls.length, ANON_DAILY_LIMIT, "a refused call must not hit the API");
  } finally {
    calls.restore();
  }
});

test("a key skips the keyless meter entirely", async () => {
  resetAnonQuota();
  const calls = stubFetch(() => json({ requirement: "visa free" }));
  try {
    for (let i = 0; i < ANON_DAILY_LIMIT + 5; i++) {
      await callTool("quick_visa_check", { passport: "FRA", destination: "JPN" }, "orizn_visa_test");
    }
    assert.equal(calls.length, ANON_DAILY_LIMIT + 5);
    assert.equal(calls[0].headers["x-api-key"], "orizn_visa_test");
    assert.equal(calls[0].headers["Referer"], undefined, "a keyed call is not an anonymous demo");
  } finally {
    calls.restore();
  }
});

test("the tools that need a key still say so, before any network call", async () => {
  const calls = stubFetch(() => json({}));
  try {
    for (const name of ["check_visa_requirement", "compare_destinations", "check_transit_visa"]) {
      await assert.rejects(
        () => callTool(name, { passport: "FRA", destination: "JPN", destinations: ["JPN"], transit_country: "ARE" }, undefined),
        /quick_visa_check .*still work|No Orizn API key/,
      );
    }
    assert.equal(calls.length, 0);
  } finally {
    calls.restore();
  }
});

// ---------------------------------------------------------------------------
// get_recent_changes — the feed is off
// ---------------------------------------------------------------------------

test("get_recent_changes invents nothing while the feed is 503", async () => {
  const calls = stubFetch(() =>
    json({ error: "The policy-change feed is being rebuilt on verified official sources.", status: "unavailable" }, 503));
  try {
    const res = await callTool("get_recent_changes", { destination: "THA" }, undefined);
    assert.equal(res.status, "unavailable");
    assert.deepEqual(res.changes, [], "no entries may be fabricated");
    assert.match(res.do_not_conclude, /NOT evidence/, "empty must not read as 'nothing changed'");
    assert.equal(calls.length, 1, "the 503 must not be retried");
  } finally {
    calls.restore();
  }
});

test("get_recent_changes does not disguise a real error as 'feed rebuilding'", async () => {
  const calls = stubFetch(() => json({ error: "Invalid API key" }, 403));
  try {
    await assert.rejects(
      () => callTool("get_recent_changes", {}, "bad_key"),
      /403|typos/,
    );
  } finally {
    calls.restore();
  }
});

test("when the feed returns, unsourced entries are withheld, not shown", async () => {
  const calls = stubFetch(() =>
    json({
      data: [
        { id: 1, verified: true, source_name: "Journal Officiel", detected_at: "2026-08-01", summary: "real" },
        { id: 2, verified: false, source_name: "passport-index sync", detected_at: "2026-05-10", summary: "internal drift" },
        { id: 3, verified: true, source_name: null, detected_at: "2026-08-02", summary: "no source" },
      ],
    }));
  try {
    const res = await callTool("get_recent_changes", { limit: 50 }, "orizn_visa_test");
    assert.equal(res.status, "ok");
    assert.deepEqual(res.changes.map((c) => c.id), [1]);
    assert.equal(res.withheld, 2);
  } finally {
    calls.restore();
  }
});
