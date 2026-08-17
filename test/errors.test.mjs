// Smallest check that fails if the error copy or the destination parsing breaks.
// Run: npm test   (requires `npm run build` first)
import assert from "node:assert/strict";
import test from "node:test";

process.env.ORIZN_MCP_NO_MAIN = "1";
const { apiErrorMessage, parseDestinationList } = await import("../dist/index.js");

const KEY_URL = "https://visa.orizn.app/visa-api";
const BILLING = "dashboard%2Fbilling%3Fplan%3Dhobby";

test("401 sends the developer to the free-key page", () => {
  const m = apiErrorMessage(401, '{"error":"Missing API key."}');
  assert.match(m, new RegExp(KEY_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(m, /ORIZN_API_KEY/);
});

test("403 on a bad key does NOT push checkout", () => {
  const m = apiErrorMessage(403, '{"error":"Invalid or inactive API key"}');
  assert.match(m, /typos/);
  assert.ok(!m.includes(BILLING), "a broken key must not be told to pay");
});

test("403 on a plan gate pushes checkout, and only ours", () => {
  const m = apiErrorMessage(403, '{"error":"Bulk endpoint requires Hobby plan or above."}');
  assert.ok(m.includes(BILLING), "a plan gate must link to checkout");

  // The live API appends its own bare billing link; only one URL may survive.
  const live = apiErrorMessage(
    403,
    '{"error":"Bulk endpoint requires Hobby plan or above. Upgrade at https://visa.orizn.app/dashboard/billing"}',
  );
  assert.equal(live.match(/https?:\/\//g).length, 1, "one upgrade URL, not two");
  assert.ok(live.includes(BILLING));
});

test("429 gives the quota truth and the upgrade link", () => {
  const m = apiErrorMessage(429, '{"error":"Monthly limit reached","limit":50}');
  assert.match(m, /50 requests\/month/);
  assert.ok(m.includes(BILLING));
});

test("404 explains alpha-3 vs alpha-2", () => {
  assert.match(apiErrorMessage(404, '{"error":"Pair not found"}'), /alpha-3/);
});

test("503 says it is not the key's fault", () => {
  assert.match(apiErrorMessage(503, '{"error":"Feed rebuilt"}'), /not a problem with your API key/);
});

test("non-JSON body still yields a message", () => {
  assert.match(apiErrorMessage(500, "<html>bad gateway</html>"), /500/);
});

test("destinations: array, CSV, dedup, upper-case", () => {
  assert.deepEqual(parseDestinationList(["jpn", "USA", "jpn"]), ["JPN", "USA"]);
  assert.deepEqual(parseDestinationList("jpn, usa ,deu"), ["JPN", "USA", "DEU"]);
});

test("destinations: rejects >25, empty, and alpha-2", () => {
  const many = Array.from({ length: 26 }, (_, i) => `A${String.fromCharCode(65 + (i % 26))}A`);
  assert.throws(() => parseDestinationList(many), /at most 25/);
  assert.throws(() => parseDestinationList([]), /at least one/);
  assert.throws(() => parseDestinationList(["JP"]), /alpha-3/);
  assert.throws(() => parseDestinationList(undefined), /required/);
});
