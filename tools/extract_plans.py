"""Extract floor-plan data (apartments, rooms, walls) from the Bahor AutoCAD PDFs.

Usage:  BAHOR_PDF_DIR=path/to/pdfs python3 tools/extract_plans.py work/
Then:   python3 tools/build_geometry.py work/ data/floors.json

The PDF file names (FILES below) map to floors 1..9 in order. Each apartment in the
drawings is an embedded image with a soft mask - those masks give exact apartment
shapes; the dark masks are walls. Output is in metres (X along axes 1->18, Y along A->L).
"""
import json, re, sys, os, math
import numpy as np
import pymupdf
import cv2

UP = os.environ.get('BAHOR_PDF_DIR', 'source/pdf/').rstrip('/') + '/'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
os.makedirs(OUT, exist_ok=True)

FILES = ['9221f6b6-01', 'ec474434-06_2', '4de85d7d-07_1', '149df8bd-08', '5a4c2da8-09_1',
         'd680c1a1-06', 'af1275c0-07', '3212dba7-12', '85f43798-09']

COLS = {}
_c = [0, 5830, 3670, 5700, 1560, 5540, 680, 6700, 3900, 4200, 3900, 6700, 680, 5540, 1560, 5700, 3670, 5830]
acc = 0
for i, d in enumerate(_c):
    acc += d
    COLS[str(i + 1)] = acc / 1000.0
ROWS = {}
_r = [('А', 0), ('Б', 6400), ('В', 3980), ('Г', 4200), ('Д', 2300), ('Е', 6700), ('Ж', 680), ('И', 7200), ('К', 4300), ('Л', 7200)]
acc = 0
for n, d in _r:
    acc += d
    ROWS[n] = acc / 1000.0
ROWS['A'] = 0.0  # latin A in drawings
# floors 6/7 use a broken font encoding for the axis letters
for k, v in {'"': 'А', 'ǌ': 'Б', 'Ǎ': 'В', 'ǎ': 'Г', 'Ǐ': 'Д', 'ǐ': 'Е', 'Ǒ': 'Ж', 'Ǔ': 'И', 'Ǖ': 'К', 'ǖ': 'Л'}.items():
    ROWS[k] = ROWS[v]

ROOM_NAMES = {'C/y', 'Кухня', 'Спальня', 'Зал', 'Холл', 'Душ', 'Балкон', 'С/у', 'Терасса', 'Терраса', 'Кладовка',
              'Склад', 'Гардероб', 'Прихожая', 'Коридор', 'Лоджия', 'Санузел', 'Ванная', 'Кабинет', 'Кладовая'}

PX_PER_M = 50.0  # wall raster resolution


def line_tokens(page):
    d = page.get_text('rawdict')
    toks = []
    for b in d['blocks']:
        for l in b.get('lines', []):
            spans = l['spans']
            if not spans:
                continue
            t = ''.join(''.join(c['c'] for c in s['chars']) for s in spans).replace('\x0f', '.').strip()
            if not t:
                continue
            s0 = spans[0]
            bb = l['bbox']
            toks.append(dict(t=t, size=round(s0['size'], 1), color=s0['color'], font=s0['font'],
                             bbox=bb, cx=(bb[0] + bb[2]) / 2, cy=(bb[1] + bb[3]) / 2, dir=l['dir']))
    return toks


def fit_grid(toks):
    xs, Xs, ys, Ys = [], [], [], []
    for t in toks:
        if t['size'] != 7.0 or t['font'] != 'ISOCPEUR':
            continue
        if t['t'] in COLS and t['cy'] > 700:
            xs.append(t['cx']); Xs.append(COLS[t['t']])
        elif t['t'] in ROWS and (t['cx'] < 120 or t['cx'] > 1120):
            ys.append(t['cy']); Ys.append(ROWS[t['t']])
    xs, Xs, ys, Ys = map(np.array, (xs, Xs, ys, Ys))
    # x = bx + s*X ; y = by - s*Y   (common scale)
    n1, n2 = len(xs), len(ys)
    A = np.zeros((n1 + n2, 3)); b = np.zeros(n1 + n2)
    A[:n1, 0] = Xs; A[:n1, 1] = 1; b[:n1] = xs
    A[n1:, 0] = -Ys; A[n1:, 2] = 1; b[n1:] = ys
    sol, res, *_ = np.linalg.lstsq(A, b, rcond=None)
    s, bx, by = sol
    err = np.abs(A @ sol - b).max()
    return s, bx, by, err


def main():
    floors = []
    for fi, name in enumerate(FILES):
        fl = fi + 1
        doc = pymupdf.open(UP + name + '.pdf')
        pg = doc[0]
        toks = line_tokens(pg)
        title = [t['t'] for t in toks if t['size'] > 15]
        assert any(f'{fl}го' in t for t in title), (name, title)
        s, bx, by, err = fit_grid(toks)
        print(f'floor {fl}: scale {s:.5f} pt/m  bx {bx:.2f} by {by:.2f} maxerr {err:.2f}pt')

        def to_m(x, y):
            return ((x - bx) / s, (by - y) / s)

        # ---------- images: apartment fills and wall masks
        apts_img, wall_imgs = [], []
        for info in pg.get_image_info(xrefs=True):
            if info['width'] < 60 or info['height'] < 60:
                continue
            xref = info['xref']
            ext = doc.extract_image(xref)
            sm = ext.get('smask')
            if not sm:
                continue
            pix = pymupdf.Pixmap(doc, xref)
            if pix.n != 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            msk = pymupdf.Pixmap(doc, sm)
            rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[..., :3]
            al = np.frombuffer(msk.samples, np.uint8).reshape(msk.height, msk.width)
            if al.shape != rgb.shape[:2]:
                al = cv2.resize(al, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_NEAREST)
            m = al > 0
            if m.sum() < 50:
                continue
            col = rgb[m].mean(0)
            sat = col.max() - col.min()
            bb = info['bbox']
            if bb[2] - bb[0] > 900:  # page background
                continue
            entry = dict(xref=xref, bbox=bb, mask=m, color=col, alpha=int(np.median(al[m])))
            if sat > 25:
                apts_img.append(entry)
            elif col.mean() < 90:
                wall_imgs.append(entry)
        print(f'  apt images {len(apts_img)}  wall images {len(wall_imgs)}')

        # ---------- build page-level rasters in meter space
        # extents in meters
        X0, X1, Y0, Y1 = -4.0, 76.0, -4.0, 47.0
        W = int((X1 - X0) * PX_PER_M); H = int((Y1 - Y0) * PX_PER_M)

        def raster_entry(e):
            """Warp an image mask (page bbox) into meter raster. returns uint8 HxW."""
            x0, y0, x1, y1 = e['bbox']
            h, w = e['mask'].shape
            # pixel (u,v) -> page (x0 + u*(x1-x0)/w, y0 + v*(y1-y0)/h) -> meter -> raster
            mx0, my0 = to_m(x0, y0)
            mx1, my1 = to_m(x1, y1)
            # raster coords: col = (X - X0)*PX, row = (Y1 - Y)*PX
            c0 = (mx0 - X0) * PX_PER_M; c1 = (mx1 - X0) * PX_PER_M
            r0 = (Y1 - my0) * PX_PER_M; r1 = (Y1 - my1) * PX_PER_M
            M = np.array([[(c1 - c0) / w, 0, c0], [0, (r1 - r0) / h, r0]], np.float32)
            out = cv2.warpAffine(e['mask'].astype(np.uint8) * 255, M, (W, H), flags=cv2.INTER_AREA)
            return out

        def rc_to_m(pts):
            pts = np.asarray(pts, float).reshape(-1, 2)
            return np.stack([pts[:, 0] / PX_PER_M + X0, Y1 - pts[:, 1] / PX_PER_M], 1)

        def m_to_rc(X, Y):
            return int(round((X - X0) * PX_PER_M)), int(round((Y1 - Y) * PX_PER_M))

        # walls
        wall = np.zeros((H, W), np.uint8)
        for e in wall_imgs:
            r = raster_entry(e)
            wall = np.maximum(wall, r)
        wall = (wall > 100).astype(np.uint8)

        # ---------- text classification
        totals = [t for t in toks if t['font'] == 'ISOCPEUR' and 9 <= t['size'] <= 11 and re.fullmatch(r'\d+\.\d+', t['t'])]
        names = [t for t in toks if t['color'] == 255 and t['font'].startswith('Arial') and t['t'] in ROOM_NAMES]
        nums = [t for t in toks if t['font'] == 'ISOCPEUR' and t['size'] < 6 and re.fullmatch(r'\d+(\.\d+)?', t['t'])]
        unknown_blue = sorted(set(t['t'] for t in toks if t['color'] == 255 and t['t'] not in ROOM_NAMES))
        print('  other blue texts:', unknown_blue)

        rooms = []
        used = set()
        for n in names:
            best, bd = None, 1e9
            for k, u in enumerate(nums):
                if k in used:
                    continue
                dy = u['cy'] - n['cy']
                dx = abs(u['cx'] - n['cx'])
                if -1 < dy < 10 and dx < 8:
                    d = dy + dx * 0.5
                    if d < bd:
                        bd, best = d, k
            area = None
            if best is not None:
                used.add(best)
                area = float(nums[best]['t'])
                if '.' not in nums[best]['t'] and area > 100:
                    area = None
            X, Y = to_m(n['cx'], n['cy'])
            rooms.append(dict(name=n['t'], area=area, x=round(X, 2), y=round(Y, 2), small=n['size'] < 5))

        # ---------- apartments
        apartments = []
        apt_mask_all = np.zeros((H, W), np.uint8)
        for e in apts_img:
            r = raster_entry(e)
            m = (r > 60).astype(np.uint8)
            if m.sum() < 30:
                continue
            # close interior wall gaps (<= ~0.35 m) and fill holes
            k = cv2.getStructuringElement(cv2.MORPH_RECT, (19, 19))
            mc = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
            # restrict closing so it does not jump through exterior walls: keep region inside walls+mask
            cnts, _ = cv2.findContours(mc, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            filled = np.zeros_like(mc)
            cv2.drawContours(filled, cnts, -1, 1, -1)
            polys = []
            for c in cnts:
                if cv2.contourArea(c) < 0.6 * PX_PER_M ** 2:
                    continue
                ap = cv2.approxPolyDP(c, 0.06 * PX_PER_M, True)
                pm = rc_to_m(ap[:, 0, :])
                polys.append([[round(float(a), 3), round(float(b), 3)] for a, b in pm])
            if not polys:
                continue
            col = e['color']
            # labels inside
            inside = []
            for t in totals:
                X, Y = to_m(t['cx'], t['cy'])
                c_, r_ = m_to_rc(X, Y)
                if 0 <= r_ < H and 0 <= c_ < W and filled[r_, c_]:
                    inside.append((t, X, Y))
            rin = []
            for rm in rooms:
                c_, r_ = m_to_rc(rm['x'], rm['y'])
                if 0 <= r_ < H and 0 <= c_ < W and filled[r_, c_]:
                    rin.append(rm)
            px_area = m.sum() / PX_PER_M ** 2
            e['raw'] = m
            apartments.append(dict(_raw=m, polys=polys, color='#%02x%02x%02x' % tuple(int(v) for v in col),
                                   labels=[dict(t=t['t'], red=t['color'] != 0, x=round(X, 2), y=round(Y, 2)) for t, X, Y in inside],
                                   rooms=rin, fillArea=round(float(px_area), 2), alpha=e['alpha']))
            apt_mask_all |= filled

        # balconies / terraces may be separate images of the same apartment -> merge images that
        # have no label into the nearest labelled apartment with the same color.
        labelled = [a for a in apartments if a['labels']]
        orphans = [a for a in apartments if not a['labels']]
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
        def geom(a):
            return unary_union([Polygon(p).buffer(0) for p in a['polys'] if len(p) >= 3])
        for o in orphans:
            ocent = np.array(o['polys'][0]).mean(0)
            is_ter = any(r['name'] in ('Терасса', 'Терраса', 'Балкон') for r in o['rooms']) or o['color'] == '#1fa355'
            if not o['rooms'] and o['fillArea'] > 150:
                print('  dropping large unlabeled region (roof?)', o['color'], o['fillArea'])
                o['merged'] = True
                continue
            og = geom(o)
            best, bd = None, 1e9
            for a in labelled:
                d = og.distance(geom(a))
                if d < bd:
                    bd, best = d, a
            if is_ter and best is not None and bd < 1.2:
                o['terrace'] = True
                best.setdefault('terraces', []).extend(o['polys'])
                best.setdefault('_ter', []).append(o['_raw'])
                best['rooms'] += o['rooms']
                o['merged'] = True
                continue
            if best is not None and bd < 0.3 and o['color'] == best['color']:
                best['polys'] += o['polys']
                best['rooms'] += o['rooms']
                best['fillArea'] += o['fillArea']
                best['_raw'] = np.maximum(best['_raw'], o['_raw'])
                o['merged'] = True
            else:
                print('  orphan apt image without label:', o['color'], ocent.round(2), o['fillArea'], [r['name'] for r in o['rooms']])
        apartments = [a for a in apartments if not a.get('merged')]
        multi = [a for a in apartments if len(a['labels']) > 1]
        for a in multi:
            print('  multi-label image:', [l['t'] for l in a['labels']])

        # rooms not in any apartment
        for rm in rooms:
            c_, r_ = m_to_rc(rm['x'], rm['y'])
            if not (0 <= r_ < H and 0 <= c_ < W and apt_mask_all[r_, c_]):
                rm['outside'] = True
        out_rooms = [r for r in rooms if r.get('outside')]

        # ---------- walls -> polygons with holes
        wk = cv2.morphologyEx(wall, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        cnts, hier = cv2.findContours(wk, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        walls = []
        if hier is not None:
            hier = hier[0]
            for i, c in enumerate(cnts):
                if hier[i][3] != -1:
                    continue  # hole
                if cv2.contourArea(c) < 4:
                    continue
                outer = rc_to_m(cv2.approxPolyDP(c, 1.0, True)[:, 0, :])
                holes = []
                j = hier[i][2]
                while j != -1:
                    hc = cnts[j]
                    if cv2.contourArea(hc) > 4:
                        holes.append(rc_to_m(cv2.approxPolyDP(hc, 1.0, True)[:, 0, :]))
                    j = hier[j][0]
                walls.append(dict(o=[[round(float(a), 3), round(float(b), 3)] for a, b in outer],
                                  h=[[[round(float(a), 3), round(float(b), 3)] for a, b in hh] for hh in holes]))

        # footprint = walls + apartments filled, closed
        fp = np.maximum(wk, apt_mask_all)
        fp = cv2.morphologyEx(fp, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25)))
        cnts, _ = cv2.findContours(fp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        footprint = []
        for c in cnts:
            if cv2.contourArea(c) < 20 * PX_PER_M ** 2:
                continue
            ap = cv2.approxPolyDP(c, 0.08 * PX_PER_M, True)
            footprint.append([[round(float(a), 3), round(float(b), 3)] for a, b in rc_to_m(ap[:, 0, :])])

        lab = np.zeros((H, W), np.int16)
        for i, a in enumerate(apartments):
            lab[a['_raw'] > 0] = i + 1
        ter = np.zeros((H, W), np.int16)
        for i, a in enumerate(apartments):
            for t in a.pop('_ter', []):
                ter[t > 0] = i + 1
        for a in apartments:
            a.pop('_raw', None)
        np.save(f'{OUT}/ter_{fl}.npy', ter)
        # terraces raster too
        np.savez_compressed(f'{OUT}/raster_{fl}.npz', walls=wk, lab=lab, X0=X0, Y1=Y1, px=PX_PER_M)
        cv2.imwrite(f'{OUT}/dbg_walls_{fl}.png', 255 - wk * 255)
        dbg = np.full((H, W, 3), 255, np.uint8)
        for a in apartments:
            colr = tuple(int(a['color'][i:i + 2], 16) for i in (5, 3, 1))
            for p in a['polys']:
                pts = np.array([m_to_rc(x, y) for x, y in p], np.int32)
                cv2.fillPoly(dbg, [pts], colr)
                cv2.polylines(dbg, [pts], True, (0, 0, 0), 2)
        dbg[wk > 0] = (40, 40, 40)
        for a in apartments:
            for l in a['labels']:
                cv2.putText(dbg, l['t'], m_to_rc(l['x'], l['y']), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255) if l['red'] else (0, 0, 0), 2)
        cv2.imwrite(f'{OUT}/dbg_apts_{fl}.png', cv2.resize(dbg, (W // 2, H // 2)))

        # ---------- rendered plan image (cropped to building)
        floors.append(dict(floor=fl, file=name, scale=s, bx=bx, by=by, apartments=apartments,
                           walls=walls, footprint=footprint, outsideRooms=out_rooms))
        print(f'  apartments {len(apartments)}: ' + ', '.join('/'.join(l['t'] for l in a['labels']) for a in apartments))
        print(f'  rooms {len(rooms)}  outside {len(out_rooms)}: ' + ', '.join(f"{r['name']}({r['area']})" for r in out_rooms))
        print(f'  walls polys {len(walls)}  footprint {len(footprint)} pts={[len(f) for f in footprint]}')

    with open(f'{OUT}/floors_raw.json', 'w') as f:
        json.dump(floors, f, ensure_ascii=False)


if __name__ == '__main__':
    main()
