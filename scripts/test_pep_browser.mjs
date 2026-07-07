import { chromium } from 'playwright';

const UNIT_ID = '1125001450';
const URL = `https://ggendb.up.railway.app/u/${UNIT_ID}`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('#detailModal.active', { timeout: 60000 });
  await page.waitForSelector('.detail-pilot-ep-toggle', { timeout: 60000 });

  const before = await page.evaluate(() => ({
    pepActive: window.S?.pilotConditionalPassiveActive,
    pepBonuses: window.S?.currentDetailData?.pilot_weapon_effect_bonuses,
    tagBonuses: window.S?.currentDetailData?.pilot_tag_weapon_stat_bonuses,
  }));

  await page.locator('.detail-pilot-ep-toggle .toggle-clickable').click();
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => {
    const d = window.S?.currentDetailData;
    const sf = (d?.weapons || []).find((w) => /shield funnel ex/i.test(w.name || ''));
    let pepMapSize = 0;
    try {
      if (window.S?.pilotConditionalPassiveActive && d?.pilot_weapon_effect_bonuses) {
        pepMapSize = Object.keys(d.pilot_weapon_effect_bonuses).length;
      }
    } catch (_) {}
    return {
      pepActive: window.S?.pilotConditionalPassiveActive,
      pepBonuses: d?.pilot_weapon_effect_bonuses,
      tagBonuses: d?.pilot_tag_weapon_stat_bonuses,
      hasPilotCondCharData: !!window.S?.pilotCondCharData,
      pepMapSize,
      sfTraits: sf?.levels?.[4]?.traits || sf?.traits,
    };
  });

  const sfCard = page.locator('.weapon-card').filter({ hasText: 'Shield Funnel EX' });
  const traitHtml = await sfCard.locator('.weapon-card-body').innerHTML();
  const headerCls = await sfCard.locator('.weapon-card-header').first().getAttribute('class');
  const accItems = await sfCard.locator('.weapon-stat-item').allTextContents();
  const allAcc = await page.locator('.weapon-card').filter({ hasText: 'Shield Funnel EX' }).locator('.weapon-stat-value').allTextContents();

  console.log(JSON.stringify({
    before,
    after,
    pageErrors,
    headerCls,
    traitHtml,
    weaponStatValues: allAcc,
    accItems,
    hasBoostSpan: traitHtml.includes('weapon-acc-boost'),
    hasPepNote: traitHtml.includes('weapon-trait-pep-note'),
    hasPilotBoostLine: traitHtml.includes('weapon-trait-line--pilot-boost'),
  }, null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
