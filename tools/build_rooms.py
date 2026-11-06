"""Room segmentation for furnishing.

Splits every apartment into rooms using the wall raster (door openings are bridged),
matches the room labels from the drawings, and stores for each apartment a list `rg` of rooms:
  poly  - room outline (m)                         -> floor finish
  r     - largest inscribed axis-aligned rectangle  -> furniture layout
  s     - per side of r (S, E, N, W): [wall fraction, exterior fraction, door runs]

Usage: python3 tools/build_rooms.py work/ data/floors.json
"""
import json, sys
import numpy as np
import cv2

work, data_path = sys.argv[1], sys.argv[2]
raw = json.load(open(f'{work}/floors_raw.json'))
data = json.load(open(data_path))

TYPE = {'Кухня': 'kitchen', 'Спальня': 'bedroom', 'Зал': 'living', 'Холл': 'hall', 'Душ': 'bath', 'Балкон': 'balcony',
        'С/у': 'wc', 'C/y': 'wc', 'Терасса': 'terrace', 'Терраса': 'terrace', 'Склад': 'storage', 'Кладовка': 'storage'}


def max_rect(mask):
    """largest axis-aligned rectangle of ones -> (r0, c0, r1, c1) inclusive-exclusive"""
    h, w = mask.shape
    heights = np.zeros(w, int)
    best = (0, None)
    for r in range(h):
        heights = np.where(mask[r], heights + 1, 0)
        stack = []
        for c in range(w + 1):
            hc = heights[c] if c < w else 0
            start = c
            while stack and stack[-1][1] >= hc:
                s, hh = stack.pop()
                area = hh * (c - s)
                if area > best[0]:
                    best = (area, (r - hh + 1, s, r + 1, c))
                start = s
            stack.append((start, hc))
    return best[1]


for f, fo in zip(raw, data['floors']):
    fl = fo['floor']
    z = np.load(f'{work}/raster_{fl}.npz')
    W = z['walls'].astype(np.uint8)
    lab = z['lab']
    ter = np.load(f'{work}/ter_{fl}.npy')
    F = np.load(f'{work}/F_{fl}.npy').astype(bool)
    X0 = float(z['X0']); Y1 = float(z['Y1']); PX = float(z['px'])
    H, Wd = W.shape

    def m_to_rc(X, Y):
        return int(round((X - X0) * PX)), int(round((Y1 - Y) * PX))

    def rc_to_m(c, r):
        return c / PX + X0, Y1 - r / PX

    # bridge door openings (<= 1.05 m) in wall lines
    L = int(1.05 * PX)
    Wc = W | cv2.morphologyEx(W, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (L, 1))) \
           | cv2.morphologyEx(W, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, L)))
    Wc = cv2.dilate(Wc, np.ones((3, 3), np.uint8))

    # raw apartment index (lab value-1) -> final apartment (match by black label position)
    final_by_label = {(round(a['label'][0], 2), round(a['label'][1], 2)): a for a in fo['apartments']}
    stats = dict(rooms=0, labelled=0, split=0)
    for ri, ra in enumerate(f['apartments']):
        blk = [l for l in ra['labels'] if not l['red']]
        if not blk:
            continue
        key = (round(blk[0]['x'], 2), round(blk[0]['y'], 2))
        apt = final_by_label.get(key)
        if apt is None:
            print('no match', fl, key); continue
        labels = [dict(n=r['n'], a=r['a'], x=r['x'], y=r['y']) for r in apt['list']]
        rooms = []
        for src, val in ((lab, ri + 1), (ter, ri + 1)):
            A = (src == val)
            if not A.any():
                continue
            ys, xs = np.nonzero(A)
            r0, r1, c0, c1 = max(ys.min() - 30, 0), min(ys.max() + 31, H), max(xs.min() - 30, 0), min(xs.max() + 31, Wd)
            sub = A[r0:r1, c0:c1] & (Wc[r0:r1, c0:c1] == 0) if src is lab else A[r0:r1, c0:c1]
            sub = cv2.morphologyEx(sub.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
            n, cc, st, _ = cv2.connectedComponentsWithStats(sub, 4)
            comps = {}
            for k in range(1, n):
                if st[k][4] < 0.5 * PX * PX:
                    continue
                comps[k] = []
            for li, lb in enumerate(labels):
                c, r = m_to_rc(lb['x'], lb['y'])
                r -= r0; c -= c0
                found = None
                for rad in (0, 5, 10, 18, 28):
                    win = cc[max(0, r - rad):r + rad + 1, max(0, c - rad):c + rad + 1]
                    vals = [v for v in np.unique(win) if v in comps]
                    if vals:
                        found = vals[0]; break
                if found is not None:
                    comps[found].append(li)
            for k, lis in comps.items():
                mask = (cc == k)
                # small balcony labels next to a room must not claim part of it
                if len(lis) > 1:
                    keep = [i for i in lis if labels[i]['n'] not in ('balcony', 'terrace')]
                    if keep:
                        lis = keep
                parts = []
                if len(lis) <= 1:
                    parts.append((mask, lis[0] if lis else None))
                else:
                    # several labels in one region: split by nearest label
                    stats['split'] += 1
                    yy, xx = np.nonzero(mask)
                    pts = np.array([[m_to_rc(labels[i]['x'], labels[i]['y'])[0] - c0, m_to_rc(labels[i]['x'], labels[i]['y'])[1] - r0] for i in lis])
                    d = (xx[:, None] - pts[None, :, 0]) ** 2 + (yy[:, None] - pts[None, :, 1]) ** 2
                    own = d.argmin(1)
                    for j, li in enumerate(lis):
                        m2 = np.zeros_like(mask); m2[yy[own == j], xx[own == j]] = True
                        parts.append((m2, li))
                for m2, li in parts:
                    if m2.sum() < 0.5 * PX * PX:
                        continue
                    lb = labels[li] if li is not None else None
                    typ = lb['n'] if lb else ('terrace' if src is ter else 'other')
                    if typ == 'other' and m2.sum() < 1.5 * PX * PX:
                        continue
                    # outline
                    cnts, _ = cv2.findContours(m2.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    cnt = max(cnts, key=cv2.contourArea)
                    ap = cv2.approxPolyDP(cnt, 0.05 * PX, True)[:, 0, :]
                    poly = [[round(rc_to_m(x + c0, y + r0)[0], 2), round(rc_to_m(x + c0, y + r0)[1], 2)] for x, y in ap]
                    # inscribed rectangle on a 10 cm grid
                    s = 5
                    small = cv2.resize(m2.astype(np.uint8), (m2.shape[1] // s, m2.shape[0] // s), interpolation=cv2.INTER_AREA) >= 1
                    small = cv2.erode(small.astype(np.uint8), np.ones((2, 2), np.uint8)).astype(bool)
                    mr = max_rect(small)
                    if mr is None:
                        continue
                    rr0, cc0, rr1, cc1 = mr
                    x0, y1 = rc_to_m(cc0 * s + c0, rr0 * s + r0)
                    x1, y0 = rc_to_m(cc1 * s + c0, rr1 * s + r0)
                    # side analysis: S(y0) E(x1) N(y1) W(x0)
                    sides = []
                    for side in range(4):
                        if side in (0, 2):
                            length = x1 - x0
                        else:
                            length = y1 - y0
                        n_s = max(int(length / 0.05), 1)
                        wall = np.zeros(n_s, bool); ext = np.zeros(n_s, bool)
                        for i in range(n_s):
                            u = (i + 0.5) * length / n_s
                            hitw = False; exterior = False
                            for d in np.arange(0.0, 0.42, 0.04):
                                if side == 0: X, Y = x0 + u, y0 - d
                                elif side == 1: X, Y = x1 + d, y0 + u
                                elif side == 2: X, Y = x0 + u, y1 + d
                                else: X, Y = x0 - d, y0 + u
                                c, r = m_to_rc(X, Y)
                                if 0 <= r < H and 0 <= c < Wd and W[r, c]:
                                    hitw = True; break
                            for d in (0.6, 0.9, 1.3):
                                if side == 0: X, Y = x0 + u, y0 - d
                                elif side == 1: X, Y = x1 + d, y0 + u
                                elif side == 2: X, Y = x0 + u, y1 + d
                                else: X, Y = x0 - d, y0 + u
                                c, r = m_to_rc(X, Y)
                                if not (0 <= r < H and 0 <= c < Wd) or not F[r, c] or (ter[r, c] > 0):
                                    exterior = True; break
                            wall[i] = hitw; ext[i] = exterior
                        # openings = runs without wall (door, window, open plan)
                        runs = []
                        i = 0
                        while i < n_s:
                            if not wall[i]:
                                j = i
                                while j < n_s and not wall[j]:
                                    j += 1
                                if (j - i) * length / n_s >= 0.45:
                                    runs.append([round(i * length / n_s, 2), round(j * length / n_s, 2)])
                                i = j
                            else:
                                i += 1
                        sides.append([round(float(wall.mean()), 2), round(float(ext.mean()), 2), runs])
                    rooms.append(dict(n=typ, a=lb['a'] if lb else None, poly=poly,
                                      r=[round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)], s=sides))
                    stats['rooms'] += 1
                    stats['labelled'] += 1 if lb else 0
        apt['rg'] = rooms
    n_lbl = sum(len(a['list']) for a in fo['apartments'])
    print(f'floor {fl}: rooms {stats["rooms"]} labelled {stats["labelled"]} / labels {n_lbl}, split regions {stats["split"]}')

json.dump(data, open(data_path, 'w'), ensure_ascii=False, separators=(',', ':'))
