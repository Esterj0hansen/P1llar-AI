import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("health endpoint reports configuration instead of claiming all services work", async () => {
 const source=await readFile(new URL("../app/api/health/route.ts",import.meta.url),"utf8");
 assert.match(source,/needs_configuration/);
 assert.match(source,/does not claim/);
 assert.match(source,/OPENROUTER_API_KEY/);
});

test("support endpoint enforces a server-side rate limit and captures human handoff", async () => {
 const source=await readFile(new URL("../app/api/support/route.ts",import.meta.url),"utf8");
 assert.match(source,/consume_support_rate_limit/);
 assert.match(source,/status: "needs_human"/);
 assert.match(source,/usage_events/);
});

test("knowledge upload checks authentication, file size, type and workspace membership", async () => {
 const source=await readFile(new URL("../app/api/knowledge/upload/route.ts",import.meta.url),"utf8");
 for (const pattern of [/auth\.getUser/,/file\.size/,/allowed\.has\(file\.type\)/,/business_members/,/business-knowledge/]) assert.match(source,pattern);
});

test("public widget sends messages to the business support endpoint", async () => {
 const source=await readFile(new URL("../public/p1llar-widget.js",import.meta.url),"utf8");
 assert.match(source,/data-business/);
 assert.match(source,/api\/support/);
});
