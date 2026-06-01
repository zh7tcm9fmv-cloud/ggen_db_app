/**
 * GGen site feedback → Google Sheets receiver
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
 * Each POST appends one row. Headers are written automatically on first submission.
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
  'Tool usage (Damage sim / Team builder)',
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
      payload.overall || '',
      payload.navigation || '',
      payload.visual_design || '',
      payload.content_quality || '',
      payload.page_speed || '',
      payload.mobile_experience || '',
      payload.functionality || '',
      payload.tool_usage || payload.trust || '',
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

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
