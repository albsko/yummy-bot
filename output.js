const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext({
    defaultBrowserType: 'webkit',
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    screen: {
      height: 896,
      width: 414
    },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    viewport: {
      height: 715,
      width: 414
    }
  });
  const page = await context.newPage();
  await page.goto('https://example.com/');
  await page.getByRole('link', { name: 'More information...' }).click();
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();