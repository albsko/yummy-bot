import { chromium, devices } from "npm:playwright";
import { fromFileUrl, join } from "jsr:@std/path";
import { parseArgs } from "@std/cli/parse-args";

// Paths
const __rootdir = fromFileUrl(new URL("..", import.meta.url));
const codegenDir = join(__rootdir, ".codegen");
const profileDir = join(codegenDir, "profile");
const outputFile = join(
  codegenDir,
  `output-${Math.floor(Date.now() / 1000)}.js`,
);

// Args
const args = parseArgs(Deno.args);
const url = args._[0] ?? "https://example.com";
// const cookiesPath = args.cookies ?? false;

// Vars
const deviceName = null; // e.g. "iPhone 11";
const language = "javascript";

const contextOptions = {
  viewport: null,
  headless: false,
  args: [
    "--start-maximized", // looks more natural
    "--no-sandbox", // avoids being flagged in some headless environments
    "--disable-blink-features=AutomationControlled", // hides Playwright automation
    "--disable-infobars", // removes "Chrome is being controlled by automated software"
    "--disable-dev-shm-usage", // prevents potential crashes in Docker
    "--ignore-certificate-errors", // avoids cert warnings in test environments
  ],
  ignoreDefaultArgs: ["--enable-automation"], // removes automation flag
};
if (deviceName) {
  const device = devices[deviceName];
  if (!device) throw new Error(`device "${deviceName}" not found`);
  Object.assign(contextOptions, device);
}

// Codegen
const context = await chromium.launchPersistentContext(
  profileDir,
  contextOptions,
);

await context._enableRecorder({
  language: language,
  mode: "recording",
  outputFile: outputFile,
});

const page = await context.newPage();
await page.goto(url);
