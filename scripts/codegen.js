import process from "node:process";
import { chromium, devices } from "npm:playwright";
import { fromFileUrl, join } from "jsr:@std/path";

const __rootdir = fromFileUrl(new URL("..", import.meta.url));

const url = Deno.args[0] || "https://example.com";

await Deno.mkdir(resolvePath(__rootdir, ".codegen"), { recursive: true });
const outputFile = resolvePath(
  __rootdir,
  `.codegen/output-${Math.floor(Date.now() / 1000)}.js`,
);

const deviceName = null; // e.g. "iPhone 11";
const language = "javascript";

const launchOptions = {
  headless: false,
  args: [
    "--start-maximized", // looks more natural
    // "--no-sandbox", // avoids being flagged in some headless environments
    // "--disable-blink-features=AutomationControlled", // hides Playwright automation
    // "--disable-infobars", // removes "Chrome is being controlled by automated software"
    // "--disable-dev-shm-usage", // prevents potential crashes in Docker
    // "--ignore-certificate-errors", // avoids cert warnings in test environments
  ],
  //   ignoreDefaultArgs: ["--enable-automation"], // removes automation flag
};
const contextOptions = {
  locale: "en-US",
  //   viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
};

const browser = await chromium.launch(launchOptions);

if (deviceName) {
  const device = devices[deviceName];
  if (!device) throw new Error(`device "${deviceName}" not found`);
  Object.assign(contextOptions, device);
}
const context = await browser.newContext(contextOptions);

await context._enableRecorder({
  language: language,
  launchOptions,
  contextOptions,
  mode: "recording",
  handleSIGINT: false,
  outputFile: outputFile,
});

const page = await context.newPage();
await page.goto(url).catch((err) => {
  console.error(err);
});

page.on("close", async () => {
  await context.close();
  await browser.close();
});

process.on("SIGINT", async () => {
  await browser.close();
  process.exit(130);
});

function resolvePath(rootDir, ...segments) {
  return join(rootDir, ...segments);
}
