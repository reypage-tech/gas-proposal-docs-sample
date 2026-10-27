const t = require('node:test'); const a = require('node:assert');
const load = require('./load'); const M = require('./mocks'); const { sheet, services, dump, P, LI, TABLE } = M;
const DEALS = [['DealId', 'ClientName', 'ServiceType', 'Address', 'ContactEmail'],
  ['D-1001', 'Sample Survey Co', 'Site survey', '100 Example St', 'contact@example.com'],
  ['D-1002', '', 'Boundary survey', '200 Example Ave', ''],
  ['D-1003', 'Demo Clinic', 'Carpet', '300 Example Rd', 'bad-address'],
  ['D-1001', 'Dup Co', 'Site survey', '', ''], ['', '', '', '', '']];
const LINES = [['DealId', 'Item', 'Qty', 'UnitPrice'], ['D-1001', 'Visit', 4, 150], ['D-1001', 'Supplies', 1, 99.5], ['D-1003', 'Room', 2, 80]];
function setup(opts = {}) {
  const c = load(); const svc = services(opts);
  const sh = { Deals: sheet(opts.deals || DEALS), LineItems: sheet(LINES), Log: sheet([['At', 'Done', 'Skipped', 'Failed']]) };
  svc.Sheets = { getActive: () => ({ getSheetByName: n => sh[n] }) };
  const col = name => sh.Deals.values[0].indexOf(name);
  const cell = (r, name) => sh.Deals.values[r][col(name)];
  const docOf = r => svc.files[c.driveId(cell(r, 'DocUrl'))];
  return { c, svc, sh, col, cell, docOf };
}
const live = svc => Object.values(svc.files).filter(f => !f.trashed);

t('full run: docs, pdfs, write-back, skips', () => {
  const { c, svc, sh, cell } = setup();
  a.deepStrictEqual({ ...c.runAll(svc) }, { done: 2, skipped: 2, failed: 0 });
  a.strictEqual(cell(1, 'Status'), 'Done'); a.match(cell(1, 'DocUrl'), /docs\.google\.com\/document\/d\//); a.match(cell(1, 'PdfUrl'), /drive\.google\.com\/file/);
  a.strictEqual(cell(2, 'Status'), 'Skipped'); a.strictEqual(cell(2, 'Note'), 'Missing: ClientName'); a.strictEqual(cell(2, 'DocUrl'), undefined);
  a.strictEqual(cell(4, 'Note'), 'Duplicate DealId D-1001');
  a.strictEqual(cell(5, 'Status'), undefined, 'blank row untouched');
  a.strictEqual(sh.Log.appended.length, 1);
});
t('placeholders filled, tag-only paragraph replaced by table, template untouched', () => {
  const { c, svc, docOf } = setup(); c.runAll(svc);
  const d = dump(docOf(1).body);
  a.deepStrictEqual(d, ['Dear Sample Survey Co, Site survey at 100 Example St. Total $699.50 on 2026-10-28.',
    'T: Item\tQty\tUnit price\tAmount\tVisit\t4\t$150.00\t$600.00\tSupplies\t1\t$99.50\t$99.50']);
  a.match(svc.files[M.TEMPLATE_ID].body.getText(), /\{\{ClientName\}\}/);
});
t('dates use the script time zone', () => {
  const x = setup({ tz: 'America/New_York' }); x.c.runAll(x.svc); a.strictEqual(x.cell(1, 'UpdatedAt'), '2026-10-27 11:30');
  const y = setup({ tz: 'Asia/Tokyo' }); y.c.runAll(y.svc); a.strictEqual(y.cell(1, 'UpdatedAt'), '2026-10-28 00:30');
});

// (4) tag position
t('tag sharing a paragraph: only the tag text goes, table right after', () => {
  const { c, svc, docOf } = setup({ template: [P('Costs: {{LineItems}} see below'), P('End')] }); c.runAll(svc);
  const d = dump(docOf(1).body);
  a.strictEqual(d[0], 'Costs:  see below'); a.match(d[1], /^T: Item/); a.strictEqual(d[2], 'End');
});
t('tag inside a table cell: table goes after the outer table', () => {
  const { c, svc, docOf } = setup({ template: [P('Top'), TABLE([['Costs', '{{LineItems}}']]), P('End')] }); c.runAll(svc);
  const d = dump(docOf(1).body);
  a.strictEqual(d[1], 'T: Costs\t'); a.match(d[2], /^T: Item/); a.strictEqual(d[3], 'End');
});
t('tag inside a list item that holds only the tag: replaced', () => {
  const { c, svc, docOf } = setup({ template: [P('Top'), LI('{{LineItems}}'), P('End')] }); c.runAll(svc);
  const d = dump(docOf(1).body); a.strictEqual(d.length, 3); a.match(d[1], /^T: Item/);
});
t('tag inside a list item with other text: tag removed, table after', () => {
  const { c, svc, docOf } = setup({ template: [LI('Costs {{LineItems}}'), P('End')] }); c.runAll(svc);
  const d = dump(docOf(1).body); a.strictEqual(d[0], '* Costs '); a.match(d[1], /^T: Item/);
});
// (5) no tag
t('no {{LineItems}} tag: table at the end and a note', () => {
  const { c, svc, docOf, cell } = setup({ template: [P('Hi {{ClientName}}')] }); c.runAll(svc);
  const d = dump(docOf(1).body); a.match(d[d.length - 1], /^T: Item/);
  a.strictEqual(cell(1, 'Note'), 'No {{LineItems}} tag, added at the end');
});

// (2) order of operations
t('makeCopy fails on rerun: old Doc and PDF remain untouched', () => {
  const x = setup(); x.c.runAll(x.svc);
  const doc = x.docOf(1), pdf = x.svc.files[x.c.driveId(x.cell(1, 'PdfUrl'))]; const before = dump(doc.body).join('|');
  x.svc.files[M.TEMPLATE_ID].makeCopy = () => { throw new Error('makeCopy failed'); };
  x.c.runAll(x.svc);
  a.strictEqual(x.cell(1, 'Status'), 'Error'); a.strictEqual(x.cell(1, 'Note'), 'makeCopy failed');
  a.strictEqual(doc.trashed, false); a.strictEqual(pdf.trashed, false); a.strictEqual(dump(doc.body).join('|'), before);
});
t('PDF fails on rerun: old Doc and PDF remain, working copy trashed', () => {
  const x = setup(); x.c.runAll(x.svc);
  const doc = x.docOf(1), before = dump(doc.body).join('|'); const pdfId = x.c.driveId(x.cell(1, 'PdfUrl'));
  const tm = x.svc.files[M.TEMPLATE_ID], orig = tm.makeCopy; const made = [];
  tm.makeCopy = nm => { const f = orig(nm); f.getAs = () => { throw new Error('PDF export failed'); }; made.push(f); return f; };
  x.c.runAll(x.svc);
  a.strictEqual(x.cell(1, 'Status'), 'Error'); a.strictEqual(x.cell(1, 'Note'), 'PDF export failed'); a.ok(made.every(f => f.trashed)); a.strictEqual(dump(doc.body).join('|'), before); a.strictEqual(x.svc.files[pdfId].trashed, false);
});
t('new pdf is created before the old one is trashed', () => {
  const x = setup(); x.c.runAll(x.svc); x.svc.log.length = 0; x.c.runAll(x.svc);
  const i = x.svc.log.indexOf('pdf'), j = x.svc.log.findIndex(e => /^trash:.*\.pdf$/.test(e));
  a.ok(i >= 0 && j > i, x.svc.log.join(','));
});

// (3) same URL on rerun
t('rerun keeps the same Doc URL and refreshes its content', () => {
  const x = setup(); x.c.runAll(x.svc);
  const url = x.cell(1, 'DocUrl'); const doc = x.docOf(1);
  x.sh.Deals.values[1][x.col('Address')] = '999 New St';
  x.c.runAll(x.svc);
  a.strictEqual(x.cell(1, 'DocUrl'), url); a.strictEqual(doc.trashed, false);
  a.match(dump(doc.body)[0], /999 New St/); a.strictEqual(dump(doc.body).length, 2);
  const docs = live(x.svc).filter(f => /^Proposal/.test(f.name) && !f.isPdf);
  a.strictEqual(docs.length, 2, 'working copies trashed');
});
t('rerun without Advanced Drive: new PDF URL, old PDF trashed', () => {
  const x = setup(); x.c.runAll(x.svc); const p1 = x.cell(1, 'PdfUrl'); x.c.runAll(x.svc);
  a.notStrictEqual(x.cell(1, 'PdfUrl'), p1); a.strictEqual(x.svc.files[x.c.driveId(p1)].trashed, true);
  a.strictEqual(x.svc.pdfs.filter(p => !p.trashed).length, 2);
});
t('rerun with Advanced Drive: same PDF URL, content replaced', () => {
  const x = setup({ adv: true }); x.c.CONFIG.USE_ADVANCED_DRIVE = true; x.c.runAll(x.svc);
  const p1 = x.cell(1, 'PdfUrl'); x.sh.Deals.values[1][x.col('Address')] = '999 New St'; x.c.runAll(x.svc);
  a.strictEqual(x.cell(1, 'PdfUrl'), p1); a.match(x.svc.files[x.c.driveId(p1)].content, /999 New St/);
  a.strictEqual(x.svc.pdfs.length, 2, 'no extra pdf files');
});
t('DocUrl pointing to a deleted file: a new Doc is made', () => {
  const x = setup(); x.sh.Deals.values[1][4] = 'contact@example.com';
  x.sh.Deals.values[0].push('DocUrl'); x.sh.Deals.values[1].push('https://docs.google.com/document/d/gone123456/edit');
  x.c.runAll(x.svc); a.strictEqual(x.cell(1, 'Status'), 'Done'); a.doesNotMatch(x.cell(1, 'DocUrl'), /gone/);
});

// posting fields: lists, images, checkboxes
const RICH_HEAD = ['DealId', 'ClientName', 'ServiceType', 'SurveyAreas', 'SurveyImages', 'Included', 'Excluded', 'Orthogonal', 'TrueGeometry'];
const RICH_TMPL = () => [P('Areas'), P('{{List:SurveyAreas}}'), P('{{Image:SurveyImages}}'), P('Included'), P('{{List:Included}}'),
  P('Excluded'), P('{{List:Excluded}}'), P('{{Check:Orthogonal}} Orthogonal  {{Check:TrueGeometry}} True geometry'), P('{{LineItems}}')];
function rich(row, opts = {}) { return setup({ deals: [RICH_HEAD, row], template: RICH_TMPL(), ...opts }); }
t('bullet lists from newline or ; separated cells', () => {
  const x = rich(['D-1001', 'Sample Co', 'Survey', 'North lot\n- South lot', 'x', 'Topo plan; Boundary plan', '', 'yes', 'no']);
  x.c.runAll(x.svc); const d = dump(x.docOf(1).body);
  a.deepStrictEqual(d.slice(0, 3), ['Areas', '* North lot', '* South lot']);
  a.ok(d.includes('* Topo plan') && d.includes('* Boundary plan'));
  a.strictEqual(x.docOf(1).body.children[1].glyph, 'BULLET');
  a.strictEqual(d[d.indexOf('Excluded') + 1], '☑ Orthogonal  ☐ True geometry', 'empty list removes its tag line');
});
t('checkbox values', () => {
  a.deepStrictEqual(['TRUE', 'x', '☑', 'Yes', '', 'no', 'false', null].map(v => load().checkMark(v)), ['☑', '☑', '☑', '☑', '☐', '☐', '☐', '☐']);
});
t('images from Drive IDs and URLs, scaled to IMAGE_WIDTH; bad ones noted', () => {
  const x = rich(['D-1001', 'Sample Co', 'Survey', '', 'img00000001\nhttps://drive.google.com/file/d/img00000002/view;https://drive.google.com/open?id=missing0003;??', '', '', '', ''],
    { images: ['img00000001', 'img00000002'] });
  x.c.runAll(x.svc); const b = x.docOf(1).body; const imgs = b.children.filter(e => e.blob);
  a.deepStrictEqual(imgs.map(e => e.blob.id), ['img00000001', 'img00000002']); a.strictEqual(imgs[0].w, 450);
  a.match(x.cell(1, 'Note'), /SurveyImages image missing0003 not found/); a.match(x.cell(1, 'Note'), /item 4 is not a Drive ID or URL/);
  a.strictEqual(x.cell(1, 'Status'), 'Done');
});
t('rich doc survives rerun with same URL', () => {
  const x = rich(['D-1001', 'Sample Co', 'Survey', 'A\nB', '', '', '', 'x', '']);
  x.c.runAll(x.svc); const u = x.cell(1, 'DocUrl'); const first = dump(x.docOf(1).body); x.c.runAll(x.svc);
  a.strictEqual(x.cell(1, 'DocUrl'), u); a.deepStrictEqual(dump(x.docOf(1).body), first);
});

t('no drafts unless CREATE_DRAFT', () => { const { c, svc } = setup(); c.runAll(svc); a.strictEqual(svc.drafts.length, 0); });
t('drafts only, never sends; bad email flagged', () => {
  const { c, svc, cell } = setup(); c.CONFIG.CREATE_DRAFT = true; c.runAll(svc);
  a.strictEqual(svc.drafts.length, 1); a.strictEqual(svc.drafts[0].to, 'contact@example.com'); a.match(svc.drafts[0].body, /\$699\.50/);
  a.strictEqual(cell(1, 'Note'), 'Draft created'); a.strictEqual(cell(3, 'Note'), 'Draft not made: no valid ContactEmail');
});
