// data.js — 데이터 불러오기·캐시, 파생값 계산(변화량, %, 차이, 기간값)
//
// 아래 '파생값' 함수들은 DOM을 쓰지 않는 순수 함수라서 tests/data.test.mjs 에서 Node로 검사합니다.
// 값이 없으면(null) 언제나 null을 돌려줍니다. 빈 값을 다른 값으로 메우지 않습니다.

/* ───────────── 불러오기·캐시 ───────────── */

const BASE = 'data/';
const requests = new Map(); // path → Promise (진행 중이거나 끝난 요청을 재사용)
const loaded = new Map();   // path → 성공한 데이터
const failed = new Map();   // path → Error
const listeners = new Set();
let version = '';
let fetchImpl = (...args) => fetch(...args);

export function setFetch(fn) { fetchImpl = fn; }          // 시험용
export function setVersion(v) { version = v || ''; }
export function onDataChange(fn) { listeners.add(fn); }
const emit = () => listeners.forEach((fn) => fn());

/**
 * JSON 파일 하나를 불러옵니다. 같은 파일을 동시에 두 번 요청하지 않고, 한 번 받은 파일은 다시 받지 않습니다.
 * manifest처럼 항상 새로 확인해야 하는 파일은 { revalidate: true }로 부릅니다.
 */
export function loadJSON(path, { revalidate = false } = {}) {
  if (requests.has(path)) return requests.get(path);
  const url = BASE + path + (version && !revalidate ? `?v=${encodeURIComponent(version)}` : '');
  failed.delete(path);
  const p = Promise.resolve()
    .then(() => fetchImpl(url, revalidate ? { cache: 'no-cache' } : undefined))
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
      return res.json();
    })
    .then((json) => { loaded.set(path, json); emit(); return json; })
    .catch((err) => {
      requests.delete(path);   // 실패한 요청은 지워서 '다시 시도'가 되게
      failed.set(path, err);
      emit();
      throw err;
    });
  requests.set(path, p);
  emit();
  return p;
}

/** 'idle' | 'loading' | 'ok' | 'error' */
export function statusOf(path) {
  if (loaded.has(path)) return 'ok';
  if (failed.has(path)) return 'error';
  if (requests.has(path)) return 'loading';
  return 'idle';
}
export const getLoaded = (path) => loaded.get(path) ?? null;
export const loadedPaths = () => [...loaded.keys()];

/** 불러온 파일 중 하나라도 mock이면 true */
export function anyMock() {
  for (const d of loaded.values()) if (d && d.mock === true) return true;
  return false;
}

export const PATHS = {
  manifest: 'manifest.json',
  geo: 'geo/sido-tiles.json',
  stations: 'obs/stations.json',
  emissions: 'co2/emissions.json',
};

/* ───────────── 파생값 (순수 함수) ───────────── */

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function mean(values) {
  let sum = 0;
  let n = 0;
  for (const v of values) if (isNum(v)) { sum += v; n += 1; }
  return n ? sum / n : null;
}

/** 연별 자료 한 줄: source = 'current' 또는 시나리오 id. 없으면 null */
export function seriesOf(el, source, region) {
  if (!el) return null;
  const block = source === 'current' ? el.current : el.projection;
  if (!block || !block.annual) return null;
  const arr = source === 'current' ? block.annual[region] : block.annual[source]?.[region];
  if (!Array.isArray(arr)) return null;
  return { startYear: block.startYear, values: arr };
}

/** 자료 블록이 덮는 연도 범위 [첫해, 끝해] — 전국(00) 또는 첫 지역 배열 길이로 판단 */
export function blockRange(el, which) {
  const block = which === 'current' ? el?.current : el?.projection;
  if (!block?.annual) return null;
  let arr;
  if (which === 'current') arr = block.annual['00'] ?? Object.values(block.annual)[0];
  else {
    const first = Object.values(block.annual)[0];
    arr = first && (first['00'] ?? Object.values(first)[0]);
  }
  if (!Array.isArray(arr)) return null;
  return [block.startYear, block.startYear + arr.length - 1];
}

/** 이 연도의 시도 자료가 어디에 있는지: 'current' | 'projection' | 'none' */
export function yearSource(el, year) {
  const c = blockRange(el, 'current');
  if (c && year >= c[0] && year <= c[1]) return 'current';
  const p = blockRange(el, 'projection');
  if (p && year >= p[0] && year <= p[1]) return 'projection';
  return 'none';
}

function valueInSeries(s, year) {
  if (!s) return null;
  const i = year - s.startYear;
  if (i < 0 || i >= s.values.length) return null;
  return isNum(s.values[i]) ? s.values[i] : null;
}

/** 연도 하나의 시도 값: 현재기후 기간이면 현재기후, 전망 기간이면 그 시나리오 값, 그 밖(2020년 등)은 null */
export function regionYearValue(el, scen, region, year) {
  const src = yearSource(el, year);
  if (src === 'current') return valueInSeries(seriesOf(el, 'current', region), year);
  if (src === 'projection') return valueInSeries(seriesOf(el, scen, region), year);
  return null;
}

/** 관측 자료 한 줄에서 연도 값 */
export function obsYearValue(obsSeries, year) {
  return obsSeries ? valueInSeries({ startYear: obsSeries.startYear, values: obsSeries.values }, year) : null;
}

/** 현재기후(2000~2019) 공식값 — 변화량의 기준 */
export function curValue(el, region) {
  const v = el?.official?.cur?.[region];
  return isNum(v) ? v : null;
}

/** 파생 기간(공식 20년 값이 없는 구간)에 필요한 10년 구간 시작 연도들. 예: 2061~2080 → [2061, 2071] */
export function decadeStarts(meta) {
  const out = [];
  for (let y = meta.start; y <= meta.end; y += 10) out.push(y);
  return out;
}

/** 파생 기간을 계산할 10년 공식값이 (어느 시나리오에든) 있는지 — 없으면 칩을 비활성화 */
export function derivedAvailable(el, meta) {
  const dec = el?.official?.decades;
  if (!dec) return false;
  const starts = decadeStarts(meta);
  return Object.values(dec).some((sc) => sc && starts.every((y) => sc[String(y)] && typeof sc[String(y)] === 'object'));
}

/** 공식 10년 값들의 평균 (앱 계산). 구간 안의 10년 값이 하나라도 없으면 null */
export function derivedPeriodValue(el, scen, meta, region) {
  const dec = el?.official?.decades?.[scen];
  if (!dec) return null;
  const vals = [];
  for (const y of decadeStarts(meta)) {
    const v = dec[String(y)]?.[region];
    if (!isNum(v)) return null;
    vals.push(v);
  }
  return vals.length ? mean(vals) : null;
}

/** 기간 값: 현재(cur)는 공식 현재기후 값, 파생 기간은 10년 값 평균, 나머지는 공식 20년 값 */
export function periodValue(el, scen, periodId, region, periods) {
  if (periodId === 'cur') return curValue(el, region);
  const meta = periods?.find((p) => p.id === periodId);
  if (meta?.derived) return derivedPeriodValue(el, scen, meta, region);
  const v = el?.official?.periods?.[scen]?.[periodId]?.[region];
  return isNum(v) ? v : null;
}

/**
 * 표시 방식에 맞게 바꿉니다.
 *  abs: 값 그대로 / chg: 값 − 현재 / chg + pct: (값 − 현재) / 현재 × 100
 */
export function toMode(value, base, mode, pct = false) {
  if (!isNum(value)) return null;
  if (mode === 'abs') return value;
  if (!isNum(base)) return null;
  if (pct) return base === 0 ? null : ((value - base) / base) * 100;
  return value - base;
}

/** 시나리오 차이 B − A (둘 중 하나라도 없으면 null). % 모드 값끼리 빼면 %p가 됩니다. */
export function diffBA(a, b) {
  return isNum(a) && isNum(b) ? b - a : null;
}

/**
 * 화면에 보일 값 하나: 기간(period) 또는 연도(year) 기준, 표시 방식 반영.
 * opts = { scen, region, mode, pct, period, year, periods }
 */
export function measure(el, opts) {
  const { scen, region, mode, pct = false, period, year = null, periods } = opts;
  const raw = year != null
    ? regionYearValue(el, scen, region, year)
    : periodValue(el, scen, period, region, periods);
  return toMode(raw, curValue(el, region), mode, pct);
}

/** 보기 좋은 눈금 간격 */
export function niceStep(span, target = 6) {
  if (!(span > 0)) return 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nf * mag;
}

/**
 * 시계열 그래프 y축 범위. 선택한 지역(들)의 현재기후와 4개 시나리오 전체(+켜져 있으면 관측)를 포함해 고정합니다.
 * → 시나리오 A·B를 바꿔도 축이 흔들리지 않습니다.
 * opts = { regions, scenarios, mode, pct, extra: [관측 값들], zeroFloor }
 */
export function chartRange(el, opts) {
  const { regions, scenarios, mode, pct = false, extra = [], zeroFloor = false } = opts;
  let lo = Infinity;
  let hi = -Infinity;
  const add = (v) => { if (isNum(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } };
  for (const r of regions) {
    const base = curValue(el, r);
    seriesOf(el, 'current', r)?.values.forEach((v) => add(toMode(v, base, mode, pct)));
    add(toMode(base, base, mode, pct));
    for (const s of scenarios) seriesOf(el, s, r)?.values.forEach((v) => add(toMode(v, base, mode, pct)));
  }
  extra.forEach(add);
  if (!Number.isFinite(lo)) return null;
  if (mode !== 'abs') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1;
  lo -= pad;
  hi += pad;
  if (zeroFloor) lo = 0;   // 일수(값 모드)는 0에서 시작
  const step = niceStep(hi - lo);
  return {
    min: Math.floor(lo / step) * step,
    max: Math.ceil(hi / step) * step,
    step,
  };
}

/**
 * 요소 파일에 scale이 없을 때만 쓰는 대비책: 4개 시나리오 × 모든 기간 × 모든 지역으로 한 번 계산.
 * (요소마다 고정이므로 조건을 바꿔도 색 범위는 흔들리지 않습니다.)
 */
export function fallbackScale(el, scenarios, regions, periods) {
  const absv = [];
  const chg = [];
  const pct = [];
  const diff = [];
  const pdiff = [];
  for (const r of regions) {
    const cur = curValue(el, r);
    const per = scenarios.map((s) => periods.map((p) => periodValue(el, s, p.id, r, periods)));
    per.forEach((row) => row.forEach((v) => {
      if (!isNum(v)) return;
      absv.push(v);
      if (isNum(cur)) { chg.push(Math.abs(v - cur)); if (cur) pct.push(Math.abs(((v - cur) / cur) * 100)); }
    }));
    for (let i = 0; i < per.length; i += 1) {
      for (let j = i + 1; j < per.length; j += 1) {
        periods.forEach((p, k) => {
          if (p.id === 'cur') return;
          const d = diffBA(per[i][k], per[j][k]);
          if (!isNum(d)) return;
          diff.push(Math.abs(d));
          if (isNum(cur) && cur) pdiff.push(Math.abs((d / cur) * 100));
        });
      }
    }
  }
  const max = (a) => (a.length ? Math.max(...a) : 1);
  return {
    abs: absv.length ? [Math.min(...absv), Math.max(...absv)] : [0, 1],
    chg: max(chg),
    diff: max(diff),
    pct: max(pct),
    pctDiff: max(pdiff),
  };
}
