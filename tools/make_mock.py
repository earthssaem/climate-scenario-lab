#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
기후변화 시나리오 탐구실 — 예시(가짜) 데이터 생성 스크립트

⚠ 이 스크립트가 만드는 값은 실제 기후 자료가 아닙니다. 화면 확인용입니다.
  - 생성되는 모든 JSON 맨 위에 "mock": true 가 들어갑니다. 앱은 이것을 보고 화면 맨 위에 경고 띠를 띄웁니다.
  - 실제 자료로 교체하기 전에는 학생에게 배포하지 마세요.

실행 (저장소 루트에서):
    python3 tools/make_mock.py        → data-mock/ 에 씀 (data/의 실제 자료는 건드리지 않음)
    앱에서 보기: python3 -m http.server 후 http://localhost:8000/?data=mock
    (지도 경계는 data/geo/sido.json을 그대로 씀. data-mock/은 git·배포에서 제외)

────────────────────────────────────────────────────────────────────────────
[값을 만드는 규칙]  직선 추세 + 작은 흔들림만 씁니다. 다른 규칙은 없습니다.

1) 현재기후 연별 값 (2000~2019, 시도 면적 평균 자리)
     값 = 기준값 + 지역 보정 + 현재 기울기 × (연도 − 2009.5) + 흔들림

2) 시나리오 연별 값 (2021~2100)
     값 = 기준값 + 지역 보정
          + 지역 배율 × (시나리오 시작값 + 시나리오 기울기 × (연도 − 2010))
          + 기간 보정(아래 4-③, 4-④에서만 씀)
          + 흔들림

3) 흔들림 = 고정 seed 난수로 만든 −A ~ +A 균등분포 값 (A는 요소마다 ELEMENTS의 wiggle)
   일수 요소(폭염·열대야·한파)는 0보다 작아지지 않게 0에서 자릅니다.
   모든 연별 값은 소수 1자리로 반올림합니다.

4) 실제 자료에서 생길 상황을 일부러 넣었습니다 (스크립트 끝에서 자동 확인).
   ① 2020년은 시나리오·현재기후 모두 값이 없음 (현재기후 2000~2019, 전망 2021~2100이라 배열에 2020이 없음)
   ② 장기관측 1950~1953년은 null
   ③ 시나리오 순서가 기간에 따라 바뀜: 평균기온 전반기에는 SSP2-4.5가 SSP5-8.5보다 큼
      (시작값·기울기 차이로 생김)
   ④ 기간별 차이가 줄었다가 다시 커짐: 강수량 SSP5-8.5 − SSP1-2.6 (전국)
      → SSP5-8.5에 기간 보정 전반기 +40mm, 중반기 −50mm
   ⑤ 한 요소에서 일부 지역 값이 null: 한파일수의 세종(29) 전체
   ⑥ 10년 공식값이 없는 요소: 폭염일수 (→ 앱에서 2061~2080 칩이 비활성화되어야 함)
   ⑦ 전국("00")은 official(기간값·10년 값)에만 있고 annual에는 없음
      (기상청 시도 연자료 파일에는 전국 열이 없음. 예시에서는 전국 연별 값을 안에서만 만들어
       공식값 계산에 쓰고, 파일의 annual에서는 뺌)

지역 코드는 기상청 원자료 파일의 코드(11 서울, 21 부산, … 39 제주)를 씁니다. 행정표준코드와 다릅니다.

5) 공식 기간값(official)
   - cur: 현재기후 연별 값(반올림 후)의 평균
   - periods p1·p2·p4: 해당 20년 연별 값의 평균
   - decades: 10년 구간(2021~2030 … 2091~2100) 연별 값의 평균. 키는 구간 시작 연도
   - 2061~2080(p3)은 공식값으로 넣지 않음 (앱이 decades 2061·2071의 평균으로 계산)
   모두 소수 1자리로 반올림.

6) scale (지도 색 범위)는 실제 자료와 같은 방법으로 tools/rescale.py가 계산
   (4개 시나리오 × 모든 기간/연도 × 모든 지역의 [최솟값, 최댓값], 기간용 period·연도 보기용 annual 따로)

7) 장기관측(지점, 1912~2025): 값 = 지점 기울기 × (연도 − 2009.5) + 흔들림(±0.45)
   → 각 지점의 2000~2019 평균을 0으로 맞춘 편차. 6개 지점 평균 = 6개 지점 값의 평균.

8) 전 지구 CO₂ 배출 경로: 시나리오마다 몇 개의 꺾은점을 직선으로 이은 값 (EMISSION_ANCHORS)

9) 지도 경계는 예시가 아님: 실제 시도 경계(data/geo/sido.json)를 tools/build_geo.py로 만듦
────────────────────────────────────────────────────────────────────────────
"""

import json
import sys
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data-mock"   # 실제 자료(data/)를 덮어쓰지 않도록 따로 씀. 앱에서 보려면 index.html?data=mock
SEED = "climate-scenario-lab-mock-v1"
VERSION = "mock-0.1"

REGIONS = [
    ("00", "전국", "전국"),
    ("11", "서울특별시", "서울"),
    ("21", "부산광역시", "부산"),
    ("22", "대구광역시", "대구"),
    ("23", "인천광역시", "인천"),
    ("24", "광주광역시", "광주"),
    ("25", "대전광역시", "대전"),
    ("26", "울산광역시", "울산"),
    ("29", "세종특별자치시", "세종"),
    ("31", "경기도", "경기"),
    ("32", "강원특별자치도", "강원"),
    ("33", "충청북도", "충북"),
    ("34", "충청남도", "충남"),
    ("35", "전북특별자치도", "전북"),
    ("36", "전라남도", "전남"),
    ("37", "경상북도", "경북"),
    ("38", "경상남도", "경남"),
    ("39", "제주특별자치도", "제주"),
]
CODES = [r[0] for r in REGIONS]
SCENARIOS = ["ssp126", "ssp245", "ssp370", "ssp585"]
NATION_ONLY_OFFICIAL = ["00"]  # annual에 넣지 않는 지역 (공식값만)
CUR_YEARS = list(range(2000, 2020))
PROJ_YEARS = list(range(2021, 2101))
PERIODS = {"p1": (2021, 2040), "p2": (2041, 2060), "p4": (2081, 2100)}
P3 = (2061, 2080)
DECADES = list(range(2021, 2100, 10))  # 2021, 2031, ..., 2091


def offsets(default=0.0, **kw):
    """지역 약칭으로 쓴 값을 지역 코드 사전으로 바꾼다. 적지 않은 지역(전국 포함)은 default."""
    by_short = {r[2]: r[0] for r in REGIONS}
    out = {c: float(default) for c in CODES}
    for short, v in kw.items():
        out[by_short[short]] = float(v)
    return out


# 요소별 규칙 ---------------------------------------------------------------
#   base: 기준값, offset: 지역 보정, gain: 지역 배율(없으면 1), cur_slope: 현재기후 기울기(/년),
#   scen: 시나리오별 (시작값, 기울기/년), bump: {(시나리오, 기간): 보정값}, wiggle: 흔들림 폭,
#   floor0: 일수처럼 0 아래로 내려가지 않게 할지, decades: 10년 공식값을 넣을지, null_regions: 값이 없는 지역
ELEMENTS = {
    "tavg": dict(
        unit="℃", kind="temp", base=12.8,
        offset=offsets(서울=0.4, 부산=2.0, 대구=1.6, 인천=0.0, 광주=1.4, 대전=0.6, 울산=1.6, 세종=0.0,
                       경기=-0.5, 강원=-2.5, 충북=-0.4, 충남=0.0, 전북=0.4, 전남=1.4, 경북=-0.2, 경남=1.2, 제주=3.2),
        gain=offsets(default=1.0, 서울=1.05, 부산=0.9, 대구=1.0, 인천=1.0, 광주=1.0, 대전=1.0, 울산=0.95, 세종=1.0,
                     경기=1.1, 강원=1.15, 충북=1.1, 충남=1.0, 전북=1.0, 전남=0.95, 경북=1.05, 경남=0.95, 제주=0.85),
        cur_slope=0.03, wiggle=0.3,
        scen={"ssp126": (0.6, 0.010), "ssp245": (0.8, 0.026), "ssp370": (0.0, 0.052), "ssp585": (-0.6, 0.074)},
        bump={}, floor0=False, decades=True, null_regions=[],
    ),
    "prcp": dict(
        unit="mm", kind="prcp", base=1300.0,
        offset=offsets(서울=100, 부산=200, 대구=-250, 인천=-100, 광주=100, 대전=50, 울산=-50, 세종=-20,
                       경기=0, 강원=80, 충북=-30, 충남=-50, 전북=20, 전남=100, 경북=-200, 경남=250, 제주=550),
        gain=None,  # 아래에서 (기준값 + 지역 보정) / 기준값 으로 채움
        cur_slope=2.0, wiggle=80.0,
        scen={"ssp126": (40.0, 0.6), "ssp245": (30.0, 1.2), "ssp370": (10.0, 1.8), "ssp585": (0.0, 2.8)},
        bump={("ssp585", "p1"): 40.0, ("ssp585", "p2"): -50.0}, floor0=True, decades=True, null_regions=[],
    ),
    "heat": dict(
        unit="일", kind="days", base=11.0,
        offset=offsets(서울=2, 부산=-6, 대구=14, 인천=-8, 광주=6, 대전=3, 울산=1, 세종=2,
                       경기=0, 강원=-6, 충북=3, 충남=-1, 전북=4, 전남=-1, 경북=5, 경남=5, 제주=-9),
        gain=None, cur_slope=0.15, wiggle=4.0,
        scen={"ssp126": (2.0, 0.08), "ssp245": (2.0, 0.22), "ssp370": (1.0, 0.40), "ssp585": (0.0, 0.55)},
        bump={}, floor0=True, decades=False, null_regions=[],
    ),
    "tropical": dict(
        unit="일", kind="days", base=8.0,
        offset=offsets(서울=6, 부산=12, 대구=6, 인천=2, 광주=5, 대전=-1, 울산=4, 세종=-3,
                       경기=-2, 강원=-6, 충북=-4, 충남=-3, 전북=-1, 전남=2, 경북=-3, 경남=3, 제주=18),
        gain=None, cur_slope=0.2, wiggle=3.0,
        scen={"ssp126": (2.0, 0.10), "ssp245": (2.0, 0.25), "ssp370": (1.0, 0.45), "ssp585": (0.0, 0.60)},
        bump={}, floor0=True, decades=True, null_regions=[],
    ),
    "cold": dict(
        unit="일", kind="days", base=5.0,
        offset=offsets(서울=-1, 부산=-5, 대구=-3, 인천=-2, 광주=-4, 대전=1, 울산=-4.5, 세종=2,
                       경기=4, 강원=12, 충북=5, 충남=1, 전북=0, 전남=-3, 경북=3, 경남=-3, 제주=-5),
        gain=None, cur_slope=-0.08, wiggle=2.5,
        scen={"ssp126": (-0.5, -0.02), "ssp245": (-0.5, -0.04), "ssp370": (-0.3, -0.06), "ssp585": (0.0, -0.08)},
        bump={}, floor0=True, decades=True, null_regions=["29"],
    ),
}

# 장기관측 지점 (기상청 지점번호, 이름, 기울기 ℃/년)
STATIONS = [("108", "서울", 0.020), ("112", "인천", 0.017), ("105", "강릉", 0.016),
            ("143", "대구", 0.019), ("159", "부산", 0.015), ("165", "목포", 0.016)]
OBS_YEARS = list(range(1912, 2026))
OBS_MISSING = set(range(1950, 1954))

EMISSION_YEARS = [2015, 2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
EMISSION_ANCHORS = {  # (연도, GtCO₂/년) 꺾은점 — 직선으로 이음
    "ssp126": [(2015, 40), (2100, -10)],
    "ssp245": [(2015, 40), (2050, 45), (2100, 10)],
    "ssp370": [(2015, 40), (2100, 85)],
    "ssp585": [(2015, 40), (2080, 120), (2100, 120)],
}



# 도움 함수 ------------------------------------------------------------------
def r1(v):
    return None if v is None else round(v + 0.0, 1)


def mean(vals):
    vals = [v for v in vals if v is not None]
    return sum(vals) / len(vals) if vals else None


def wiggle(rng, a):
    return rng.uniform(-a, a)


def rng_for(*parts):
    return random.Random("|".join([SEED, *map(str, parts)]))


def period_of(year):
    for pid, (a, b) in PERIODS.items():
        if a <= year <= b:
            return pid
    return None


def nice_floor(v, step):
    import math
    return math.floor(v / step) * step


def nice_ceil(v, step):
    import math
    return math.ceil(v / step) * step


def dump(path, obj, compact=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) if compact \
        else json.dumps(obj, ensure_ascii=False, indent=2)
    path.write_text(text + "\n", encoding="utf-8")
    return len(text.encode("utf-8"))


# 요소 파일 ------------------------------------------------------------------
def make_element(eid, cfg):
    base, off = cfg["base"], cfg["offset"]
    gain = cfg["gain"]
    if gain is None:  # 기준값이 큰 지역일수록 변화도 크게 (일수·강수량)
        gain = {c: max(0.0, (base + off[c]) / base) for c in CODES}
        if cfg["kind"] == "days" and eid != "cold":
            gain = {c: max(0.3, g) ** 0.7 for c, g in gain.items()}

    def clip(v):
        return max(0.0, v) if cfg["floor0"] else v

    current, projection = {}, {s: {} for s in SCENARIOS}
    for c in CODES:
        if c in cfg["null_regions"]:
            current[c] = [None] * len(CUR_YEARS)
            for s in SCENARIOS:
                projection[s][c] = [None] * len(PROJ_YEARS)
            continue
        rng = rng_for(eid, "current", c)
        current[c] = [r1(clip(base + off[c] + cfg["cur_slope"] * (y - 2009.5) + wiggle(rng, cfg["wiggle"])))
                      for y in CUR_YEARS]
        for s in SCENARIOS:
            start, slope = cfg["scen"][s]
            rng = rng_for(eid, s, c)
            vals = []
            for y in PROJ_YEARS:
                v = base + off[c] + gain[c] * (start + slope * (y - 2010))
                v += cfg["bump"].get((s, period_of(y)), 0.0)
                v += wiggle(rng, cfg["wiggle"])
                vals.append(r1(clip(v)))
            projection[s][c] = vals

    def avg_years(series, first, a, b):
        return r1(mean(series[a - first:b - first + 1]))

    official = {"cur": {c: r1(mean(current[c])) for c in CODES}, "periods": {}}
    for s in SCENARIOS:
        official["periods"][s] = {pid: {c: avg_years(projection[s][c], 2021, a, b) for c in CODES}
                                  for pid, (a, b) in PERIODS.items()}
    if cfg["decades"]:
        official["decades"] = {s: {str(d): {c: avg_years(projection[s][c], 2021, d, d + 9) for c in CODES}
                                   for d in DECADES} for s in SCENARIOS}

    # 전국("00")은 annual에서 뺌 (공식값에만 있음)
    for c in NATION_ONLY_OFFICIAL:
        current.pop(c, None)
        for s in SCENARIOS:
            projection[s].pop(c, None)

    return {
        "mock": True,
        "element": eid,
        "unit": cfg["unit"],
        "current": {"startYear": CUR_YEARS[0], "annual": current},
        "projection": {"startYear": PROJ_YEARS[0], "annual": projection},
        "official": official,
        "scale": {},   # 아래 main()에서 tools/rescale.py로 채움
    }


def make_stations():
    series = {}
    for code, name, slope in STATIONS:
        rng = rng_for("obs", code)
        raw = [slope * (y - 2009.5) + wiggle(rng, 0.45) for y in OBS_YEARS]
        base = mean(raw[2000 - OBS_YEARS[0]:2019 - OBS_YEARS[0] + 1])
        series[code] = {"name": f"{name} 지점", "startYear": OBS_YEARS[0],
                        "values": [None if y in OBS_MISSING else r1(v - base) for y, v in zip(OBS_YEARS, raw)]}
    avg = []
    for i, y in enumerate(OBS_YEARS):
        vals = [series[c]["values"][i] for c, _, _ in STATIONS]
        avg.append(None if any(v is None for v in vals) else r1(mean(vals)))
    out = {"6avg": {"name": "6개 지점 평균", "stations": [n for _, n, _ in STATIONS],
                    "startYear": OBS_YEARS[0], "values": avg}}
    out.update(series)
    return {
        "mock": True,
        "unit": "℃",
        "valueType": "anomaly",
        "baseline": "2000-2019",
        "note": "지점 관측값입니다. 시도 면적 평균과 다른 자료입니다.",
        "series": out,
        "missingNote": "1950~1953년은 전쟁으로 자료가 없습니다. 1917년은 일부 자료가 누락되었습니다.",
    }


def make_emissions():
    def at(anchors, y):
        for (x0, v0), (x1, v1) in zip(anchors, anchors[1:]):
            if x0 <= y <= x1:
                return v0 + (v1 - v0) * (y - x0) / (x1 - x0)
        return anchors[-1][1]
    return {
        "mock": True,
        "unit": "GtCO₂/년",
        "scope": "전 지구",
        "source": "IPCC AR6 WG1 SPM.4 (CC BY 4.0)",
        "years": EMISSION_YEARS,
        "values": {s: [r1(at(EMISSION_ANCHORS[s], y)) for y in EMISSION_YEARS] for s in SCENARIOS},
    }


def make_manifest():
    return {
        "version": VERSION,
        "mock": True,
        "regions": [{"code": c, "name": n, "short": s} for c, n, s in REGIONS],
        "scenarios": [
            {"id": "ssp126", "label": "SSP1-2.6", "level": "배출 낮음", "color": "#173C66", "co2_2100_ppm": 432},
            {"id": "ssp245", "label": "SSP2-4.5", "level": "배출 중간", "color": "#F79420", "co2_2100_ppm": 567},
            {"id": "ssp370", "label": "SSP3-7.0", "level": "배출 높음", "color": "#E71D25", "co2_2100_ppm": 834},
            {"id": "ssp585", "label": "SSP5-8.5", "level": "배출 매우 높음", "color": "#951B1E", "co2_2100_ppm": 1089},
        ],
        "elements": [
            {"id": "tavg", "name": "평균기온", "unit": "℃", "kind": "temp", "file": "elements/tavg.json"},
            {"id": "prcp", "name": "강수량", "unit": "mm", "kind": "prcp", "file": "elements/prcp.json"},
            {"id": "heat", "name": "폭염일수", "unit": "일", "kind": "days", "file": "elements/heat.json"},
            {"id": "tropical", "name": "열대야일수", "unit": "일", "kind": "days", "file": "elements/tropical.json"},
            {"id": "cold", "name": "한파일수", "unit": "일", "kind": "days", "file": "elements/cold.json"},
        ],
        "periods": [
            {"id": "cur", "label": "현재기후", "start": 2000, "end": 2019},
            {"id": "p1", "label": "전반기", "start": 2021, "end": 2040},
            {"id": "p2", "label": "중반기", "start": 2041, "end": 2060},
            {"id": "p3", "label": "2061~2080", "start": 2061, "end": 2080, "derived": True},
            {"id": "p4", "label": "후반기", "start": 2081, "end": 2100},
        ],
        "sources": {
            "projection": "기상청 기후정보포털, SSP 남한상세 행정구역 자료(5개 모델 앙상블 평균)",
            "current": "기상청 MK-PRISM v2.1 행정구역 자료(2000~2019)",
            "obs": "기상청 기상정보분석·기상자료개방포털 ASOS",
            "co2": "IPCC AR6 WG1 SPM.4 (CC BY 4.0)",
            "co2Graph": "시나리오 고르기 창의 작은 그래프 = 전 지구 연간 CO₂ 배출량(단위 GtCO₂/년, 대기 중 농도가 아님) · 가로축은 실제 연도 간격(점 = 자료가 있는 해) · 네 그래프는 같은 세로축",
        },
    }


# 확인 -----------------------------------------------------------------------
def verify(elements, stations):
    ok = True

    def check(cond, msg):
        nonlocal ok
        print(("  확인 ✓ " if cond else "  확인 ✗ ") + msg)
        ok = ok and cond

    t = elements["tavg"]["official"]["periods"]
    check(t["ssp245"]["p1"]["00"] > t["ssp585"]["p1"]["00"] and t["ssp245"]["p2"]["00"] < t["ssp585"]["p2"]["00"],
          f"평균기온 전국: 전반기 SSP2-4.5({t['ssp245']['p1']['00']}) > SSP5-8.5({t['ssp585']['p1']['00']}), 중반기에는 순서 바뀜")
    p = elements["prcp"]["official"]
    d = [p["periods"]["ssp585"][k]["00"] - p["periods"]["ssp126"][k]["00"] for k in ("p1", "p2")]
    dec = p["decades"]
    p3 = (dec["ssp585"]["2061"]["00"] + dec["ssp585"]["2071"]["00"]) / 2 - \
         (dec["ssp126"]["2061"]["00"] + dec["ssp126"]["2071"]["00"]) / 2
    p4 = p["periods"]["ssp585"]["p4"]["00"] - p["periods"]["ssp126"]["p4"]["00"]
    check(d[0] > d[1] < p3 < p4, f"강수량 전국 SSP5-8.5 − SSP1-2.6: {d[0]:.1f} → {d[1]:.1f} → {p3:.1f} → {p4:.1f} (줄었다가 커짐)")
    check(all(v is None for v in elements["cold"]["current"]["annual"]["29"]) and
          elements["cold"]["official"]["cur"]["29"] is None, "한파일수 세종(29) 값 없음")
    check(all("00" not in e["current"]["annual"] and all("00" not in e["projection"]["annual"][s] for s in SCENARIOS)
              and e["official"]["cur"]["00"] is not None for e in elements.values()),
          "전국(00)은 annual에 없고 official에만 있음")
    check("decades" not in elements["heat"]["official"], "폭염일수에는 10년 공식값 없음 (2061~2080 비활성화 확인용)")
    vals = stations["series"]["6avg"]["values"]
    check(all(vals[y - 1912] is None for y in range(1950, 1954)), "장기관측 1950~1953 null")
    check(all(len(e["projection"]["annual"]["ssp126"]["11"]) == 80 and e["projection"]["startYear"] == 2021 and
              len(e["current"]["annual"]["11"]) == 20 and e["current"]["startYear"] == 2000
              for e in elements.values()), "현재기후 2000~2019, 전망 2021~2100 (2020년 없음)")
    return ok


def main():
    print("예시(가짜) 데이터를 만듭니다 — 실제 기후 자료가 아닙니다.")
    sizes = {}
    sizes["manifest.json"] = dump(DATA / "manifest.json", make_manifest(), compact=False)
    elements = {}
    for eid, cfg in ELEMENTS.items():
        elements[eid] = make_element(eid, cfg)
        sizes[f"elements/{eid}.json"] = dump(DATA / "elements" / f"{eid}.json", elements[eid])
    stations = make_stations()
    sizes["obs/stations.json"] = dump(DATA / "obs" / "stations.json", stations)
    sizes["co2/emissions.json"] = dump(DATA / "co2" / "emissions.json", make_emissions())
    # 지도 경계(data/geo/sido.json)는 실제 자료라 여기서 만들지 않음 → tools/build_geo.py
    for k, v in sizes.items():
        print(f"  {k:24s} {v / 1024:6.1f} KB")
    # 지도 색 범위: 실제 자료와 같은 계산(tools/rescale.py)으로 [최솟값, 최댓값]
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from rescale import rescale_dir
    for eid, sc in rescale_dir(DATA).items():
        print(f"  scale {eid:9s} {json.dumps(sc, ensure_ascii=False)}")
    if not verify(elements, stations):
        raise SystemExit("예시 데이터 확인 실패 — 규칙을 고쳐 주세요.")


if __name__ == "__main__":
    main()
