import { chromium, devices } from "npm:playwright";
import { fromFileUrl, join } from "jsr:@std/path";
import { importCookies } from "./import-cookies.mjs";
import { parseArgs } from "@std/cli/parse-args";

// Paths
const __rootdir = fromFileUrl(new URL("..", import.meta.url));
const codegenDir = join(__rootdir, ".codegen");
const outputFile = join(
  codegenDir,
  `output-${Math.floor(Date.now() / 1000)}.js`,
);

// Args
const args = parseArgs(Deno.args);
const url = args._[0] ?? "https://example.com";
const cookiesPath = args.cookies ?? false;
const excludeDomainPattern = args.exclude ?? null;

// Vars
const deviceName = null; // e.g. "iPhone 11";
const language = "javascript";

const launchOptions = {
  headless: false,
  args: [
    "--no-sandbox", // required in some environments (e.g., Docker); can reduce detection
    "--disable-setuid-sandbox", // disables the user namespace sandbox
    "--disable-infobars", // hides "Chrome is being controlled by automated test software" message
    "--disable-blink-features=AutomationControlled", // masks automation detection via `navigator.webdriver`
    "--disable-client-side-phishing-detection", // disables safe browsing checks that may detect automation
    "--disable-popup-blocking", // ensures popups are allowed like with real users
    "--disable-background-timer-throttling", // prevents throttling JS timers when tab is in background
    "--disable-renderer-backgrounding", // keeps rendering active in background tabs
    "--disable-backgrounding-occluded-windows", // keeps backgrounded/hidden windows rendering like foreground
    "--disable-dev-shm-usage", // prevents crashes in low-memory environments (uses /tmp instead of /dev/shm)
    "--mute-audio", // prevents unintended audio playback (safe default)
    "--no-first-run", // skips the first-time Chrome setup prompts
    "--disable-default-apps", // stops loading default Chrome apps
    "--disable-extensions", // prevents loading extensions, which can affect fingerprinting
    "--disable-sync", // turns off Chrome sync which is not typically enabled for bots
    "--start-maximized", // opens Chrome window maximized – typical of real users
    "--window-size=1920,1080", // explicit window size – avoids default bot-like sizes
    "--autoplay-policy=no-user-gesture-required", // allows autoplay of media without interaction
    "--metrics-recording-only", // disables actual metrics/telemetry logging
    "--ignore-certificate-errors", // prevents SSL errors from blocking automation
    "--allow-running-insecure-content", // allows mixed (HTTP on HTTPS) content to load
    "--enable-features=NetworkService,NetworkServiceInProcess", // ensures networking behaves consistently
    "--disable-features=IsolateOrigins,site-per-process", // reduces cross-origin isolation that can reveal automation
  ],
  ignoreDefaultArgs: ["--enable-automation"],
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
};

const contextOptions = {
  viewport: null,
  extraHTTPHeaders: {
    "Accept-Language": "en-US,en;q=0.9",
  },
};
if (deviceName) {
  const device = devices[deviceName];
  if (!device) throw new Error(`device "${deviceName}" not found`);
  Object.assign(contextOptions, device);
}

// Codegen
const browser = await chromium.launch(launchOptions);
const context = await browser.newContext(contextOptions);

await context.addInitScript(() => { // spoof
  Object.defineProperty(navigator, "webdriver", { get: () => false });
  window.chrome = { runtime: {} };
  Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
  Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
});

await context._enableRecorder({
  language: language,
  mode: "recording",
  outputFile: outputFile,
});

const page = await context.newPage();
await page.goto(url);

// Cookies
if (cookiesPath) {
  const cookies = cookiesPath === true
    ? await importCookies()
    : await importCookies(cookiesPath, excludeDomainPattern);

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    // console.log(`\n[${i}] Adding cookie:`, cookie);

    try {
      await context.addCookies([cookie]);
    } catch (err) {
      console.error(`failed to add cookie [${i}]\n\nerr:${err}`, cookie, err);
    }
  }
}
