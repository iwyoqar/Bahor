"""Render the original floor drawings to WebP for the 2D plan viewer and gallery crops.

Usage (after tools/extract_plans.py):
    BAHOR_PDF_DIR=path/to/pdfs python3 tools/render_plans.py work/ assets/plans
Writes assets/plans/floor-N.webp and work/plan_meta.json (image bounds in metres).
"""
import json, os, sys
import pymupdf
from PIL import Image

work, out_dir = sys.argv[1], sys.argv[2]
UP = os.environ.get('BAHOR_PDF_DIR', 'source/pdf/').rstrip('/') + '/'
raw = json.load(open(f'{work}/floors_raw.json'))
X0, X1, Y0, Y1 = -2.5, 74.0, -3.0, 45.8
os.makedirs(out_dir, exist_ok=True)
meta = {}
for f in raw:
    s, bx, by = f['scale'], f['bx'], f['by']
    pg = pymupdf.open(UP + f['file'] + '.pdf')[0]
    clip = pymupdf.Rect(bx + X0 * s, by - Y1 * s, bx + X1 * s, by - Y0 * s)
    pix = pg.get_pixmap(matrix=pymupdf.Matrix(2.5, 2.5), clip=clip, alpha=False)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    name = f"floor-{f['floor']}.webp"
    im.save(os.path.join(out_dir, name), 'WEBP', quality=78, method=6)
    meta[f['floor']] = dict(src=f'assets/plans/{name}', x0=X0, x1=X1, y0=Y0, y1=Y1, w=pix.width, h=pix.height)
    print(name, pix.width, pix.height)
json.dump(meta, open(f'{work}/plan_meta.json', 'w'))
