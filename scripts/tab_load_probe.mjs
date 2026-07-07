import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE ERR', m.text());
});
page.on('pageerror', (e) => console.log('PAGE ERR', e.message));

await page.goto('https://ggendb.up.railway.app/', { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(3000);

const charRows = await page.evaluate(() =>
  document.querySelectorAll('#charGrid .list-grid-card, #charBody tr').length
);
console.log('char rows', charRows);

await page.click('#navUnitTab');
await page.waitForTimeout(10000);
const unitState = await page.evaluate(() => ({
  loading: document.getElementById('unitLoading')?.style.display,
  rows: document.querySelectorAll('#unitGrid .list-grid-card, #unitBody tr').length,
  empty: document.getElementById('unitEmpty')?.style.display,
  panelActive: document.getElementById('panel-units')?.classList.contains('active'),
}));
console.log('units', unitState);

await page.click('#navSuppTab');
await page.waitForTimeout(5000);
const suppRows = await page.evaluate(() =>
  document.querySelectorAll('#suppGrid .list-grid-card, #suppBody tr').length
);
console.log('supp rows', suppRows);

await page.click('#navRankingTab');
await page.waitForTimeout(10000);
const rankState = await page.evaluate(() => ({
  loading: document.getElementById('rankLoading')?.style.display,
  rows: document.querySelectorAll('#rankListInner .ranking-row, #rankListInner .ranking-podium-col').length,
  inner: document.getElementById('rankListInner')?.innerHTML?.slice(0, 120),
}));
console.log('ranking', rankState);

await browser.close();
