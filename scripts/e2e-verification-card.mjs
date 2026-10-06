#!/usr/bin/env node
/**
 * Browser check for the owner "Request verification" card (components/owner/listing-integrity-card.tsx).
 *
 * Drives the real owner overview page in headless Chrome (DevTools protocol, no extra deps) and
 * asserts that the card state updates:
 *   1. the form shows "Request verification";
 *   2. submitting sends POST /verification-requests and the card switches to
 *      "Verification requested · Phone call · <date>" with a "Cancel request" link;
 *   3. "Cancel request" brings the form back (so the run leaves no PENDING request behind).
 *
 * Needs the app (APP_URL, default http://localhost:3000) and API (API_URL, default
 * http://localhost:8085) running, and an owner of a NON-verified listing with no waiting request:
 *   E2E_BUSINESS_ID=<listing id> E2E_OWNER_ID=<owner user id> node scripts/e2e-verification-card.mjs
 * The owner's access token is minted with JWT_SECRET (dev default "change-me-in-prod"), or pass
 * E2E_OWNER_TOKEN directly. CHROME_PATH overrides the browser location.
 */
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const BUSINESS_ID = process.env.E2E_BUSINESS_ID;
const OWNER_ID = process.env.E2E_OWNER_ID;
if (!BUSINESS_ID || (!OWNER_ID && !process.env.E2E_OWNER_TOKEN)) {
  console.error("Set E2E_BUSINESS_ID and E2E_OWNER_ID (or E2E_OWNER_TOKEN).");
  process.exit(2);
}

function mintToken(userId) {
  const secret = process.env.JWT_SECRET ?? "change-me-in-prod";
  let key = secret;
  while (key.length < 32) key += secret; // same padding as JwtService.pad
  key = key.substring(0, Math.max(32, secret.length));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "HS256" })}.${b64({ sub: userId, role: "BUSINESS_OWNER", iat: now, exp: now + 900 })}`;
  return `${unsigned}.${createHmac("sha256", key).update(unsigned).digest("base64url")}`;
}

const token = process.env.E2E_OWNER_TOKEN ?? mintToken(OWNER_ID);
const chromePath =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((p) => existsSync(p));
if (!chromePath) {
  console.error("No Chrome found — set CHROME_PATH.");
  process.exit(2);
}

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "e2e-"))}`, "--no-first-run", "--window-size=1280,1600", "about:blank"],
  { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed = true;
};

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
    } catch {
      await sleep(250);
    }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let seq = 0;
  const waiting = new Map();
  const requests = [];
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      waiting.get(msg.id)(msg);
      waiting.delete(msg.id);
    } else if (msg.method === "Network.responseReceived" && msg.params.response.url.includes("/verification-requests")) {
      requests.push({ id: msg.params.requestId, status: msg.params.response.status, url: msg.params.response.url });
    } else if (msg.method === "Network.requestWillBeSent" && msg.params.request.url.includes("/verification-requests")) {
      requests.push({ id: msg.params.requestId, method: msg.params.request.method, url: msg.params.request.url });
    }
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++seq;
      waiting.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const js = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const waitFor = async (expression, ms = 15000) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(250)) {
      if (await js(expression)) return true;
    }
    return false;
  };
  const card = `document.querySelector('[data-testid="listing-integrity-card"]')`;

  await send("Network.enable");
  await send("Page.navigate", { url: APP_URL });
  await sleep(3000);
  await js(`localStorage.setItem("rp.accessToken", ${JSON.stringify(token)}); localStorage.setItem("rp.refreshToken", "e2e"); true`);
  await send("Page.navigate", { url: `${APP_URL}/owner/${BUSINESS_ID}` });

  check(await waitFor(`!!${card}?.querySelector('[data-testid="verification-form"]')`, 30000),
    'card shows the "Request verification" form');

  await js(`(() => {
    const ta = ${card}.querySelector("textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, "E2E check — please call after 5pm");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ${card}.querySelector('button[type="submit"]').click();
    return true;
  })()`);

  check(await waitFor(`/Verification requested · Phone call · /.test(${card}?.querySelector('[data-testid="verification-requested"]')?.innerText ?? "")`),
    'card switches to "Verification requested · Phone call · <date>"');
  check(requests.some((r) => r.method === "POST") && requests.some((r) => r.status === 200),
    "POST /verification-requests was sent and answered 200");
  check(await js(`[...${card}.querySelectorAll("button")].some((b) => b.innerText.trim() === "Cancel request")`),
    'card offers "Cancel request"');
  check(!(await js(`!!${card}.querySelector('[data-testid="verification-error"]')`)), "no inline error");

  await js(`[...${card}.querySelectorAll("button")].find((b) => b.innerText.trim() === "Cancel request").click(); true`);
  check(await waitFor(`!!${card}?.querySelector('[data-testid="verification-form"]')`),
    'after "Cancel request" the form is back');
  check(requests.some((r) => r.method === "DELETE"), "DELETE /verification-requests/{id} was sent");

  ws.close();
} catch (e) {
  console.error(e);
  failed = true;
} finally {
  chrome.kill();
}
process.exit(failed ? 1 : 0);
