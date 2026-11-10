#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
시도 경계 → 앱용 SVG 경로(data/geo/sido.json) 만들기

원본 경계는 저장소에 넣지 않습니다. 이 스크립트가 받아서 가공한 결과(sido.json)만 넣습니다.

[자료]
  admdongkor (https://github.com/vuski/admdongkor, PyPI admdongkor)
  - 통계청 SGIS 행정동 경계(공공누리 제1유형)를 가공한 시계열 경계. 데이터 CC BY 4.0, 코드 MIT
  - 버전 키 20240401: 2024년 6월 시점에 유효한 경계(다음 변경 2024-07-01 이전).
    기상청 시나리오 자료가 2024년 6월 행정구역 경계 기준이라 이 시점을 씁니다.
  - level "sido", detail=True(원본 해상도), 좌표계 EPSG:5179(UTM-K, 미터)

[처리 순서]
  1) 시도 17개 불러오기 → 이름으로 기상청 코드에 짝 맞추기 (17개 모두 짝지어졌는지 검사)
  2) 섬 정리: 면적 MIN_ISLAND_KM2 미만의 작은 섬은 지움.
     단, 제주도·울릉도·독도는 반드시 남김 (울릉도·독도 구역은 아주 작은 바위만 지움)
  3) 단순화: mapshaper -simplify weighted(Visvalingam 가중) — 이웃 시도와 경계선이 어긋나지 않게
     (토폴로지 유지). 섬마다 따로 넘기고 keep-shapes로 남긴 섬이 단순화 중에 사라지지 않게
  4) 투영: EPSG:5179 좌표를 그대로 씀(한국 전체가 자연스러운 비율). 앱 실행 중에는 투영 계산 없음
  5) 울릉도·독도는 오른쪽 위 작은 상자(인셋)로 옮기고(실제 축척, 서로의 위치 관계 그대로) 상자 정보를 저장.
     상자가 강원 해안과 겹치지 않게 필요한 만큼만 동쪽으로 옮김. 독도는 너무 작아 앱이 위치 표시(점)를 함께 그림
  6) SVG 경로(상대 좌표, 정수)와 이름표 위치(시각적 중심, 경기·서울·인천은 손으로 보정) 저장

[실행]  (네트워크 필요: 처음 한 번 GitHub에서 경계를 받아 캐시)
  python3 -m venv .geoenv && .geoenv/bin/pip install admdongkor==0.7.1
  npm install -g mapshaper        # 또는 MAPSHAPER="npx mapshaper" 로 지정
  .geoenv/bin/python tools/build_geo.py
"""

import json
import os
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

import admdongkor as adk
import geopandas as gpd
from pyproj import Transformer
from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import polylabel, unary_union

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "geo" / "sido.json"

VERSION_KEY = "20240401"          # 2024년 6월 시점 경계
SIMPLIFY = "6%"                  # mapshaper가 남길 점의 비율 (해안선 모양을 알아볼 수 있는 정도)
MIN_ISLAND_KM2 = 4.0              # 이보다 작은 섬은 지움 (울릉도·독도 구역 제외)
ZONE_MIN_KM2 = 0.02               # 울릉도·독도 구역에서도 이보다 작은 바위는 지움
ZONE_EASTING = 1_240_000          # 이 동쪽(EPSG:5179 x, m)은 울릉도·독도 구역 (본토 동해안 ≈ 1,190,000)
INSET_SCALE = 1.0                 # 인셋 확대 배율. 실제 축척(1.0)으로 두어 울릉도–독도 거리를 그대로 보여 줌
                                  # (1.6배면 상자가 강원 해안과 겹쳐 지도 전체가 23% 넓어지고 작아짐)
VIEW_W = 1000                     # 출력 viewBox 폭 (높이는 비율대로)
PAD = 8

# 이름에 들어 있는 글자 → 기상청 원자료 지역 코드 (행정표준코드와 다름)
KMA_CODES = [
    ("서울", "11", "서울"), ("부산", "21", "부산"), ("대구", "22", "대구"), ("인천", "23", "인천"),
    ("광주", "24", "광주"), ("대전", "25", "대전"), ("울산", "26", "울산"), ("세종", "29", "세종"),
    ("경기", "31", "경기"), ("강원", "32", "강원"), ("충청북", "33", "충북"), ("충청남", "34", "충남"),
    ("전북", "35", "전북"), ("전라북", "35", "전북"), ("전라남", "36", "전남"),
    ("경상북", "37", "경북"), ("경상남", "38", "경남"), ("제주", "39", "제주"),
]

# 겹치는 곳은 손으로 보정한 이름표 위치 (경도, 위도)
LABEL_LONLAT = {
    "11": (126.99, 37.555),   # 서울
    "23": (126.67, 37.43),    # 인천 (본토 쪽)
    "31": (127.42, 37.22),    # 경기 (서울 남동쪽)
    "29": (127.26, 36.56),    # 세종
    "25": (127.40, 36.33),    # 대전
    "26": (129.25, 35.55),    # 울산
    "21": (129.07, 35.17),    # 부산
    "22": (128.58, 35.85),    # 대구 (군위 제외 도심)
    "24": (126.86, 35.155),   # 광주
}
INSET_POINTS = [("울릉도", 130.86, 37.50), ("독도", 131.866, 37.241)]

ATTRIBUTION = ("본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 "
               "행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.")


def kma_code(name):
    hits = {(code, short) for key, code, short in KMA_CODES if key in name}
    if len(hits) != 1:
        raise SystemExit(f"지역 이름 짝 맞추기 실패: {name} → {hits}")
    return hits.pop()


def polygons(geom):
    return list(geom.geoms) if isinstance(geom, MultiPolygon) else [geom]


def main():
    g = adk.get(VERSION_KEY, "sido", detail=True)
    g = g.rename_geometry("geometry") if g.geometry.name != "geometry" else g
    print(f"불러옴: {VERSION_KEY} 시도 {len(g)}개, CRS {g.crs.to_epsg()}")

    # 1) 이름 → 기상청 코드
    rows = []
    for _, r in g.iterrows():
        code, short = kma_code(r["sidonm"])
        rows.append({"code": code, "short": short, "name": r["sidonm"], "src": r["sidocd"], "geometry": r.geometry})
    codes = sorted(x["code"] for x in rows)
    expected = sorted({c for _, c, _ in KMA_CODES})
    if codes != expected:
        raise SystemExit(f"17개 시도 짝이 맞지 않음: {codes}")
    print("코드 짝 맞추기: " + ", ".join(f"{x['name']}({x['src']}→{x['code']})" for x in sorted(rows, key=lambda x: x['code'])))

    # 2) 섬 정리
    kept_zone = 0
    for x in rows:
        keep = []
        polys = polygons(x["geometry"])
        biggest = max(polys, key=lambda p: p.area)
        for p in polys:
            km2 = p.area / 1e6
            in_zone = p.centroid.x > ZONE_EASTING
            if p is biggest or (in_zone and km2 >= ZONE_MIN_KM2) or (not in_zone and km2 >= MIN_ISLAND_KM2):
                keep.append(p)
                kept_zone += in_zone
        x["geometry"] = MultiPolygon(keep) if len(keep) > 1 else keep[0]
    print(f"섬 정리 후 울릉도·독도 구역 조각 {kept_zone}개 유지")

    # 3) mapshaper 단순화 (토폴로지 유지)
    ms = shlex.split(os.environ.get("MAPSHAPER", "mapshaper"))
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.json"
        dst = Path(td) / "out.json"
        # 섬 하나하나를 따로 된 도형으로 넘김: keep-shapes는 도형마다 가장 큰 고리 하나만 지켜 주므로,
        # 시도 하나로 넘기면 독도 같은 작은 섬이 단순화 중에 사라짐. (경계 공유 위상은 좌표로 만들어져 그대로 유지)
        fc = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {"code": x["code"]}, "geometry": mapping(p)}
            for x in rows for p in polygons(x["geometry"])]}
        src.write_text(json.dumps(fc))
        cmd = ms + [str(src), "-simplify", "weighted", f"percentage={SIMPLIFY}", "keep-shapes",
                    "-o", str(dst), "format=geojson", "precision=1"]
        subprocess.run(cmd, check=True, capture_output=True)
        simp = {}
        for f in json.loads(dst.read_text())["features"]:
            if f["geometry"]:
                simp.setdefault(f["properties"]["code"], []).extend(polygons(shape(f["geometry"])))
        simp = {code: MultiPolygon(ps) for code, ps in simp.items()}

    # 4) 울릉도·독도를 인셋으로 옮길 준비 (경북 37)
    main_parts = {}
    zone_parts = []
    for code, geom in simp.items():
        mp, zp = [], []
        for p in polygons(geom):
            (zp if p.centroid.x > ZONE_EASTING else mp).append(p)
        if code != "37" and zp:
            raise SystemExit(f"{code}에 울릉도·독도 구역 조각이 있음")
        main_parts[code] = mp
        zone_parts += zp
    if not zone_parts:
        raise SystemExit("울릉도·독도가 남지 않았음")
    mainland = unary_union([p for ps in main_parts.values() for p in ps])
    minx, miny, maxx, maxy = mainland.bounds
    zone = unary_union(zone_parts)
    zx0, zy0, zx1, zy1 = zone.bounds

    # 인셋 상자: 본토 bbox 오른쪽 위 구석 (동해, 강원 해안 바깥)
    zw = (zx1 - zx0) * INSET_SCALE
    zh = (zy1 - zy0) * INSET_SCALE
    m = 6000  # 상자 안 여백(m)
    box_w, box_h = zw + 2 * m, zh + 2 * m + 8000   # 위쪽에 이름 자리
    # 오른쪽 위 구석에 두고, 본토(강원 해안)와 겹치면 동쪽으로 5km씩 옮김 (그만큼 지도 폭이 조금 넓어짐)
    gap = 5000
    shift = 0
    while True:
        bx1, by1 = maxx + shift, maxy
        bx0, by0 = bx1 - box_w, by1 - box_h
        if not mainland.buffer(gap).intersects(Polygon([(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)])):
            break
        shift += 5000
        if shift > 200_000:
            raise SystemExit("인셋 상자 자리를 찾지 못함")
    print(f"인셋 상자: {box_w / 1000:.0f}×{box_h / 1000:.0f} km, 본토 bbox 동쪽으로 {shift / 1000:.0f} km 이동")
    maxx = max(maxx, bx1)
    to_box = lambda geom: affinity.translate(affinity.scale(geom, INSET_SCALE, INSET_SCALE, origin=(zx0, zy0)),
                                             bx0 + m - zx0, by0 + m - zy0)
    moved = [to_box(p) for p in zone_parts]
    main_parts["37"] = main_parts["37"] + moved

    # 5) SVG 좌표 (x 그대로, y 뒤집기) — 원점 맞추고 VIEW_W 폭으로 축척
    k = (VIEW_W - 2 * PAD) / (maxx - minx)
    H = round((maxy - miny) * k + 2 * PAD)
    sx = lambda x: (x - minx) * k + PAD
    sy = lambda y: (maxy - y) * k + PAD

    def ring_d(coords):
        pts = [(round(sx(x)), round(sy(y))) for x, y in coords]
        out = []
        for p in pts:                         # 같은 점 연속 제거
            if not out or out[-1] != p:
                out.append(p)
        if len(out) > 1 and out[0] == out[-1]:
            out.pop()
        if len(out) < 3:
            return ""
        s = f"M{out[0][0]} {out[0][1]}"
        prev = out[0]
        rel = []
        for p in out[1:]:
            rel.append((p[0] - prev[0], p[1] - prev[1]))
            prev = p
        body = ""
        for dx, dy in rel:
            body += (f"{dx}" if not body or dx < 0 else f" {dx}") + (f"{dy}" if dy < 0 else f" {dy}")
        return s + "l" + body.lstrip() + "z"

    def path_d(polys):
        parts = []
        for p in polys:
            parts.append(ring_d(p.exterior.coords))
            parts += [ring_d(h.coords) for h in p.interiors]
        return "".join(x for x in parts if x)

    tr = Transformer.from_crs("EPSG:4326", "EPSG:5179", always_xy=True)
    paths = []
    for x in sorted(rows, key=lambda r: r["code"]):
        code = x["code"]
        polys = main_parts[code]
        if code in LABEL_LONLAT:
            lx, ly = tr.transform(*LABEL_LONLAT[code])
        else:
            big = max((p for p in polys if p.centroid.x <= ZONE_EASTING), key=lambda p: p.area)
            c = polylabel(big, tolerance=500)
            lx, ly = c.x, c.y
        paths.append({"code": code, "name": x["short"], "d": path_d(polys), "label": [round(sx(lx)), round(sy(ly))]})

    pts = []
    for name, lon, lat in INSET_POINTS:
        px, py = tr.transform(lon, lat)
        q = to_box(Polygon([(px, py), (px + 1, py), (px, py + 1)])).exterior.coords[0]
        pts.append({"name": name, "x": round(sx(q[0])), "y": round(sy(q[1]))})
    insets = [{
        "name": "울릉도·독도",
        "box": [round(sx(bx0)), round(sy(by1)), round(box_w * k), round(box_h * k)],
        "scale": INSET_SCALE,
        "points": pts,
    }]

    out = {
        "type": "paths",
        "mock": False,
        "source": f"통계청 SGIS 행정동 경계(공공누리 제1유형) 가공 vuski/admdongkor, 버전 {VERSION_KEY}(2024년 6월 시점), "
                  "데이터 CC BY 4.0. 시도로 합침·단순화·EPSG:5179 투영(tools/build_geo.py)",
        "attribution": ATTRIBUTION,
        "version": VERSION_KEY,
        "viewBox": f"0 0 {VIEW_W} {H}",
        "paths": paths,
        "insets": insets,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(text + "\n", encoding="utf-8")
    size = len(text.encode("utf-8"))
    print(f"저장: {OUT.relative_to(ROOT)}  {size / 1024:.1f} KB, viewBox 0 0 {VIEW_W} {H}, 경로 {len(paths)}개")
    if size > 80 * 1024:
        print("⚠ 80KB를 넘었습니다. SIMPLIFY 비율을 낮춰 주세요.", file=sys.stderr)


if __name__ == "__main__":
    main()
