import { chromium } from "npm:playwright";

// Chrome launch path (macOS default)
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const userDataDir =
  "/Users/askonieczny/Documents/yummy-bot/.codegen/chrome-user";

// Launch Chrome with remote debugging enabled
const proc = new Deno.Command(chromePath, {
  args: [
    `--user-data-dir=${userDataDir}`,
    "--profile-directory=Default",
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--disable-background-networking",
    "about:blank",
  ],
  stdout: "piped",
  stderr: "piped",
});

const child = proc.spawn();

// Print Chrome's stdout and stderr live
const logStream = async (reader, label) => {
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) console.log(`[${label}]`, decoder.decode(value));
  }
};
logStream(child.stdout.getReader(), "stdout");
logStream(child.stderr.getReader(), "stderr");

// Wait a few seconds for Chrome to start
await new Promise((r) => setTimeout(r, 3000));

// Wait for Chrome CDP to be available
async function waitForCDP(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Timed out waiting for Chrome CDP to be available.");
}

try {
  await waitForCDP("http://localhost:9222/json/version");

  // Connect Playwright to Chrome
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];
  ``;
  await context._enableRecorder({
    language: "javascript",
    mode: "recording",
    outputFile: "./xd.js",
  });

  const page = await context.newPage();
  await page.goto("https://github.com");

  console.log("✅ Page loaded successfully.");
  await new Promise((r) => setTimeout(r, 200000));
  await browser.close();
} catch (err) {
  console.error("❌ Error:", err);
}
