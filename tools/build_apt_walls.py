"""Per-apartment geometry for the isolated apartment model.

For every apartment stores:
  aw - wall polygons (with holes) that belong to the apartment (floor walls clipped
       to the apartment outline grown by the wall thickness)
  af - the apartment's slab outline (apartment + terraces, grown by the walls)

Usage: python3 tools/build_apt_walls.py data/floors.json
"""
import json, sys
from shapely.geometry import Polygon, MultiPolygon
from shapely.ops import unary_union

path = sys.argv[1]
data = json.load(open(path))


def polys(g):
    if g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon)]


def to_json(g, min_area=0.02):
    out = []
    for p in polys(g):
        if p.area < min_area:
            continue
        p = p.simplify(0.01)
        out.append(dict(o=[[round(x, 2), round(y, 2)] for x, y in list(p.exterior.coords)[:-1]],
                        h=[[[round(x, 2), round(y, 2)] for x, y in list(h.coords)[:-1]] for h in p.interiors]))
    return out


for fo in data['floors']:
    walls = unary_union([Polygon(w['o'], w['h']).buffer(0) for w in fo['walls']])
    total = 0
    for a in fo['apartments']:
        shape = unary_union([Polygon(p).buffer(0) for p in a['polys'] + a['ter'] if len(p) >= 3])
        region = shape.buffer(0.34, join_style=2)
        aw = walls.intersection(region)
        a['aw'] = to_json(aw)
        a['af'] = to_json(region.simplify(0.03), 0.5)
        total += sum(len(p['o']) + sum(len(h) for h in p['h']) for p in a['aw'])
    print(f"floor {fo['floor']}: apartment wall vertices {total}")

json.dump(data, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
