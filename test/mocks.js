// Local mocks only. Nothing here talks to Google. A small element tree that mirrors DocumentApp.
function el(type, text, kids) {
  const e = { type, text: text || '', parent: null, children: [], glyph: null,
    getType: () => e.type, getParent: () => e.parent, getText: () => e.children.length ? e.children.map(c => c.getText()).join('\t') : e.text,
    getNumChildren: () => e.children.length, getChild: i => e.children[i],
    getChildIndex: c => { const i = e.children.indexOf(c); if (i < 0) throw new Error('Element is not a child'); return i; },
    replaceText: (re, rep) => { const r = new RegExp(re, 'g'); const out = rep.replace(/\\\$/g, '$');
      if (e.children.length) e.children.forEach(c => c.replaceText(re, rep)); else e.text = e.text.replace(r, () => out); return e; },
    copy: () => { const c = el(e.type, e.text, e.children.map(k => k.copy())); c.glyph = e.glyph; c.blob = e.blob; return c; },
    setGlyphType: g => { e.glyph = g; return e; } };
  (kids || []).forEach(k => { k.parent = e; e.children.push(k); });
  return e;
}
const P = t => el('PARAGRAPH', t);
const LI = t => el('LIST_ITEM', t);
const TABLE = cells => el('TABLE', '', cells.map(r => el('TABLE_ROW', '', r.map(c => el('TABLE_CELL', '', [typeof c === 'string' ? P(c) : c])))));
function body(kids) {
  const b = el('BODY_SECTION', '', kids);
  const add = (i, x) => { x.parent = b; b.children.splice(i, 0, x); return x; };
  b.insertTable = (i, c) => add(i, TABLE(c));
  b.insertListItem = (i, t) => add(i, LI(t));
  b.insertImage = (i, blob) => { const p = P('[img:' + blob.id + ']'); p.blob = blob; add(i, p);
    return { w: 1000, h: 500, getWidth() { return this.w; }, getHeight() { return this.h; }, setWidth(v) { this.w = v; p.w = v; }, setHeight(v) { this.h = v; } }; };
  b.removeChild = c => { b.children.splice(b.getChildIndex(c), 1); };
  b.appendTable = x => add(b.children.length, Array.isArray(x) ? TABLE(x) : x);
  b.appendListItem = x => add(b.children.length, typeof x === 'string' ? LI(x) : x);
  b.appendParagraph = x => add(b.children.length, typeof x === 'string' ? P(x) : x);
  b.clear = () => { b.children = []; add(0, P('')); };
  b.findText = re => { const r = new RegExp(re); let hit = null;
    const walk = n => { if (hit) return; if (!n.children.length && r.test(n.text) && n.type !== 'BODY_SECTION') { hit = n; return; } n.children.forEach(walk); };
    walk(b); return hit ? { getElement: () => ({ getParent: () => hit }) } : null; };
  b.getText = () => b.children.map(c => c.getText()).join('\n');
  return b;
}
// Flatten a body for assertions: one line per body child, with a marker for its type.
function dump(b) { return b.children.map(c => (c.type === 'LIST_ITEM' ? '* ' : c.type === 'TABLE' ? 'T: ' : '') + c.getText()); }

function sheet(values) {
  const v = values.map(r => r.slice()); const appended = [];
  return { values: v, appended,
    getDataRange: () => ({ getValues: () => v.map(r => r.slice()) }),
    getRange: (r, c) => ({ setValue: x => { while (v.length < r) v.push([]); v[r - 1][c - 1] = x; } }),
    appendRow: r => appended.push(r) };
}
const TEMPLATE_ID = 'PUT_TEMPLATE_DOC_ID_HERE';
function services(opts = {}) {
  const files = {}; let n = 0; const drafts = []; const pdfs = []; const log = [];
  const mkFile = (name, bodyKids, id) => { id = id || 'f' + (++n);
    const f = { id, name, trashed: false, body: body(bodyKids || []), content: null,
      getId: () => id, getUrl: () => (f.isPdf ? 'https://drive.google.com/file/d/' : 'https://docs.google.com/document/d/') + id + '/edit',
      makeCopy: (nm) => { if (opts.failCopy) throw new Error('makeCopy failed'); log.push('copy'); return mkFile(nm, f.body.children.map(c => c.copy())); },
      getAs: () => { if (opts.failPdf) throw new Error('PDF export failed'); return { content: dump(f.body).join('\n'), setName(nm) { this.name = nm; return this; } }; },
      getBlob: () => ({ id }),
      setTrashed: t => { f.trashed = t; log.push('trash:' + f.name); } };
    files[id] = f; return f; };
  const tmplKids = opts.template || [P('Dear {{ClientName}}, {{ServiceType}} at {{Address}}. Total {{Total}} on {{Today}}.'), P('{{LineItems}}')];
  mkFile('Template', tmplKids, TEMPLATE_ID);
  (opts.images || []).forEach(id => mkFile('img', [], id));
  const folder = { createFile: b => { const p = mkFile(b.name); p.isPdf = true; p.content = b.content; pdfs.push(p); log.push('pdf'); return p; } };
  const get = id => { const f = files[id]; if (!f || f.trashed) throw new Error('No item with id ' + id); return f; };
  const Drive = { getFolderById: () => folder, getFileById: get };
  const Docs = { openById: id => { const f = get(id); if (f.isPdf) throw new Error('not a doc'); return { getBody: () => f.body, saveAndClose: () => {} }; } };
  const DriveAdv = opts.adv ? { Files: { update: (res, id, blob) => { get(id).content = blob.content; log.push('update:' + id); } } } : null;
  const Mail = { createDraft: (to, subj, b, o) => drafts.push({ to, subj, body: b, o }), sendEmail: () => { throw new Error('send must never be called'); } };
  return { files, pdfs, drafts, log, Drive, Docs, DriveAdv, Mail, Glyph: 'BULLET', tz: opts.tz || 'Asia/Tokyo',
    now: () => opts.now || new Date('2026-10-27T15:30:00Z'),
    fmt: (d, tz, p) => { const s = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d); return p === 'yyyy-MM-dd' ? s.slice(0, 10) : s.slice(0, 16); } };
}
module.exports = { sheet, services, body, dump, P, LI, TABLE, TEMPLATE_ID };
