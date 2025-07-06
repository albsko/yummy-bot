// import-cookies.mjs

export const importCookies = async (
  cookiesPath = "",
  excludeDomainPattern = null,
) => {
  const args = ["task", "export-cookies"];
  if (cookiesPath && cookiesPath.trim() !== "") {
    args.push(cookiesPath);
  }

  const process = new Deno.Command("deno", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, stderr, success } = await process.output();

  if (!success) {
    const errMsg = new TextDecoder().decode(stderr);
    console.error("failed to run export-cookies:", errMsg);
    Deno.exit(1);
  }

  const rawJson = new TextDecoder().decode(stdout);

  let rawCookies;
  try {
    rawCookies = JSON.parse(rawJson);
  } catch (e) {
    console.error("failed to parse JSON:", e.message);
    Deno.exit(1);
  }

  const excludeDomainRegExp = excludeDomainPattern
    ? (() => {
      try {
        return new RegExp(excludeDomainPattern.trim());
      } catch (e) {
        console.error("invalid exclude domain pattern:", e.message);
        Deno.exit(1);
      }
    })()
    : null;

  const playwrightCookies = rawCookies
    .filter((cookie) =>
      !excludeDomainRegExp || !excludeDomainRegExp.test(cookie.domain)
    )
    .map((cookie) =>
      Object.freeze({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
      })
    );

  return Object.freeze(playwrightCookies.map(Object.freeze));
};

if (import.meta.main) { // if executed directly
  const cookiesPath = Deno.args[0] || "";
  const excludeDomainPattern = Deno.args[1] || null;
  const cookies = await importCookies(cookiesPath, excludeDomainPattern);
  console.log(JSON.stringify(cookies, null, 2));
}
