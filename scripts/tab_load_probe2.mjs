import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://ggendb.up.railway.app/', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(2000);

// Open ranking first (triggers detail index warmup on detail open only in new code)
await page.click('#navRankingTab');
await page.waitForTimeout(12000);

await page.click('#navUnitTab');
await page.waitForTimeout(15000);
const unitState = await page.evaluate(() => ({
  loading: document.getElementById('unitLoading')?.style.display,
  rows: document.querySelectorAll('#unitGrid .list-grid-card, #unitBody tr').length,
  pending: performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/units') && !e.responseEnd).length,
}));
console.log('after ranking then units', unitState);

// Open a character detail (triggers warmDetailRankingIndex)
await page.click('#navCharTab');
await page.waitForTimeout(3000);
const firstCard = page.locator('#charGrid .list-grid-card').first();
if (await firstCard.count()) {
  await firstCard.click();
  await page.waitForTimeout(15000);
}
await page.click('#navUnitTab');
await page.waitForTimeout(15000);
const unitState2 = await page.evaluate(() => ({
  loading: document.getElementById('unitLoading')?.style.display,
  rows: document.querySelectorAll('#unitGrid .list-grid-card, #unitBody tr').length,
}));
console.log('after detail warmup then units', unitState2);

await browser.close();
