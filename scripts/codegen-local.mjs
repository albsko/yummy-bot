import { chromium } from "npm:playwright";
import { fromFileUrl, join } from "jsr:@std/path";
import { parseArgs } from "@std/cli/parse-args";
import { importCookies } from "./import-cookies.mjs";

// Paths
const __rootdir = fromFileUrl(new URL("..", import.meta.url));
const codegenDir = join(__rootdir, ".codegen");
const userDataDir = join(codegenDir, "userdata");
const outputFile = join(
  codegenDir,
  `output-${Math.floor(Date.now() / 1000)}.js`,
);

// Args
const args = parseArgs(Deno.args);
const url = args._[0] ?? "about:blank";
const verbose = (args.v || args.verbose) ?? false;
const cookiesPath = (args.c || args.cookies) ??
  "$HOME/Library/Application\ Support/Google/Chrome/Default/Cookies";
const excludeDomainPattern = (args.e || args.exclude) ?? null;

// Vars
const chromePath =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const chromeWebsocketPort = "9222";
const chromeArgs = [
  `--user-data-dir=${userDataDir}`,
  "--profile-directory=Default",
  `--remote-debugging-port=${chromeWebsocketPort}`,
  "--start-maximized",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-popup-blocking",
  // "--disable-background-networking",
  "about:blank",
];

// Chrome
await new Deno.Command("killall", { args: ["Google Chrome"] }).output();
const proc = new Deno.Command(chromePath, {
  args: chromeArgs,
  stdout: "piped",
  stderr: "piped",
});
const child = proc.spawn();

if (verbose) {
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
}

let connected = false;
const deadline = Date.now() + 5000;
while (Date.now() < deadline) {
  try {
    const res = await fetch(
      `http://localhost:${chromeWebsocketPort}/json/version`,
    );
    if (res.ok) {
      connected = true;
      break;
    }
    // deno-lint-ignore no-empty
  } catch {}
  await new Promise((r) => setTimeout(r, 256));
}
if (!connected) {
  throw new Error("timed out waiting for Chrome to be available");
}

// Codegen
const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];

await context._enableRecorder({
  language: "javascript",
  mode: "recording",
  outputFile: outputFile,
});

const pages = context.pages();
for (let i = 1; i < pages.length; i++) {
  await pages[i].close();
}
const page = pages[0];
await page.goto(url);

// Cookies
if (cookiesPath) {
  const cookies = cookiesPath === true
    ? await importCookies("", excludeDomainPattern)
    : await importCookies(cookiesPath, excludeDomainPattern);

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    try {
      await context.addCookies([cookie]);
    } catch (err) {
      if (verbose) {
        console.error(`failed to add cookie [${i}]\n\nerr:${err}`, cookie, err);
      }
    }
  }
}
