// Takes the portfolio image of a page in this repository: it serves the repo,
// opens the page in headless Chrome, presses the buttons that you name, and
// saves a WebP screenshot.
//
//   bun scripts/captureProjectImage.js --page web-projects/wildfire-watch/ \
//     --out resources/images/projects/wildfireWatch.webp \
//     --click "Weather (wind)" --click "+12h" --width 1600 --height 900
//
// Each `--click` presses the first button whose text is exactly that label,
// or else the one button whose text contains it. A label that matches no
// button, or several, stops the script, so a renamed button cannot give the
// wrong picture without a warning.
//
// Why a script and not the agent's browser pane: a pane screenshot reaches the
// agent as an image, never as a file on disk, so it cannot become the image.

import { existsSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** Where Chrome or Edge usually sits; `CHROME_PATH` wins over all of them. */
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

/**
 * @typedef {object} CaptureOptions
 * @property {string} page path of the page, relative to the repo root
 * @property {string} out path of the WebP file to write
 * @property {string[]} clicks button labels, pressed in order
 * @property {number} width viewport width in CSS pixels
 * @property {number} height viewport height in CSS pixels
 * @property {number} waitMs pause after load and after each click
 * @property {number} quality WebP quality, 0-100
 */

/**
 * Read the command-line flags.
 * @param {string[]} argv the arguments after the script name
 * @returns {CaptureOptions}
 * @throws {Error} when `--page` or `--out` is missing, or a flag is unknown
 */
export function parseCaptureArgs(argv) {
  /** @type {CaptureOptions} */
  const options = { page: "", out: "", clicks: [], width: 1600, height: 900, waitMs: 2500, quality: 60 };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === "--page") options.page = value;
    else if (flag === "--out") options.out = value;
    else if (flag === "--click") options.clicks.push(value);
    else if (flag === "--width") options.width = Number(value);
    else if (flag === "--height") options.height = Number(value);
    else if (flag === "--wait") options.waitMs = Number(value);
    else if (flag === "--quality") options.quality = Number(value);
    else throw new Error(`Unknown flag ${flag}`);
  }
  if (!options.page || !options.out) throw new Error("--page and --out are required");
  return options;
}

/**
 * Choose the button that a label names.
 * @param {string[]} buttonTexts the trimmed text of every button, in page order
 * @param {string} label the label that the caller wants to press
 * @returns {number} the index of the button to press
 * @throws {Error} when no button, or more than one partial match, fits the label
 */
export function pickButtonIndex(buttonTexts, label) {
  const exact = buttonTexts.indexOf(label);
  if (exact !== -1) return exact;
  const partial = buttonTexts.flatMap((text, index) => (text.includes(label) ? [index] : []));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new Error(`No button matches "${label}"`);
  throw new Error(`${partial.length} buttons contain "${label}"; use a longer label`);
}

/** Serve the repo root, so the page loads its files exactly as on the live site. */
function serveRepository() {
  return Bun.serve({
    port: 0,
    fetch(request) {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      let filePath = normalize(join(ROOT, pathname));
      if (!filePath.startsWith(normalize(ROOT))) return new Response("Forbidden", { status: 403 });
      if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
      return existsSync(filePath) ? new Response(Bun.file(filePath)) : new Response("Not found", { status: 404 });
    },
  });
}

/** Open a CDP (Chrome DevTools Protocol) session on one tab. */
async function connectToTab(debugPort) {
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    try {
      target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
    } catch {
      await Bun.sleep(200);
    }
  }
  if (!target) throw new Error("Chrome did not open its debugging port");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 1;
  /** @type {Map<number, (message: any) => void>} */
  const pending = new Map();
  /** @type {Map<string, () => void>} */
  const waiters = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) pending.get(message.id)(message);
    if (message.method && waiters.has(message.method)) waiters.get(message.method)();
  };
  /** @returns {Promise<any>} */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
      socket.send(JSON.stringify({ id, method, params }));
    });
  const nextEvent = (method) => new Promise((resolve) => waiters.set(method, resolve));
  return { send, nextEvent, close: () => socket.close() };
}

/** @param {CaptureOptions} options */
async function capture(options) {
  const browserPath = BROWSER_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
  if (!browserPath) throw new Error("No Chrome or Edge found; set CHROME_PATH");
  const server = serveRepository();
  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const browser = Bun.spawn(
    [browserPath, "--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(tmpdir(), "capture-project-image-profile")}`, "--hide-scrollbars"],
    { stdout: "ignore", stderr: "ignore" },
  );
  try {
    const tab = await connectToTab(debugPort);
    await tab.send("Page.enable");
    await tab.send("Emulation.setDeviceMetricsOverride", { width: options.width, height: options.height, deviceScaleFactor: 1, mobile: false });
    const loaded = tab.nextEvent("Page.loadEventFired");
    await tab.send("Page.navigate", { url: `http://localhost:${server.port}/${options.page}` });
    await loaded;
    await Bun.sleep(options.waitMs);
    for (const label of options.clicks) {
      const { result } = await tab.send("Runtime.evaluate", {
        expression: "JSON.stringify([...document.querySelectorAll('button')].map((b) => b.textContent.trim()))",
        returnByValue: true,
      });
      const index = pickButtonIndex(JSON.parse(result.value), label);
      await tab.send("Runtime.evaluate", { expression: `document.querySelectorAll('button')[${index}].click()` });
      await Bun.sleep(options.waitMs);
    }
    const { data } = await tab.send("Page.captureScreenshot", { format: "webp", quality: options.quality });
    writeFileSync(join(ROOT, options.out), Buffer.from(data, "base64"));
    console.log(`Wrote ${options.out}`);
    tab.close();
  } finally {
    browser.kill();
    server.stop(true);
  }
}

if (import.meta.main) {
  await capture(parseCaptureArgs(process.argv.slice(2)));
}
