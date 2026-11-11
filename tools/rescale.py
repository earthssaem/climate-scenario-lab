#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
요소 파일의 지도 색 범위(scale)를 실제 최솟값·최댓값으로 다시 계산합니다.

  python3 tools/rescale.py            # data/ 의 요소 파일 scale을 다시 씀 (manifest.version도 바꿔 주세요)
  python3 tools/rescale.py data-mock  # 다른 자료 폴더

[결과 형식]  값은 모두 [최솟값, 최댓값] (대칭 ±m 아님)
  "scale": {
    "period": { "abs": [a, b], "chg": [a, b], "diff": [a, b], "pct": [a, b], "pctDiff": [a, b] },   ← 20년 평균 지도
    "annual": { "abs": [a, b], "chg": [a, b], "diff": [a, b], "pct": [a, b], "pctDiff": [a, b] }    ← 연도 보기 지도
  }
  pct·pctDiff는 강수량(kind "prcp")만.

[계산 기준]  4개 시나리오 × 모든 기간(또는 모든 연도) × 모든 지역
  period  abs     현재(2000~2019)와 전반기·중반기·2061~2080·후반기의 기간값
          chg     기간값 − 현재 (현재 기간 자체는 변화량이 0이라 넣지 않음)
          diff    같은 지역·기간에서 B − A (서로 다른 두 시나리오의 모든 순서쌍)
          pct     (기간값 − 현재) / 현재 × 100,  pctDiff = B의 pct − A의 pct (%p)
  annual  abs     현재기후 연도별 값(2000~2019)과 전망 연도별 값(2021~2100)
          chg     연도별 값 − 같은 지역의 현재 공식값
          diff    같은 지역·연도에서 B − A (전망 연도만)
          pct·pctDiff  위와 같은 방식
  2061~2080: 파일에 미리 계산된 값(official.periods[시나리오].p3)이 있으면 그 값, 없으면 공식 10년 값 두 개의 평균
  범위는 소수 1자리로 바깥쪽 반올림(최솟값은 내림, 최댓값은 올림).

앱(scales.js)은 0을 언제나 흰색으로 두고, 최솟값이 0 이상이면 0부터 한쪽 방향, 최댓값이 0 이하이면 0까지 한쪽 방향,
양쪽에 걸치면 0을 가운데 흰색으로 한 비대칭 양방향 색을 씁니다. 시나리오·기간을 바꿔도 범위는 그대로입니다.
diff(B − A)는 모든 순서쌍을 보므로 범위가 저절로 대칭이 됩니다(A·B를 바꾸면 부호만 바뀜).
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def isnum(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def decade_value(dec, scen, start, region):
    d = (dec or {}).get(scen) or {}
    v = (d.get(str(start)) or {}).get(region)
    if v is None:
        v = (d.get(region) or {}).get(str(start))
    return v if isnum(v) else None


def period_value(el, scen, meta, region):
    off = el.get("official", {})
    if meta["id"] == "cur":
        v = off.get("cur", {}).get(region)
        return v if isnum(v) else None
    v = (off.get("periods", {}).get(scen, {}).get(meta["id"]) or {}).get(region)
    if isnum(v):
        return v
    if meta.get("derived"):
        vals = [decade_value(off.get("decades"), scen, y, region) for y in range(meta["start"], meta["end"] + 1, 10)]
        if vals and all(x is not None for x in vals):
            return sum(vals) / len(vals)
    return None


class Range:
    def __init__(self):
        self.lo = math.inf
        self.hi = -math.inf

    def add(self, v):
        if isnum(v):
            self.lo = min(self.lo, v)
            self.hi = max(self.hi, v)

    def out(self):
        if self.lo == math.inf:
            return None
        return [math.floor(self.lo * 10 + 1e-9) / 10, math.ceil(self.hi * 10 - 1e-9) / 10]


def compute_scale(el, manifest, kind):
    scens = [s["id"] for s in manifest["scenarios"]]
    regions = [r["code"] for r in manifest["regions"]]
    periods = manifest["periods"]
    cur = el.get("official", {}).get("cur", {})
    pct_on = kind == "prcp"
    keys = ["abs", "chg", "diff"] + (["pct", "pctDiff"] if pct_on else [])
    P = {k: Range() for k in keys}
    A = {k: Range() for k in keys}

    def chg_pct(v, base):
        if not (isnum(v) and isnum(base)):
            return None, None
        return v - base, ((v - base) / base * 100 if base else None)

    # 기간값
    for r in regions:
        base = cur.get(r)
        P["abs"].add(base)
        for meta in periods:
            if meta["id"] == "cur":
                continue
            vals = {s: period_value(el, s, meta, r) for s in scens}
            for s, v in vals.items():
                P["abs"].add(v)
                c, pc = chg_pct(v, base)
                P["chg"].add(c)
                if pct_on:
                    P["pct"].add(pc)
            for a in scens:
                for b in scens:
                    if a == b or vals[a] is None or vals[b] is None:
                        continue
                    P["diff"].add(vals[b] - vals[a])
                    if pct_on and isnum(base) and base:
                        P["pctDiff"].add((vals[b] - vals[a]) / base * 100)

    # 연도별 값
    cur_ann = el.get("current", {}).get("annual", {})
    proj_ann = el.get("projection", {}).get("annual", {})
    for r in regions:
        base = cur.get(r)
        for v in cur_ann.get(r) or []:
            A["abs"].add(v)
            c, pc = chg_pct(v, base)
            A["chg"].add(c)
            if pct_on:
                A["pct"].add(pc)
        series = {s: (proj_ann.get(s) or {}).get(r) for s in scens}
        for s, arr in series.items():
            for v in arr or []:
                A["abs"].add(v)
                c, pc = chg_pct(v, base)
                A["chg"].add(c)
                if pct_on:
                    A["pct"].add(pc)
        n = max((len(a) for a in series.values() if a), default=0)
        for i in range(n):
            for a in scens:
                for b in scens:
                    if a == b or not series[a] or not series[b]:
                        continue
                    va, vb = series[a][i], series[b][i]
                    if isnum(va) and isnum(vb):
                        A["diff"].add(vb - va)
                        if pct_on and isnum(base) and base:
                            A["pctDiff"].add((vb - va) / base * 100)

    period = {k: rng.out() for k, rng in P.items() if rng.out()}
    annual = {k: rng.out() for k, rng in A.items() if rng.out()}
    return {"period": period, "annual": annual} if annual else {"period": period}


def rescale_dir(data_dir):
    data_dir = Path(data_dir)
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    out = {}
    for meta in manifest["elements"]:
        path = data_dir / meta["file"]
        text = path.read_text(encoding="utf-8")
        el = json.loads(text)
        el["scale"] = compute_scale(el, manifest, meta.get("kind"))
        compact = "\n" not in text.strip()
        new = json.dumps(el, ensure_ascii=False, separators=(",", ":")) if compact else json.dumps(el, ensure_ascii=False, indent=2)
        path.write_text(new + ("\n" if text.endswith("\n") else ""), encoding="utf-8")
        out[meta["id"]] = el["scale"]
    return out


if __name__ == "__main__":
    d = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data"
    for eid, sc in rescale_dir(d).items():
        print(f"{eid:9s} {json.dumps(sc, ensure_ascii=False)}")
