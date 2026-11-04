"""Second pass: from wall/apartment rasters derive massing outlines, roofs, cornices,
parapets, cores, terraces and room assignment. Writes data/floors.json for the website.

Note: plan images (assets/plans/floor-N.webp) and their bounds (work/plan_meta.json)
are rendered from the same PDFs with PyMuPDF at 2.5x zoom, clip X -2.5..74, Y -3..45.8 m.
"""
import json, sys, os, math
import numpy as np
import cv2
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.ops import unary_union

S = sys.argv[1]
OUTJ = sys.argv[2]
raw = json.load(open(f'{S}/floors_raw.json'))

ROOM_UZ = {
    'Кухня': 'kitchen', 'Спальня': 'bedroom', 'Зал': 'living', 'Холл': 'hall', 'Душ': 'bath',
    'Балкон': 'balcony', 'С/у': 'wc', 'C/y': 'wc', 'Терасса': 'terrace', 'Терраса': 'terrace',
    'Склад': 'storage', 'Кладовка': 'storage', 'Гардероб': 'wardrobe',
}

# obvious typos in the drawings (label vs. sum of rooms) -> corrected area
FIX = {
    # floors 3-5 top-left flat is labelled 98.00 but has the same rooms (67.8 m2) as the 68.00 flat on floors 2,6,7
}


def r2(v):
    return round(float(v), 2)


def poly_to_list(p, nd=2):
    return [[round(x, nd), round(y, nd)] for x, y in list(p.exterior.coords)[:-1]]


def mp_iter(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [x for x in getattr(g, 'geoms', []) if isinstance(x, Polygon)]


def contours_to_polys(mask, rc_to_m, eps=1.0, min_area=4):
    cnts, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    polys = []
    if hier is None:
        return polys
    hier = hier[0]
    for i, c in enumerate(cnts):
        if hier[i][3] != -1 or cv2.contourArea(c) < min_area:
            continue
        outer = rc_to_m(cv2.approxPolyDP(c, eps, True)[:, 0, :])
        holes = []
        j = hier[i][2]
        while j != -1:
            hc = cnts[j]
            if cv2.contourArea(hc) > min_area:
                holes.append(rc_to_m(cv2.approxPolyDP(hc, eps, True)[:, 0, :]))
            j = hier[j][0]
        if len(outer) < 3:
            continue
        p = Polygon(outer, [h for h in holes if len(h) >= 3]).buffer(0)
        polys += mp_iter(p)
    return polys


def orthogonalize(g):
    out = []
    for p in mp_iter(g):
        pts = list(p.exterior.coords)[:-1]
        n = len(pts)
        # snap nearly axis-aligned edges: average coordinate
        pts = [list(q) for q in pts]
        for it in range(3):
            for i in range(n):
                a = pts[i]; b = pts[(i + 1) % n]
                dx, dy = b[0] - a[0], b[1] - a[1]
                if abs(dy) < 0.25 * max(abs(dx), 1e-6) or abs(dy) < 0.12:
                    m = (a[1] + b[1]) / 2; a[1] = m; b[1] = m
                elif abs(dx) < 0.25 * max(abs(dy), 1e-6) or abs(dx) < 0.12:
                    m = (a[0] + b[0]) / 2; a[0] = m; b[0] = m
        q = Polygon(pts).buffer(0).simplify(0.02)
        out += mp_iter(q)
    return unary_union(out)


floors_out = []
for f in raw:
    fl = f['floor']
    z = np.load(f'{S}/raster_{fl}.npz')
    walls = z['walls'].astype(np.uint8)
    lab = z['lab']
    ter = np.load(f'{S}/ter_{fl}.npy')
    X0 = float(z['X0']); Y1 = float(z['Y1']); PX = float(z['px'])
    H, W = walls.shape

    def rc_to_m(pts):
        pts = np.asarray(pts, float).reshape(-1, 2)
        return np.stack([pts[:, 0] / PX + X0, Y1 - pts[:, 1] / PX], 1)

    def m_to_rc(X, Y):
        return int(round((X - X0) * PX)), int(round((Y1 - Y) * PX))

    # ---------- footprint from walls: bridge window gaps (<= 3.2 m) along walls, fill holes
    L = int(3.2 * PX)
    kh = cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1))
    kv = cv2.getStructuringElement(cv2.MORPH_RECT, (1, L))
    ch = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kh)
    cvv = cv2.morphologyEx(walls, cv2.MORPH_CLOSE, kv)
    bridged = np.maximum(np.maximum(ch, cvv), (lab > 0).astype(np.uint8))
    # fill holes
    ff = bridged.copy()
    mask = np.zeros((H + 2, W + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 2)
    F = (ff != 2).astype(np.uint8)
    F = cv2.morphologyEx(F, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
    outside = (F == 0)
    outside_d = cv2.dilate(outside.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0

    # ---------- openings: gap pixels bridged along a wall that touch the outside
    openings = []
    for gap, orient in ((ch & (1 - walls), 'h'), (cvv & (1 - walls), 'v')):
        n, cc, stats, cent = cv2.connectedComponentsWithStats(gap.astype(np.uint8), 8)
        for i in range(1, n):
            x, y, w, h, a = stats[i]
            if orient == 'h':
                length, depth = w / PX, h / PX
            else:
                length, depth = h / PX, w / PX
            if not (0.5 <= length <= 3.25 and 0.12 <= depth <= 0.8):
                continue
            comp = cc[y:y + h, x:x + w] == i
            touch_out = outside_d[y:y + h, x:x + w][comp].mean()
            # also must border the inside (F) on the other side
            if touch_out < 0.02:
                continue
            # outward normal: which side is outside
            if orient == 'h':
                yc = y + h / 2; xa, xb = x, x + w
                above = outside[max(0, y - 4):y, x + w // 2].mean() if y > 4 else 1
                below = outside[y + h:min(H, y + h + 4), x + w // 2].mean() if y + h + 4 < H else 1
                if above == below:
                    continue
                n_ = (0, 1) if above > below else (0, -1)  # meters: Y up => row-up is +Y
                p1 = rc_to_m([[xa, yc]])[0]; p2 = rc_to_m([[xb, yc]])[0]
            else:
                xc = x + w / 2; ya, yb = y, y + h
                left = outside[y + h // 2, max(0, x - 4):x].mean() if x > 4 else 1
                right = outside[y + h // 2, x + w:min(W, x + w + 4)].mean() if x + w + 4 < W else 1
                if left == right:
                    continue
                n_ = (-1, 0) if left > right else (1, 0)
                p1 = rc_to_m([[xc, ya]])[0]; p2 = rc_to_m([[xc, yb]])[0]
            # wall face positions (outer face)
            if orient == 'h':
                faces = rc_to_m([[x, y], [x, y + h]])[:, 1]
            else:
                faces = rc_to_m([[x, y], [x + w, y]])[:, 0]
            openings.append(dict(a=[r2(p1[0]), r2(p1[1])], b=[r2(p2[0]), r2(p2[1])], n=list(n_), d=r2(depth),
                                 f=[r2(min(faces)), r2(max(faces))], o=orient))

    # ---------- balconies: apartment fill outside footprint
    fillany = (lab > 0)
    bal = fillany & outside
    bal = cv2.morphologyEx(bal.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, cc, stats, _ = cv2.connectedComponentsWithStats(bal, 8)
    balconies = []
    for i in range(1, n):
        if stats[i][4] < 0.4 * PX * PX:
            continue
        comp = (cc == i).astype(np.uint8)
        comp = cv2.morphologyEx(comp, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        for p in contours_to_polys(comp, rc_to_m, eps=1.5):
            balconies.append(p)
    # terraces (open, on top of the floor below)
    terraces = []
    if ter.any():
        tm = cv2.morphologyEx((ter > 0).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        terraces = contours_to_polys(tm, rc_to_m, eps=1.5)

    # ---------- footprint polygon(s): remove thin protrusions (balconies) and notches
    k1 = cv2.getStructuringElement(cv2.MORPH_RECT, (int(1.1 * PX), int(1.1 * PX)))
    Fc = cv2.morphologyEx(F, cv2.MORPH_OPEN, k1)
    Fc = cv2.morphologyEx(Fc, cv2.MORPH_CLOSE, k1)
    fp_polys = contours_to_polys(Fc, rc_to_m, eps=0.12 * PX, min_area=10 * PX * PX)
    fp = unary_union(fp_polys)
    fp = orthogonalize(fp)
    np.save(f'{S}/F_{fl}.npy', Fc)
    wall_polys = contours_to_polys(walls, rc_to_m, eps=0.8, min_area=6)

    # ---------- apartments
    apts = []
    # --- reassign room labels using the raw label rasters (more robust than closed masks)
    allrooms = {}
    for a in f['apartments']:
        for r in a['rooms']:
            allrooms[(r['name'], r['x'], r['y'])] = r
    assign = {i: [] for i in range(len(f['apartments']))}
    for r in allrooms.values():
        c_, r_ = m_to_rc(r['x'], r['y'])
        found = None
        for rad in (0, 4, 8, 14, 22, 32):
            y0, y1_ = max(0, r_ - rad), min(H, r_ + rad + 1)
            x0, x1_ = max(0, c_ - rad), min(W, c_ + rad + 1)
            for src_ in (lab, ter):
                win = src_[y0:y1_, x0:x1_]
                v = win[win > 0]
                if v.size:
                    vals, cnt = np.unique(v, return_counts=True)
                    found = int(vals[cnt.argmax()]) - 1
                    break
            if found is not None:
                break
        if found is not None:
            assign[found].append(r)
    for i, a in enumerate(f['apartments']):
        a['rooms'] = assign[i]

    for i, a in enumerate(f['apartments']):
        blk = [l for l in a['labels'] if not l['red']]
        red = [l for l in a['labels'] if l['red']]
        if not blk:
            print('WARN no black label', fl, a['labels'])
            continue
        area = float(blk[0]['t'])
        areaT = float(red[0]['t']) if red else None
        # room assignment: rooms inside raw fill of this apartment (nearest raw fill)
        rooms = [r for r in a['rooms']]
        rs = sum(r['area'] or 0 for r in rooms if r['name'] not in ('Терасса',))
        note = None
        if fl in (3, 4, 5) and area == 98.0 and abs(rs - 67.8) < 1:
            note = 'label 98.00 in drawing corrected to 68.00 (rooms sum 67.8 m2, same flat as floors 2/6/7)'
            area = 68.0
        poly = unary_union([Polygon(p).buffer(0) for p in a['polys'] if len(p) >= 3])
        poly = poly.buffer(0.12, join_style=2).buffer(-0.12, join_style=2).simplify(0.04)
        commercial = (fl == 1 and area > 200)
        nb = sum(1 for r in rooms if r['name'] == 'Спальня')
        nl = sum(1 for r in rooms if r['name'] == 'Зал')
        lx = blk[0]['x']; ly = blk[0]['y']
        rp = poly.representative_point()
        apts.append(dict(
            area=area, areaT=areaT, color=a['color'], commercial=commercial,
            rooms=nb + nl if not commercial else 0,
            polys=[poly_to_list(p) for p in mp_iter(poly)],
            ter=[], label=[r2(lx), r2(ly)], c=[r2(poly.centroid.x), r2(poly.centroid.y)],
            list=[dict(n=ROOM_UZ.get(r['name'], r['name']), a=(round(r['area'] / 10, 2) if (r['area'] and r['name'] == 'Балкон' and r['area'] > 15) else r['area']), x=r2(r['x']), y=r2(r['y'])) for r in rooms],
            note=note))
    # terraces belong to apartments: attach by nearest
    for t in terraces:
        best, bd = None, 1e9
        for ap in apts:
            g = unary_union([Polygon(p) for p in ap['polys']])
            d = g.distance(t)
            if d < bd:
                bd, best = d, ap
        if best is not None and bd < 1.5:
            best['ter'].append(poly_to_list(t))

    # sort apartments for stable numbering: by wing then position
    apts.sort(key=lambda a: (round(-a['c'][1] / 4), a['c'][0]))
    for k, a in enumerate(apts):
        a['id'] = f'{fl}-{k + 1:02d}'

    def plist(g):
        out = []
        for p in mp_iter(g):
            out.append(dict(o=poly_to_list(p), h=[[[r2(x), r2(y)] for x, y in list(h.coords)[:-1]] for h in p.interiors]))
        return out

    # cores / common areas: footprint minus apartments
    aptm = cv2.dilate((lab > 0).astype(np.uint8), np.ones((15, 15), np.uint8))
    common = ((Fc > 0) & (aptm == 0)).astype(np.uint8)
    common = cv2.morphologyEx(common, cv2.MORPH_OPEN, np.ones((25, 25), np.uint8))
    cores = [p for p in contours_to_polys(common, rc_to_m, eps=0.1 * PX, min_area=12 * PX * PX)]
    fo = dict(floor=fl, apartments=apts, cores=[poly_to_list(p) for p in cores], fpGeom=fp, walls=[dict(o=poly_to_list(p), h=[[[r2(x), r2(y)] for x, y in list(h.coords)[:-1]] for h in p.interiors]) for p in wall_polys],
              footprint=plist(fp.simplify(0.05)),
              terraces=[poly_to_list(p) for p in terraces])
    floors_out.append(fo)
    nverts = sum(len(w['o']) + sum(len(h) for h in w['h']) for w in fo['walls'])
    print(f'floor {fl}: apts {len(apts)} openings {len(openings)} balconies {len(balconies)} terraces {len(terraces)} '
          f'footprint parts {len(fo["footprint"])} fp verts {[len(p["o"]) for p in fo["footprint"]]} wall verts {nverts}')

    # debug image
    dbg = np.full((H, W, 3), 255, np.uint8)
    dbg[F > 0] = (225, 225, 225)
    dbg[walls > 0] = (40, 40, 40)
    for o in openings:
        a_ = m_to_rc(*o['a']); b_ = m_to_rc(*o['b'])
        cv2.line(dbg, a_, b_, (0, 0, 255), 6)
        mid = ((a_[0] + b_[0]) // 2, (a_[1] + b_[1]) // 2)
        cv2.line(dbg, mid, (mid[0] + int(o['n'][0] * 25), mid[1] - int(o['n'][1] * 25)), (255, 0, 0), 3)
    for p in balconies:
        pts = np.array([m_to_rc(x, y) for x, y in poly_to_list(p)], np.int32)
        cv2.fillPoly(dbg, [pts], (80, 200, 80))
    for p in terraces:
        pts = np.array([m_to_rc(x, y) for x, y in poly_to_list(p)], np.int32)
        cv2.fillPoly(dbg, [pts], (200, 160, 60))
    for p in mp_iter(fp):
        pts = np.array([m_to_rc(x, y) for x, y in poly_to_list(p)], np.int32)
        cv2.polylines(dbg, [pts], True, (255, 0, 255), 3)
    cv2.imwrite(f'{S}/dbg_geom_{fl}.png', cv2.resize(dbg, (W // 2, H // 2)))

# massing: floors 1-7 share floor 3 outline; 8, 9 are clipped to it
typ = floors_out[2]['fpGeom']
for fo in floors_out:
    g = fo.pop('fpGeom')
    if fo['floor'] <= 7:
        m = typ
    else:
        parts = [p for p in mp_iter(g) if p.area > 30]
        m = typ.intersection(unary_union(parts).buffer(0.3, join_style=2))
        m = unary_union([p for p in mp_iter(m.buffer(-0.05, join_style=2).buffer(0.05, join_style=2)) if p.area > 30])
    fo['mass'] = plist(m.simplify(0.03))
    print('mass', fo['floor'], [len(p['o']) for p in fo['mass']], round(m.area, 1), 'cores', len(fo['cores']), [round(Polygon(c).area,1) for c in fo['cores']])
# roofs, crown cornices and parapets
masses = []
for fo in floors_out:
    masses.append(unary_union([Polygon(p['o'], p['h']).buffer(0) for p in fo['mass']]))
for i, fo in enumerate(floors_out):
    M = masses[i]
    up = masses[i + 1] if i + 1 < len(masses) else Polygon()
    R = M.difference(up.buffer(-0.01)) if not up.is_empty else M
    R = unary_union([p for p in mp_iter(R.buffer(-0.02, join_style=2).buffer(0.02, join_style=2)) if p.area > 2])
    fo['roof'] = plist(R.simplify(0.02)) if not R.is_empty else []
    belt = M.buffer(0.14, join_style=2).difference(M.buffer(-0.03, join_style=2))
    fo['belt'] = plist(belt.simplify(0.02))
    if not R.is_empty:
        crown = R.buffer(0.42, join_style=2).difference(R.buffer(-0.03, join_style=2))
        if not up.is_empty:
            crown = crown.difference(up.buffer(0.02, join_style=2))
        crown = unary_union([p for p in mp_iter(crown) if p.area > 0.3])
        par = R.difference(R.buffer(-0.28, join_style=2))
        if not up.is_empty:
            par = par.difference(up.buffer(0.35, join_style=2))
        par = unary_union([p for p in mp_iter(par) if p.area > 0.3])
        fo['crown'] = plist(crown.simplify(0.02))
        fo['parapet'] = plist(par.simplify(0.02))
    else:
        fo['crown'] = []; fo['parapet'] = []
    print('roof', fo['floor'], round(R.area, 1), 'crown parts', len(fo['crown']), 'parapet parts', len(fo['parapet']))
plan_meta = json.load(open(f'{S}/plan_meta.json'))
for fo in floors_out:
    fo['plan'] = plan_meta[str(fo['floor'])]
json.dump(dict(version=1, units='m', axes=dict(cols={k: v for k, v in []}), floors=floors_out), open(OUTJ, 'w'), ensure_ascii=False, separators=(',', ':'))
print('size', os.path.getsize(OUTJ))
