/**
 * GGen site feedback → Google Sheets receiver
 *
 * Form columns (ratings are 1–5):
 *   Q1  Overall              → overall
 *   Q2  Navigation           → navigation
 *   Q3  Visual design        → visual_design
 *   Q4  Content quality      → content_quality
 *   Q5  Page speed           → page_speed
 *   —   Device(s)            → devices (required; desktop-only skips Q6)
 *   Q6  Mobile experience    → mobile_experience (skipped if desktop/PC only)
 *   Q7  Functionality        → functionality
 *   Q8  Tool usage (two ratings in one section):
 *       Damage Simulator     → damage_sim_usage
 *       Team Builder         → team_builder_usage
 *   —   Devices (checkboxes) → devices
 *   Q9  What you liked       → liked
 *   Q10 New features         → improve (title + free-text detail)
 *
 * Setup:
 * 1. Create a Google Sheet (e.g. "GGen site feedback").
 * 2. Extensions → Apps Script → paste this file → Save.
 * 3. Project Settings → Script properties → add SECRET = a long random string.
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the Web app URL into Railway as GGEN_FEEDBACK_SHEETS_URL.
 * 6. Set the same SECRET value in Railway as GGEN_FEEDBACK_SHEETS_SECRET.
 *
 * After editing this script: Deploy → Manage deployments → Edit (pencil) →
 * Version = New version → Deploy (URL stays the same).
 *
 * Testing / reset: run wipeFeedbackSheetForTesting() once from the Apps Script
 * editor (see comments on that function below).
 */

var HEADERS = [
  'Timestamp (UTC)',
  'Submitter ID',
  'Lang',
  'Page URL',
  'Overall',
  'Navigation',
  'Visual design',
  'Content quality',
  'Page speed',
  'Mobile experience',
  'Functionality',
  'Q8 Damage Simulator usage',
  'Q8 Team Builder usage',
  'Devices',
  'What you liked',
  'What to improve',
  'User agent',
];

function doPost(e) {
  try {
    var expected = PropertiesService.getScriptProperties().getProperty('SECRET') || '';
    var payload = JSON.parse(e.postData.contents || '{}');
    if (expected && payload.secret !== expected) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders_(sheet);
    sheet.appendRow([
      payload.ts_iso || '',
      payload.submitter_id || '',
      payload.lang || '',
      payload.page_url || '',
      rating_(payload.overall),
      rating_(payload.navigation),
      rating_(payload.visual_design),
      rating_(payload.content_quality),
      rating_(payload.page_speed),
      rating_(payload.mobile_experience),
      rating_(payload.functionality),
      rating_(payload.damage_sim_usage, payload.tool_usage),
      rating_(payload.team_builder_usage),
      payload.devices || '',
      payload.liked || '',
      payload.improve || '',
      payload.ua || '',
    ]);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/** Coerce rating to 1–5 or blank. Old single Q8 "tool_usage" maps to Damage Simulator only. */
function rating_(value, legacyFallback) {
  var v = value;
  if (v === null || v === undefined || v === '') {
    v = legacyFallback;
  }
  if (v === null || v === undefined || v === '') {
    return '';
  }
  var n = Number(v);
  if (n >= 1 && n <= 5) {
    return n;
  }
  return '';
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }
  writeHeaders_(sheet);
}

function writeHeaders_(sheet) {
  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
}

/**
 * Wipe all feedback rows and reset headers (for testing).
 *
 * Run manually — not called by the web app:
 * 1. Open the Sheet → Extensions → Apps Script.
 * 2. Select wipeFeedbackSheetForTesting in the function dropdown.
 * 3. Run → authorize if prompted → check Execution log for "Sheet wiped".
 *
 * Alternative (no script): in the Sheet, select every row (click row numbers),
 * right-click → Delete rows. Then delete row 1 (old headers) so the sheet is
 * completely empty; the next form submission recreates the header row.
 */
function wipeFeedbackSheetForTesting() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  writeHeaders_(sheet);
  Logger.log('Sheet wiped. %s columns: %s', HEADERS.length, HEADERS.join(' | '));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
