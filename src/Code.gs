/**
 * Proposal generator: one Deals row -> copy of a Google Docs template -> PDF in a Drive folder.
 * Writes DocUrl, PdfUrl, Status, Note, UpdatedAt back to the row.
 * Optional: creates a Gmail draft for the contact (draft only, never sent).
 * Dates are read and written in the script time zone (Session.getScriptTimeZone()).
 */
var CONFIG = {
  SHEET: 'Deals',
  LINES_SHEET: 'LineItems',
  LOG_SHEET: 'Log',
  TEMPLATE_ID: 'PUT_TEMPLATE_DOC_ID_HERE',
  FOLDER_ID: 'PUT_OUTPUT_FOLDER_ID_HERE',
  TAX_RATE: 0,
  CURRENCY: '$',
  CREATE_DRAFT: false, // posting does not mention email; draft only, never sent
  USE_ADVANCED_DRIVE: false, // true keeps the same PDF URL on rerun (needs the Advanced Drive service)
  IMAGE_WIDTH: 450,
  REQUIRED: ['DealId', 'ClientName', 'ServiceType'],
  OUTPUT_COLS: ['DocUrl', 'PdfUrl', 'Status', 'Note', 'UpdatedAt']
};

function fillPlaceholders(text, values) {
  return String(text).replace(/\{\{(\w+)\}\}/g, function (m, k) { return values[k] == null ? m : String(values[k]); });
}
function missingFields(row) {
  return CONFIG.REQUIRED.filter(function (k) { return row[k] == null || String(row[k]).trim() === ''; });
}
function round2(n) { return Math.round(n * 100) / 100; }
function calcTotals(lines, taxRate) {
  var sub = round2(lines.reduce(function (s, l) { return s + Number(l.Qty) * Number(l.UnitPrice); }, 0));
  var tax = round2(sub * (taxRate || 0));
  return { subtotal: sub, tax: tax, total: round2(sub + tax) };
}
function badLines(lines) {
  return lines.filter(function (l) {
    return String(l.Item || '').trim() === '' || !isFinite(Number(l.Qty)) || Number(l.Qty) <= 0 ||
      String(l.UnitPrice).trim() === '' || !isFinite(Number(l.UnitPrice)) || Number(l.UnitPrice) < 0;
  }).length;
}
function money(n) { return CONFIG.CURRENCY + Number(n).toFixed(2); }
function docName(row) { return 'Proposal - ' + row.ClientName + ' (' + row.DealId + ')'; }

/** Values for {{Placeholder}} tags. Row columns plus computed fields. today is a Date; tz is the script time zone. */
function buildValues(row, totals, today, tz, fmt) {
  var v = {};
  Object.keys(row).forEach(function (k) { v[k] = row[k] instanceof Date ? fmt(row[k], tz, 'yyyy-MM-dd') : row[k]; });
  v.Subtotal = money(totals.subtotal);
  v.Tax = money(totals.tax);
  v.Total = money(totals.total);
  v.Today = fmt(today, tz, 'yyyy-MM-dd');
  return v;
}

/** Decide what to do with a row before touching Drive. Pure, testable. */
function planRow(row, lines) {
  var miss = missingFields(row);
  if (miss.length) return { status: 'Skipped', reason: 'Missing: ' + miss.join(', ') };
  if (!lines.length) return { status: 'Skipped', reason: 'No line items' };
  var bad = badLines(lines);
  if (bad) return { status: 'Skipped', reason: bad + ' line item(s) need Item, Qty > 0 and UnitPrice' };
  return { status: 'Ready', name: docName(row), totals: calcTotals(lines, CONFIG.TAX_RATE) };
}
/** Kept for the original API. */
function generateProposal(row, lines) { return planRow(row, lines); }

function rowsToObjects(values) {
  var head = values[0].map(String);
  return values.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  });
}
function groupLines(lineObjs) {
  var g = {};
  lineObjs.forEach(function (l) { var id = String(l.DealId || '').trim(); if (!id) return; (g[id] = g[id] || []).push(l); });
  return g;
}

/* ---- Block fields: tags replaced by a table, bullet list, images or a checkbox ---- */
var TAG_RE = /\{\{(\w+)(?::(\w+))?\}\}/g;
function splitList(v) {
  return String(v == null ? '' : v).split(/\r?\n|;/).map(function (x) { return x.replace(/^\s*[-*\u2022]\s*/, '').trim(); }).filter(String);
}
function driveId(v) {
  var s = String(v || '').trim(); var m = s.match(/\/d\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : (/^[\w-]{10,}$/.test(s) ? s : '');
}
function isChecked(v) { return /^(true|yes|y|1|x|on|checked|\u2611)$/i.test(String(v == null ? '' : v).trim()); }
function checkMark(v) { return isChecked(v) ? '\u2611' : '\u2610'; }

/** Scan template text for {{Kind:Column}} tags. Kinds: List, Image, Check. Pure. */
function blockTags(text) {
  var out = [], m; TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(String(text)))) if (m[2]) out.push({ tag: m[0], kind: m[1], col: m[2] });
  return out;
}
function elType(el) { return String(el.getType()); }
/** Find the body-level child that holds the tag, walking up through table cells and list items. */
function findAnchor_(body, tag) {
  var found = body.findText(tag.replace(/[{}]/g, '\\$&'));
  if (!found) return null;
  var para = found.getElement().getParent();
  var top = para;
  while (top.getParent() && elType(top.getParent()) !== 'BODY_SECTION') top = top.getParent();
  var onlyTag = top === para && String(para.getText()).trim() === tag;
  return { para: para, top: top, index: body.getChildIndex(top), onlyTag: onlyTag };
}
/** Put a block where the tag is. insert(at) inserts at a body index and returns how many elements it added;
 *  append() adds at the end. Returns a note when the tag was not found. */
function placeBlock_(body, tag, insert, append) {
  var a = findAnchor_(body, tag);
  if (!a) { append(); return 'No ' + tag + ' tag, added at the end'; }
  if (a.onlyTag) { insert(a.index); body.removeChild(a.para); }
  else { a.para.replaceText(tag.replace(/[{}]/g, '\\$&'), ''); insert(a.index + 1); }
  return '';
}
function lineTable(lines) {
  return [['Item', 'Qty', 'Unit price', 'Amount']].concat(lines.map(function (l) {
    return [String(l.Item), String(l.Qty), money(l.UnitPrice), money(Number(l.Qty) * Number(l.UnitPrice))];
  }));
}
function fillBlocks_(svc, body, row, lines, templateText) {
  var notes = [];
  var t = lineTable(lines);
  var n = placeBlock_(body, '{{LineItems}}', function (i) { body.insertTable(i, t); }, function () { body.appendTable(t); });
  if (n) notes.push(n);
  blockTags(templateText).forEach(function (b) {
    var v = row[b.col];
    if (b.kind === 'Check') { body.replaceText(b.tag.replace(/[{}]/g, '\\$&'), checkMark(v)); return; }
    if (b.kind === 'List') {
      var items = splitList(v);
      if (!items.length) { placeBlock_(body, b.tag, function () {}, function () {}); return; }
      placeBlock_(body, b.tag, function (i) {
        items.forEach(function (x, k) { body.insertListItem(i + k, x).setGlyphType(svc.Glyph); });
      }, function () {});
      return;
    }
    if (b.kind === 'Image') {
      var ids = splitList(v).map(driveId);
      var blobs = [];
      ids.forEach(function (id, k) {
        if (!id) { notes.push(b.col + ' item ' + (k + 1) + ' is not a Drive ID or URL'); return; }
        try { blobs.push(svc.Drive.getFileById(id).getBlob()); } catch (e) { notes.push(b.col + ' image ' + id + ' not found'); }
      });
      placeBlock_(body, b.tag, function (i) {
        blobs.forEach(function (bl, k) { var img = body.insertImage(i + k, bl); if (CONFIG.IMAGE_WIDTH && img.setWidth) scaleImage_(img); });
      }, function () {});
    }
  });
  return notes;
}
function scaleImage_(img) {
  var w = img.getWidth(), h = img.getHeight();
  if (w > CONFIG.IMAGE_WIDTH) { img.setWidth(CONFIG.IMAGE_WIDTH); img.setHeight(Math.round(h * CONFIG.IMAGE_WIDTH / w)); }
}
/** Replace everything in target body with copies of the source body's elements. */
function copyBody_(src, dst) {
  dst.clear();
  var n = src.getNumChildren();
  for (var i = 0; i < n; i++) {
    var el = src.getChild(i).copy(), t = elType(el);
    if (t === 'TABLE') dst.appendTable(el);
    else if (t === 'LIST_ITEM') dst.appendListItem(el);
    else if (t === 'PARAGRAPH') dst.appendParagraph(el);
  }
  if (dst.getNumChildren() > 1 && elType(dst.getChild(0)) === 'PARAGRAPH' && dst.getChild(0).getText() === '') dst.removeChild(dst.getChild(0));
}

/** Google side. svc = { Sheets, Drive, Docs, Mail, DriveAdv?, Glyph, tz, now, fmt } so tests can pass mocks.
 *  Order: build a filled working copy and its PDF first. Old files are only changed or trashed after both succeed. */
function makeDoc(svc, row, lines, plan, values) {
  var folder = svc.Drive.getFolderById(CONFIG.FOLDER_ID);
  var docId = driveId(row.DocUrl), pdfId = driveId(row.PdfUrl);
  var existing = null;
  if (docId) { try { existing = svc.Docs.openById(docId); } catch (e) { existing = null; } }

  var tmplText = svc.Docs.openById(CONFIG.TEMPLATE_ID).getBody().getText();
  var work = svc.Drive.getFileById(CONFIG.TEMPLATE_ID).makeCopy(existing ? plan.name + ' (working)' : plan.name, folder);
  try {
    return finishDoc_(svc, row, lines, plan, values, folder, work, existing, docId, pdfId, tmplText);
  } catch (e) {
    try { work.setTrashed(true); } catch (e2) { /* ignore */ } // old Doc and PDF were not touched
    throw e;
  }
}
function finishDoc_(svc, row, lines, plan, values, folder, work, existing, docId, pdfId, tmplText) {
  var d = svc.Docs.openById(work.getId());
  var body = d.getBody();
  Object.keys(values).forEach(function (k) {
    if (k.charAt(0) === '_') return;
    body.replaceText('\\{\\{' + k + '\\}\\}', String(values[k] == null ? '' : values[k]).replace(/\$/g, '\\$'));
  });
  var notes = fillBlocks_(svc, body, row, lines, tmplText);
  d.saveAndClose();

  var blob = work.getAs('application/pdf').setName(plan.name + '.pdf');
  var pdfFile, pdfUrl, oldPdf = null;
  if (pdfId && CONFIG.USE_ADVANCED_DRIVE && svc.DriveAdv) {
    svc.DriveAdv.Files.update({}, pdfId, blob); // same PDF URL
    pdfFile = svc.Drive.getFileById(pdfId);
  } else {
    pdfFile = folder.createFile(blob);
    if (pdfId) { try { oldPdf = svc.Drive.getFileById(pdfId); } catch (e) { oldPdf = null; } }
  }
  pdfUrl = pdfFile.getUrl();

  // Both new Doc content and PDF exist now. Only from here are old files touched.
  var docUrl;
  if (existing) {
    copyBody_(svc.Docs.openById(work.getId()).getBody(), existing.getBody());
    existing.saveAndClose();
    work.setTrashed(true);
    docUrl = svc.Drive.getFileById(docId).getUrl();
  } else {
    docUrl = work.getUrl();
  }
  if (oldPdf && oldPdf.getId() !== pdfFile.getId()) oldPdf.setTrashed(true);
  return { docUrl: docUrl, pdfUrl: pdfUrl, pdf: pdfFile, notes: notes };
}

function draftEmail(svc, row, plan, pdf) {
  if (!CONFIG.CREATE_DRAFT) return null;
  var to = String(row.ContactEmail || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return 'Draft not made: no valid ContactEmail';
  svc.Mail.createDraft(to, 'Proposal for ' + row.ServiceType + ' (' + row.DealId + ')',
    'Hello,\n\nPlease find our proposal attached. Total: ' + money(plan.totals.total) + '.\n',
    { attachments: [pdf.getBlob ? pdf.getBlob() : pdf] });
  return 'Draft created';
}

function runAll(svc) {
  var ss = svc.Sheets.getActive();
  var sh = ss.getSheetByName(CONFIG.SHEET);
  var data = sh.getDataRange().getValues();
  var head = data[0].map(String);
  CONFIG.OUTPUT_COLS.forEach(function (c) { if (head.indexOf(c) < 0) { head.push(c); sh.getRange(1, head.length).setValue(c); } });
  var lines = groupLines(rowsToObjects(ss.getSheetByName(CONFIG.LINES_SHEET).getDataRange().getValues()));
  var rows = rowsToObjects(data);
  var stamp = svc.fmt(svc.now(), svc.tz, 'yyyy-MM-dd HH:mm');
  var seen = {};
  var summary = { done: 0, skipped: 0, failed: 0 };
  rows.forEach(function (row) {
    if (!String(row.DealId || '').trim() && !String(row.ClientName || '').trim()) return; // blank row
    var id = String(row.DealId || '').trim();
    var out = { Status: '', Note: '', UpdatedAt: stamp };
    var plan = seen[id] ? { status: 'Skipped', reason: 'Duplicate DealId ' + id } : planRow(row, lines[id] || []);
    if (id) seen[id] = true;
    if (plan.status === 'Skipped') {
      out.Status = 'Skipped'; out.Note = plan.reason; summary.skipped++;
    } else {
      try {
        var r = makeDoc(svc, row, lines[id], plan, buildValues(row, plan.totals, svc.now(), svc.tz, svc.fmt));
        out.DocUrl = r.docUrl; out.PdfUrl = r.pdfUrl; out.Status = 'Done';
        var dn = draftEmail(svc, row, plan, r.pdf);
        out.Note = r.notes.concat(dn ? [dn] : []).join('; ');
        summary.done++;
      } catch (e) {
        out.Status = 'Error'; out.Note = String(e && e.message || e); summary.failed++;
      }
    }
    Object.keys(out).forEach(function (k) { sh.getRange(row._row, head.indexOf(k) + 1).setValue(out[k]); });
  });
  var log = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (log) log.appendRow([stamp, summary.done, summary.skipped, summary.failed]);
  return summary;
}

/* ---- Apps Script entry points (not exercised by the local tests) ---- */
function appsScriptServices_() {
  return {
    Sheets: { getActive: function () { return SpreadsheetApp.getActiveSpreadsheet(); } },
    Drive: DriveApp,
    DriveAdv: typeof Drive !== 'undefined' ? Drive : null, // Advanced Drive service, only if enabled
    Docs: DocumentApp,
    Glyph: DocumentApp.GlyphType.BULLET,
    Mail: GmailApp,
    tz: Session.getScriptTimeZone(),
    now: function () { return new Date(); },
    fmt: function (d, tz, p) { return Utilities.formatDate(d, tz, p); }
  };
}
function generateProposals() { return runAll(appsScriptServices_()); }
function onOpen() { SpreadsheetApp.getUi().createMenu('Proposals').addItem('Generate proposals', 'generateProposals').addToUi(); }

if (typeof module !== 'undefined') module.exports = {
  CONFIG: CONFIG, fillPlaceholders: fillPlaceholders, missingFields: missingFields, calcTotals: calcTotals, badLines: badLines,
  docName: docName, buildValues: buildValues, planRow: planRow, generateProposal: generateProposal,
  rowsToObjects: rowsToObjects, splitList: splitList, driveId: driveId, isChecked: isChecked, checkMark: checkMark, blockTags: blockTags, groupLines: groupLines, runAll: runAll
};
