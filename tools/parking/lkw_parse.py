"""Parse LKW WALTER Liste_Parkplaetze.pdf into rows using text positions.
usage: python -I lkw_parse.py <pdf> <out.json>"""
import json, re, sys
from pypdf import PdfReader

pdf, out = sys.argv[1], sys.argv[2]
HEAD = ['Country code', 'Zip Code', 'City', 'Street', 'Longitude', 'Latitude', 'Name', 'Additional Info', 'Google Link']
rows = []
last_cols = {}
for page in PdfReader(pdf).pages:
    items = []
    def visit(text, cm, tm, font, size):
        t = text.strip()
        if t:
            x = tm[4]
            y = tm[5]
            items.append((round(y, 1), x, t))
    page.extract_text(visitor_text=visit)
    # header column x positions
    cols = {}
    for y, x, t in items:
        for h in HEAD:
            if t.startswith(h) and h not in cols:
                cols[h] = x
    if 'Longitude' not in cols:
        cols = dict(last_cols)
    if 'Longitude' not in cols:
        continue
    last_cols = dict(cols)
    order = sorted(cols.items(), key=lambda kv: kv[1])
    def col_of(x):
        best = order[0][0]
        for h, cx in order:
            if x >= cx - 3:
                best = h
        return best
    heads = [y for y, x, t in items if t.startswith('Country')]
    head_y = max(heads) if heads else 10 ** 6
    # group by line (y), top to bottom
    lines = {}
    for y, x, t in items:
        if y >= head_y - 1:
            continue
        lines.setdefault(y, []).append((x, t))
    cur = None
    for y in sorted(lines, reverse=True):
        cells = {}
        for x, t in sorted(lines[y]):
            c = col_of(x)
            cells[c] = (cells.get(c, '') + ' ' + t).strip()
        link = cells.get('Google Link', '')
        m = re.search(r'q=(-?[\d.]+),(-?[\d.]+)', link)
        has_coords = re.match(r'^-?\d+\.\d+$', cells.get('Longitude', '')) and re.match(r'^-?\d+\.\d+$', cells.get('Latitude', ''))
        if has_coords or m:
            cur = {k: cells.get(k, '') for k in HEAD}
            if has_coords:
                cur['lon'], cur['lat'] = float(cells['Longitude']), float(cells['Latitude'])
            else:
                cur['lat'], cur['lon'] = float(m.group(1)), float(m.group(2))
            rows.append(cur)
        elif cur:  # continuation line: append wrapped text
            for k in ('City', 'Street', 'Name', 'Additional Info'):
                if cells.get(k):
                    cur[k] = (cur[k] + ' ' + cells[k]).strip()
            if cells.get('Country code') and not cur['Country code']:
                cur['Country code'] = cells['Country code']
json.dump(rows, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print(len(rows), dict(Counter(r['Country code'] for r in rows)))
