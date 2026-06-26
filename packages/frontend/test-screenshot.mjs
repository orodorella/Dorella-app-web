import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const BASE = 'http://localhost:5175';

// Home
await page.goto(BASE);
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });

// Login + go to catalog
await page.goto(BASE + '/login');
await page.waitForTimeout(800);
await page.click('text=Carlos Restrepo');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'screenshots/02-catalogo-grid.png', fullPage: true });

// Product detail via click
const prodLink = page.locator('a[href^="/producto/"]').first();
if (await prodLink.isVisible()) {
  await prodLink.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/03-producto.png', fullPage: true });
}

await browser.close();
console.log('Done!');
