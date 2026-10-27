"""Builds fictional example proposals (HTML -> PDF -> PNG). All images are drawn here as SVG. No external assets."""
import random, html, base64, subprocess, os, glob

def uri(svg): return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()
def svg(w, h, body, bg='#fff'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" font-family="Arimo, Arial, sans-serif"><rect width="{w}" height="{h}" fill="{bg}"/>{body}</svg>'
def tag(t, x=10, y=None, h=None):
    return f'<rect x="{x-4}" y="{h-30}" width="{len(t)*6.6+12}" height="20" rx="3" fill="#000" opacity=".55"/><text x="{x+2}" y="{h-16}" font-size="11" fill="#fff">{t}</text>'

def logo(name, color):
    ini = ''.join(w[0] for w in name.split()[:2])
    return uri(svg(64, 64, f'<circle cx="32" cy="32" r="30" fill="{color}"/><path d="M14 42 L26 24 L34 34 L40 27 L50 42 Z" fill="#fff" opacity=".9"/><text x="32" y="56" font-size="9" fill="#fff" text-anchor="middle" font-weight="700">{ini}</text>', 'none'))

def aerial(seed, label):
    r = random.Random(seed); w, h = 640, 360; b = []
    b.append('<rect width="640" height="360" fill="#a9c58f"/>')
    for i in range(40):
        x, y = r.randint(0, w), r.randint(0, h); b.append(f'<circle cx="{x}" cy="{y}" r="{r.randint(8,22)}" fill="#7fa36a" opacity=".7"/>')
    b.append('<path d="M0 300 C200 280 420 330 640 290 L640 330 C420 370 200 320 0 340 Z" fill="#d8d2c4"/>')
    b.append('<polygon points="110,60 520,40 560,250 90,270" fill="#c7d9b0" stroke="#c0392b" stroke-width="3" stroke-dasharray="10 6"/>')
    b.append('<rect x="200" y="90" width="170" height="100" fill="#b9b4ab" stroke="#6d6a64" stroke-width="2"/><rect x="380" y="120" width="120" height="110" fill="#8e9aa3"/>')
    for i in range(9): b.append(f'<line x1="{388+i*13}" y1="125" x2="{388+i*13}" y2="160" stroke="#fff" stroke-width="1.5"/>')
    b.append('<text x="285" y="145" font-size="13" text-anchor="middle" fill="#333">Building A</text><text x="440" y="215" font-size="12" text-anchor="middle" fill="#fff">Parking</text>')
    b.append('<g transform="translate(600,50)"><polygon points="0,-22 8,8 0,2 -8,8" fill="#222"/><text y="24" font-size="12" text-anchor="middle" font-weight="700">N</text></g>')
    b.append('<g transform="translate(24,330)"><rect width="50" height="6" fill="#222"/><rect x="50" width="50" height="6" fill="#fff" stroke="#222"/><text y="-4" font-size="10">0</text><text x="92" y="-4" font-size="10">50 ft</text></g>')
    b.append(tag(label, 14, h=360))
    return uri(svg(w, h, ''.join(b)))

def photo(seed, label, kind='building'):
    r = random.Random(seed); w, h = 480, 320; b = []
    b.append('<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb8de"/><stop offset="1" stop-color="#dfeaf3"/></linearGradient>'
             '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9bb07a"/><stop offset="1" stop-color="#6f8a55"/></linearGradient></defs>')
    b.append('<rect width="480" height="210" fill="url(#s)"/><rect y="200" width="480" height="120" fill="url(#g)"/>')
    for i in range(3): b.append(f'<ellipse cx="{r.randint(40,440)}" cy="{r.randint(30,80)}" rx="{r.randint(30,60)}" ry="12" fill="#fff" opacity=".7"/>')
    if kind == 'building':
        face, side = r.choice([('#d9d2c5', '#b8b0a2'), ('#c9a98c', '#a88a6e'), ('#cfd6db', '#a9b3ba'), ('#e6dfcf', '#c4bca9')])
        floors = r.randint(2, 4); top = 210 - floors * 36 - 14
        flip = r.random() < .5; x0 = r.randint(70 if flip else 40, 160); bw = r.randint(180, 250)
        b.append(f'<rect x="{x0}" y="{top}" width="{bw}" height="{210-top}" fill="{face}" stroke="#8a8378"/>')
        sx = x0 - 50 if flip else x0 + bw
        b.append(f'<polygon points="{sx},{top+18 if flip else top} {sx+50},{top if flip else top+18} {sx+50},210 {sx},210" fill="{side}"/>')
        b.append(f'<rect x="{x0-4}" y="{top-6}" width="{bw+8}" height="7" fill="#6f6a63"/>')
        cols = max(4, bw // 40)
        for row in range(floors):
            for c in range(cols):
                x = x0 + 12 + c * (bw - 16) / cols; y = top + 14 + row * 36
                if row == floors - 1 and c == cols // 2: continue
                b.append(f'<rect x="{x:.0f}" y="{y:.0f}" width="{(bw-16)/cols-12:.0f}" height="20" fill="#5d7387" opacity=".85"/>')
        b.append(f'<rect x="{x0 + 12 + (cols//2) * (bw - 16) / cols:.0f}" y="176" width="26" height="34" fill="#4a3f35"/>')
        for i in range(r.randint(1, 3)):
            tx2 = r.choice([r.randint(10, max(11, x0 - 30)), r.randint(min(x0 + bw + 60, 470), 475)]); th = r.randint(40, 70)
            b.append(f'<rect x="{tx2-3}" y="{212-th//3}" width="6" height="{th//3}" fill="#6b4f36"/><ellipse cx="{tx2}" cy="{212-th//3-th//3}" rx="{th//3}" ry="{th//2.4:.0f}" fill="#5f8a4a"/>')
    elif kind == 'lot':  # parking lot seen from above-front
        b = ['<rect width="480" height="320" fill="#a9c7e3"/>',
             '<rect x="300" y="20" width="180" height="110" fill="#d4ccbf"/><rect x="300" y="14" width="180" height="8" fill="#6d6d6d"/>']
        for i in range(4):
            b.append(f'<rect x="{318+i*40}" y="40" width="24" height="30" fill="#6f8296"/>')
        b.append('<rect x="0" y="120" width="480" height="200" fill="#5e6266"/>')
        b.append('<rect x="0" y="110" width="300" height="12" fill="#7c9a5c"/><rect x="0" y="122" width="480" height="5" fill="#bdbdb5"/>')
        b.append('<rect x="0" y="205" width="480" height="40" fill="#55595d"/>')
        for i in range(12):
            b.append(f'<line x1="{20+i*40}" y1="135" x2="{20+i*40}" y2="200" stroke="#f2f2f2" stroke-width="2.5"/>')
            b.append(f'<line x1="{20+i*40}" y1="250" x2="{20+i*40}" y2="315" stroke="#f2f2f2" stroke-width="2.5"/>')
        for i in range(8):
            b.append(f'<rect x="{30+i*60}" y="223" width="26" height="3" fill="#e8c547"/>')
        cols = ['#b23b3b', '#3b5fb2', '#e8e8e8', '#2b2b2b', '#8a8f96']
        for x in [1, 3, 4, 7, 9]:
            c = cols[(x + seed) % 5]
            b.append(f'<rect x="{26+x*40}" y="145" width="28" height="48" rx="6" fill="{c}"/><rect x="{30+x*40}" y="153" width="20" height="10" rx="2" fill="#20262c" opacity=".7"/>')
        for x in [0, 2, 5, 6, 10]:
            c = cols[(x * 2 + seed) % 5]
            b.append(f'<rect x="{26+x*40}" y="260" width="28" height="48" rx="6" fill="{c}"/><rect x="{30+x*40}" y="290" width="20" height="10" rx="2" fill="#20262c" opacity=".7"/>')
        b.append('<polygon points="230,232 245,226 245,238" fill="#f2f2f2"/><rect x="200" y="230" width="30" height="4" fill="#f2f2f2"/>')
    elif kind == 'field':
        b.append('<path d="M0 230 L480 205 L480 320 L0 320Z" fill="#c9b98f"/>')
        for i in range(8): b.append(f'<line x1="{i*70}" y1="{232-i*3}" x2="{i*90-120}" y2="320" stroke="#b3a37a" stroke-width="2"/>')
    else:  # interior, varied per seed
        wall, side, floor = r.choice([('#e2ddd4', '#d6d0c5', '#b8a58a'), ('#dfe5e8', '#cbd3d8', '#9c8f80'), ('#ece4d6', '#ddd2bf', '#8f7a63'), ('#e6e6e1', '#d3d3cc', '#a7a49b')])
        L, R, T, B = r.randint(70, 130), r.randint(350, 410), r.randint(55, 85), r.randint(225, 250)
        b = [f'<rect width="480" height="320" fill="{side}"/><polygon points="0,0 480,0 {R},{T} {L},{T}" fill="#f7f5f1"/>',
             f'<polygon points="{L},{T} {R},{T} {R},{B} {L},{B}" fill="{wall}"/><polygon points="0,320 {L},{B} {R},{B} 480,320" fill="{floor}"/>',
             f'<polygon points="480,0 {R},{T} {R},{B} 480,320" fill="{side}" opacity=".85"/>']
        for i in range(r.randint(2, 4)):
            lx = L + 20 + i * (R - L - 40) / 3; b.append(f'<rect x="{lx:.0f}" y="{T-14}" width="34" height="6" fill="#fffbe8" stroke="#ccc"/>')
        dx = r.randint(L + 10, R - 60); b.append(f'<rect x="{dx}" y="{B-80}" width="40" height="80" fill="#8a6e52"/><circle cx="{dx+33}" cy="{B-40}" r="2" fill="#ddd"/>')
        for i in range(r.randint(0, 2)):
            wx = r.randint(L + 10, R - 70)
            if abs(wx - dx) > 60: b.append(f'<rect x="{wx}" y="{T+30}" width="60" height="50" fill="#a9c4dc" stroke="#fff" stroke-width="4"/>')
        if r.random() < .6: b.append(f'<line x1="0" y1="{B+20}" x2="{L}" y2="{B}" stroke="#777" stroke-width="2"/><rect x="10" y="{B-60}" width="50" height="70" fill="#9aa5ad" opacity=".8"/>')
    # tripod scanner
    tx = r.randint(330, 420)
    b.append(f'<g stroke="#333" stroke-width="3"><line x1="{tx}" y1="230" x2="{tx-18}" y2="290"/><line x1="{tx}" y1="230" x2="{tx+18}" y2="290"/><line x1="{tx}" y1="230" x2="{tx}" y2="292"/></g><rect x="{tx-9}" y="208" width="18" height="24" rx="3" fill="#e67e22"/>')
    b.append(tag(label, 14, h=320))
    return uri(svg(w, h, ''.join(b)))

def pointcloud(seed, label):
    r = random.Random(seed); w, h = 480, 320; b = []
    cols = ['#2c7bb6', '#00a6ca', '#00ccbc', '#90eb9d', '#f9d057', '#f29e2e', '#d7191c']
    for _ in range(2600):
        x = r.uniform(60, 420); base = 250 - (x - 60) * 0.15
        top = base - (130 if 120 < x < 330 else 20)
        y = r.uniform(top, base) if r.random() < .8 else r.uniform(base, 300)
        c = cols[min(6, int((300 - y) / 40))]
        b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.1" fill="{c}"/>')
    b.append(tag(label, 14, h=320))
    return uri(svg(w, h, ''.join(b), '#11161c'))

def floorplan(label, rooms):
    w, h = 480, 340; b = ['<g stroke="#222" stroke-width="4" fill="none"><rect x="40" y="30" width="400" height="240"/>'
        '<line x1="200" y1="30" x2="200" y2="170"/><line x1="40" y1="170" x2="300" y2="170"/><line x1="300" y1="170" x2="300" y2="270"/><line x1="320" y1="30" x2="320" y2="120"/></g>',
        '<g stroke="#222" stroke-width="1.2" fill="none"><path d="M200 120 A40 40 0 0 1 160 160"/><path d="M250 170 A40 40 0 0 0 290 210"/></g>',
        '<g stroke="#2e86c1" stroke-width="1"><line x1="40" y1="290" x2="440" y2="290"/><line x1="40" y1="284" x2="40" y2="296"/><line x1="440" y1="284" x2="440" y2="296"/></g><text x="240" y="305" font-size="11" text-anchor="middle" fill="#2e86c1">62\'-4"</text>']
    for (x, y, t) in rooms: b.append(f'<text x="{x}" y="{y}" font-size="12" text-anchor="middle" fill="#444">{t}</text>')
    b.append('<rect x="340" y="304" width="132" height="30" fill="#fff" stroke="#222"/><text x="348" y="316" font-size="9">SHEET A-101</text><text x="348" y="328" font-size="9">FLOOR PLAN</text>')
    b.append(f'<text x="44" y="22" font-size="11" fill="#666">{label}</text>')
    return uri(svg(w, h, ''.join(b)))

def elevation(label):
    w, h = 480, 340; b = ['<line x1="20" y1="260" x2="460" y2="260" stroke="#222" stroke-width="3"/>',
        '<polygon points="70,260 70,110 240,60 410,110 410,260" fill="none" stroke="#222" stroke-width="2.5"/>']
    for c in range(5):
        for rr in range(2):
            if rr == 1 and c == 2: continue
            b.append(f'<rect x="{95+c*62}" y="{130+rr*55}" width="34" height="36" fill="none" stroke="#222" stroke-width="1.5"/>')
    b.append('<rect x="222" y="215" width="36" height="45" fill="none" stroke="#222" stroke-width="2"/>')
    b.append('<g stroke="#2e86c1"><line x1="440" y1="60" x2="440" y2="260"/><line x1="434" y1="60" x2="446" y2="60"/><line x1="434" y1="260" x2="446" y2="260"/></g><text x="452" y="165" font-size="11" fill="#2e86c1" transform="rotate(-90 452 165)" text-anchor="middle">28\'-6"</text>')
    b.append(f'<text x="24" y="22" font-size="11" fill="#666">{label}</text><text x="24" y="300" font-size="10" fill="#444">SHEET A-201  SOUTH ELEVATION</text>')
    return uri(svg(w, h, ''.join(b)))

E = html.escape
def ul(items): return '<ul>' + ''.join(f'<li>{E(i)}</li>' for i in items) + '</ul>'
def imgs(lst, cls='g2'): return f'<div class="{cls}">' + ''.join(f'<figure><img src="{s}"><figcaption>{E(c)}</figcaption></figure>' for s, c in lst) + '</div>'
def money(n): return f'${n:,.2f}'
LABEL = 'Reproduction of how it looks in Google Docs (not generated in real Google)'

def page(d):
    sub = sum(q * p for _, q, p in d['lines']); tax = round(sub * d['tax'], 2); tot = sub + tax
    rows = ''.join(f'<tr><td>{E(i)}</td><td class="n">{q}</td><td class="n">{money(p)}</td><td class="n">{money(q*p)}</td></tr>' for i, q, p in d['lines'])
    ck = lambda v: '☑' if v else '☐'
    c = d['client']
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>{E(d["title"])}</title><style>
@page {{ size: Letter; margin: 0.9in 1in 0.9in 1in;
  @bottom-left {{ content: "{LABEL}"; font: 7.5pt Arimo, Arial, sans-serif; color: #888; }}
  @bottom-right {{ content: "Page " counter(page) " of " counter(pages); font: 8pt Arimo, Arial, sans-serif; color: #888; }} }}
* {{ box-sizing: border-box; }} .g2 > *, .g3 > *, .cols > * {{ min-width: 0; }}
body {{ font: 11pt/1.45 Arimo, Arial, "DejaVu Sans", sans-serif; color: #202124; margin: 0; }}
h1 {{ font-size: 26pt; font-weight: 400; margin: 0 0 4pt; color: {d["color"]}; }}
h2 {{ font-size: 15pt; font-weight: 400; color: {d["color"]}; margin: 18pt 0 6pt; border-bottom: 1px solid #dadce0; padding-bottom: 3pt; }}
h3 {{ font-size: 11.5pt; margin: 10pt 0 3pt; color: #3c4043; }}
ul {{ margin: 2pt 0 6pt; padding-left: 20pt; }} li {{ margin: 1.5pt 0; }}
.brk {{ break-before: page; }}
.cover-top {{ display: flex; align-items: center; gap: 12pt; margin-bottom: 26pt; }}
.cover-top img {{ width: 46pt; }} .co {{ font-size: 13pt; font-weight: 700; }} .co small {{ display: block; font-weight: 400; color: #5f6368; font-size: 9.5pt; }}
.hero {{ width: 100%; border-radius: 2pt; margin: 14pt 0; }}
.cards {{ display: flex; gap: 18pt; margin-top: 10pt; }} .card {{ flex: 1; border-left: 3pt solid {d["color"]}; padding: 2pt 0 2pt 10pt; font-size: 10pt; }}
.card b {{ display: block; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #5f6368; margin-bottom: 2pt; }}
.meta {{ color: #5f6368; font-size: 10pt; }}
.g2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin: 6pt 0; }} .g3 {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8pt; }}
figure {{ margin: 0; break-inside: avoid; }} figure img {{ width: 100%; display: block; border: 1px solid #dadce0; }} figcaption {{ font-size: 8.5pt; color: #5f6368; margin-top: 2pt; }}
.cols {{ display: flex; gap: 20pt; }} .cols > div {{ flex: 1; }}
.box {{ border: 1px solid #dadce0; padding: 6pt 10pt; }} .box h3 {{ margin-top: 2pt; }}
.chk {{ font-size: 11pt; margin: 4pt 0; }} .chk span {{ font-family: "DejaVu Sans", sans-serif; font-size: 13pt; margin-right: 5pt; }}
table {{ border-collapse: collapse; width: 100%; font-size: 10pt; margin-top: 4pt; }} th {{ background: {d["color"]}; color: #fff; text-align: left; font-weight: 700; padding: 5pt 7pt; }}
td {{ padding: 5pt 7pt; border-bottom: 1px solid #e0e0e0; }} .n {{ text-align: right; white-space: nowrap; }} th.n {{ text-align: right; }}
tr.sum td {{ border: none; padding: 3pt 7pt; }} tr.tot td {{ font-weight: 700; border-top: 2px solid #202124; font-size: 11pt; }}
.sig {{ display: flex; gap: 30pt; margin-top: 26pt; }} .sig div {{ flex: 1; border-top: 1px solid #5f6368; padding-top: 3pt; font-size: 9pt; color: #5f6368; }}
.note {{ font-size: 8.5pt; color: #888; margin-top: 16pt; }}
</style></head><body>
<!-- 1 Cover page contact details -->
<div class="cover-top"><img src="{logo(d["firm"], d["color"])}"><div class="co">{E(d["firm"])}<small>{E(d["firm_addr"])} · {E(d["firm_phone"])}</small></div></div>
<div class="meta">PROPOSAL {E(d["id"])} · {E(d["date"])}</div>
<h1>{E(d["title"])}</h1>
<div class="meta">{E(d["service"])}</div>
<img class="hero" src="{aerial(d["seed"], "Site overview (illustration)")}">
<div class="cards"><div class="card"><b>Prepared for</b>{E(c["contact"])}<br>{E(c["org"])}<br>{E(c["addr"])}<br>{E(c["email"])}<br>{E(c["phone"])}</div>
<div class="card"><b>Prepared by</b>{E(d["pm"])}<br>{E(d["firm"])}<br>{E(d["firm_email"])}<br>Valid until {E(d["valid"])}</div></div>
<!-- 2 Scope 3 Areas 4 Equipment -->
<h2 class="brk">Scope of work</h2><p>{E(d["scope"])}</p>
<h2>Areas to be surveyed</h2>{ul(d["areas"])}
{imgs([(pointcloud(d["seed"]+1, "Scan coverage (illustration)"), "Planned scan coverage"), (photo(d["seed"]+2, "Survey area (illustration)", d["kind2"]), d["areas"][0])])}
<h2>Equipment</h2>{ul(d["equip"])}
<!-- 5 Site photos 6 Deliverables 7 Plan sheets -->
<h2 class="brk">Site photos</h2>
{imgs([(photo(d["seed"]+10+i, f"Site photo {i+1} (illustration)", k), cap) for i, (k, cap) in enumerate(d["photos"])])}
<h2>Deliverables</h2>{ul(d["deliv"])}
<h2>Plan sheets included</h2>{ul(d["sheets"])}
<!-- 8 Deliverable examples 9 included/excluded 10 checkboxes -->
<h2 class="brk">Deliverable examples</h2>
{imgs([(floorplan("Example sheet (illustration)", d["rooms"]), "Floor plan sheet, example"), (elevation("Example sheet (illustration)"), "Elevation sheet, example")])}
<h2>Plan sheet details</h2>
<div class="cols"><div class="box"><h3>Included</h3>{ul(d["inc"])}</div><div class="box"><h3>Not included</h3>{ul(d["exc"])}</div></div>
<h3>Drawing options</h3>
<div class="chk"><span>{ck(d["ortho"])}</span>Orthogonal (walls drawn square and plumb)</div>
<div class="chk"><span>{ck(d["truegeo"])}</span>True geometry (walls drawn as measured)</div>
<!-- 11 Costs 12 Complimentary 13 Terms -->
<h2 class="brk">Project costs</h2>
<table><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr>{rows}
<tr class="sum"><td colspan="3" class="n">Subtotal</td><td class="n">{money(sub)}</td></tr>
<tr class="sum"><td colspan="3" class="n">Tax ({d["tax"]*100:g}%)</td><td class="n">{money(tax)}</td></tr>
<tr class="tot"><td colspan="3" class="n">Total</td><td class="n">{money(tot)}</td></tr></table>
<h2>Complimentary services</h2>{ul(d["comp"])}
<h2>Proposal-specific terms</h2>{ul(d["terms"])}
<div class="sig"><div>Accepted by (client) / date</div><div>{E(d["pm"])}, {E(d["firm"])} / date</div></div>
<p class="note">{LABEL}. All companies, people, addresses and images are fictional; images are simple illustrations drawn for this example.</p>
</body></html>'''

A = dict(id='D-1001', seed=11, color='#1a5e8a', firm='Bluestone Line Surveying (fictional)', firm_addr='400 Sample Ave, Suite 2, Exampleton', firm_phone='(555) 010-2000',
  firm_email='office@bluestone.example', pm='Project manager: J. Doe (fictional)', date='October 27, 2026', valid='November 26, 2026',
  title='Existing Conditions Survey', service='Laser scan survey and as-built drawings',
  client=dict(contact='A. Sample (fictional)', org='Harbor Example Properties LLC', addr='120 Example Street, Exampleton', email='a.sample@harbor.example', phone='(555) 010-3100'),
  scope='Laser scan the two-story office building and its parking lot, register the scans to site control, and prepare as-built floor plans and exterior elevations for the planned renovation.',
  areas=['Building A, floors 1 and 2 (about 18,000 sq ft)', 'Building exterior, all four sides', 'North parking lot and entrance drive'], kind2='building',
  equip=['Terrestrial laser scanner with color imaging', 'GNSS receiver for site control', 'Total station for control checks', 'Registration and drafting software'],
  photos=[('building', 'South entrance'), ('building', 'East side'), ('lot', 'North parking lot'), ('interior', 'Floor 1 lobby')],
  deliv=['Registered point cloud (E57 and RCP)', 'As-built floor plans, floors 1 and 2', 'Exterior elevations, four sides', 'Site control report'],
  sheets=['A-101 Floor 1 plan', 'A-102 Floor 2 plan', 'A-201 South and North elevations', 'A-202 East and West elevations'],
  rooms=[(120, 100, 'OFFICE 101'), (260, 100, 'CONF'), (380, 80, 'STOR'), (170, 225, 'LOBBY'), (370, 225, 'OFFICE 104')],
  inc=['Walls, doors and windows', 'Stairs and elevator shafts', 'Ceiling heights at room centers', 'Room names and numbers'],
  exc=['Furniture and equipment', 'Mechanical, electrical and plumbing', 'Above-ceiling spaces', 'Structural analysis'],
  ortho=True, truegeo=False, tax=0.0,
  lines=[('Field scanning (per day)', 2, 1850.0), ('Point cloud registration', 1, 950.0), ('Floor plan sheets', 2, 650.0), ('Elevation sheets', 2, 550.0), ('Site control', 1, 600.0)],
  comp=['One walk-through of the point cloud online', 'Minor drawing revisions within 30 days of delivery'],
  terms=['This proposal is valid until November 26, 2026.', '50% due at scheduling, balance on delivery.', 'Delivery about 3 weeks after field work.', 'Site access arranged by the client.'])

B = dict(id='D-1003', seed=37, color='#2f6b3f', firm='Meadowfield Geomatics (fictional)', firm_addr='88 Placeholder Road, Sampleville', firm_phone='(555) 010-4400',
  firm_email='hello@meadowfield.example', pm='Project lead: R. Roe (fictional)', date='October 27, 2026', valid='December 15, 2026',
  title='Interior As-Built Survey', service='Interior laser scan and true geometry plans',
  client=dict(contact='C. Example (fictional)', org='Demo Clinic Holdings Inc.', addr='300 Example Road, Sampleville', email='c.example@democlinic.example', phone='(555) 010-5200'),
  scope='Scan the interior of a two-floor clinic, including exam rooms and corridors, and prepare floor plans that show walls as measured for a fit-out design.',
  areas=['Floor 1 clinic space (about 9,500 sq ft)', 'Floor 2 offices (about 6,200 sq ft)', 'Main stair and corridors'], kind2='interior',
  equip=['Terrestrial laser scanner', 'Handheld laser distance meter', 'Registration and drafting software'],
  photos=[('interior', 'Floor 1 corridor'), ('interior', 'Exam room 3'), ('building', 'Front entrance'), ('interior', 'Floor 2 office')],
  deliv=['Registered point cloud (E57)', 'Floor plans with true geometry, floors 1 and 2', 'Reflected ceiling plan, floor 1'],
  sheets=['A-101 Floor 1 plan', 'A-102 Floor 2 plan', 'A-111 Floor 1 reflected ceiling plan'],
  rooms=[(120, 100, 'EXAM 1'), (260, 100, 'EXAM 2'), (380, 80, 'LAB'), (170, 225, 'WAITING'), (370, 225, 'RECEPTION')],
  inc=['Walls with measured angles', 'Doors with swing direction', 'Ceiling grid and light fixtures (floor 1)', 'Plumbing fixtures'],
  exc=['Exterior elevations', 'Site and parking', 'Medical equipment layout', 'Hidden utilities'],
  ortho=False, truegeo=True, tax=0.05,
  lines=[('Field scanning (per day)', 1, 1850.0), ('Point cloud registration', 1, 700.0), ('Floor plan sheets', 2, 650.0), ('Reflected ceiling plan', 1, 500.0)],
  comp=['Scan data stored for 12 months', 'One set of printed plans'],
  terms=['This proposal is valid until December 15, 2026.', 'Work is scheduled outside clinic hours.', 'Net 30 payment terms.', 'Delivery about 2 weeks after field work.'])

for slug, d in [('proposal_bluestone', A), ('proposal_meadowfield', B)]:
    open(f'{slug}.html', 'w').write(page(d))
    subprocess.run(['google-chrome', '--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={slug}.pdf', f'file://{os.path.abspath(slug)}.html'], check=True, capture_output=True)
    for f in glob.glob(f'{slug}-*.png'): os.remove(f)
    subprocess.run(['pdftoppm', '-png', '-r', '100', f'{slug}.pdf', slug], check=True)
print('ok')
