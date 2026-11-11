# 지도 경계 자료 (`sido.json`)

| 항목 | 내용 |
|---|---|
| 자료 | **admdongkor** — 통계청 통계지리정보서비스(SGIS) 행정동 경계를 가공한 시계열 행정경계 (https://github.com/vuski/admdongkor, PyPI `admdongkor` 0.7.1) |
| 기준 시점 | 버전 키 `20240401` — **2024년 6월 시점에 유효한 경계**(다음 변경 2024-07-01 이전). 기상청 SSP 남한상세 행정구역 자료가 2024년 6월 경계 기준이라 이 시점을 씀. 군위군은 대구광역시에 포함(2023-07-01 편입 반영) |
| 단위 | 시도 17개 (`level="sido"`, `detail=True` 원본 해상도에서 가공) |
| 라이선스 | **데이터 CC BY 4.0** (admdongkor `LICENSE-DATA`), 원자료는 SGIS **공공누리 제1유형(출처표시)** — 출처표시 의무는 가공 여부와 관계없이 유지됨. (admdongkor의 *코드*는 MIT) |
| 파일 크기 | `sido.json` 29.7 KB (원본, 압축 전) — 목표 80 KB 이하 |
| 좌표 | EPSG:5179(UTM-K)를 그대로 쓰고 y만 뒤집어 viewBox `0 0 1000 1283`에 맞춤. 앱 실행 중 투영 계산 없음 |

## 출처 표기 (admdongkor LICENSE-DATA §3 문구 그대로)

> 본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.

앱 푸터에는 요약(지도: 통계청 SGIS, admdongkor, CC BY 4.0)을, 푸터의 `[자료 출처 ⓘ]` 창에는 `sido.json`의 `source`와 `attribution`(위 문구 그대로, 주소는 링크)을 보여 줍니다.

## 가공 (`tools/build_geo.py`)

1. admdongkor에서 2024-04-01 시도 경계를 받음 (원본은 저장소에 넣지 않음)
2. **이름으로 기상청 원자료 코드에 짝 맞춤** — 17개가 모두 한 번씩 짝지어졌는지 검사(강원특별자치도·전북특별자치도 포함)
3. 섬 정리: 4 km² 미만 섬은 지움. **제주도·울릉도·독도는 반드시 남김**(울릉도·독도 구역은 0.02 km² 미만 바위만 지움)
4. mapshaper `-simplify weighted percentage=6% keep-shapes` (Visvalingam 가중, 이웃 시도와 경계선 공유 유지). 섬을 하나씩 넘겨서 남긴 섬이 단순화 중 사라지지 않게 함
5. **울릉도·독도는 오른쪽 위 상자(인셋)로 옮김** — 실제 축척(1.0배), 두 섬의 위치 관계 그대로. 상자가 강원 해안과 겹치지 않게 25 km 동쪽에 둠(지도 폭 약 5% 늘어남). 앱은 상자 안의 섬 조각을 경북 경로에서 떼어 내어, 얇은 점선 상자에 울릉도는 실제 모양을 키워서, 독도는 테두리 있는 점으로 다시 그리고 섬마다 이름("울릉도", "독도")을 붙임(js/map.js `prepGeo`·`layoutInset`). 상자 오른쪽 위 모서리는 이 파일의 `box` 자리 그대로
6. SVG 경로(상대 좌표 정수) + 이름표 위치(`label`, 시각적 중심 — 서울·인천·경기와 작은 광역시·세종은 손으로 보정한 위치)

| 시도 | 원자료 sidocd(행정표준) → 기상청 코드 |
|---|---|
| 서울 11→11, 부산 26→21, 대구 27→22, 인천 28→23, 광주 29→24, 대전 30→25, 울산 31→26, 세종 36→29 | |
| 경기 41→31, 강원 51→32, 충북 43→33, 충남 44→34, 전북 52→35, 전남 46→36, 경북 47→37, 경남 48→38, 제주 50→39 | |

```bash
python3 -m venv .geoenv && .geoenv/bin/pip install admdongkor==0.7.1
npm install -g mapshaper@0.6.102      # 또는 MAPSHAPER="npx mapshaper"
.geoenv/bin/python tools/build_geo.py
```

행정안전부 「시도 법정경계」(공공데이터포털 15153314)를 먼저 시도했으나, 작업 환경에서 공공데이터포털·재난안전데이터 공유플랫폼 접속이 막혀 받지 못해 admdongkor를 썼습니다.

## 형식

```jsonc
{
  "type": "paths", "mock": false,
  "source": "…", "attribution": "…", "version": "20240401",
  "viewBox": "0 0 1000 1283",
  "paths": [ { "code": "11", "name": "서울", "d": "M…z", "label": [x, y] } ],
  "insets": [ { "name": "울릉도·독도", "box": [x, y, w, h], "scale": 1.0,
                "points": [ { "name": "울릉도", "x": 0, "y": 0 }, { "name": "독도", "x": 0, "y": 0 } ] } ]
}
```
