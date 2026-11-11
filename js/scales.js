// scales.js — 지도 색 범위·색상표
// 범위는 요소 파일의 scale 값을 그대로 씁니다(고정). 지도 화면마다 범위를 다시 잡지 않습니다.
import { fallbackScale } from './data.js';

// 한쪽으로 진해지는 색 (값 모드)
const SEQ = {
  warm: ['#fff6c8', '#fed47a', '#fb9a4b', '#e2492b', '#9e0f1f'],   // 노랑 → 빨강 (기온·폭염·열대야)
  wet: ['#eef6fc', '#b5d6ee', '#6aa8d7', '#2e6fb1', '#0b3a78'],    // 연한 파랑 → 진한 파랑 (강수량)
  icy: ['#f0fafe', '#bfe6f5', '#7cc4e6', '#3a8cc9', '#124d8c'],    // 연한 하늘색 → 진한 파랑 (한파일수)
};
// 0이 흰색인 양방향 색 (변화량 모드·차이 지도)
const DIV = {
  temp: ['#1f5fa6', '#5d9ccc', '#b9d8ec', '#ffffff', '#f7c7b0', '#e2775a', '#b11f2b'],  // 파랑(줄어듦) – 흰 – 빨강(늘어남)
  prcp: ['#8a5310', '#cfa660', '#f1e3c4', '#ffffff', '#c3e7e2', '#53aea6', '#0b6a62'],  // 갈색(줄어듦) – 흰 – 청록(늘어남)
};

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c) => `#${c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;

function ramp(stops, t) {
  const u = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(u));
  const f = u - i;
  const a = hexToRgb(stops[i]);
  const b = hexToRgb(stops[i + 1]);
  return toHex(a.map((x, k) => x + (b[k] - x) * f));
}

/** 글자색: 바탕이 어두우면 흰 글씨 */
export function textOn(hex) {
  const [r, g, b] = hexToRgb(hex).map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L < 0.32 ? '#ffffff' : '#1c2330';
}

const fallbackCache = new WeakMap();
function scaleOf(el, v) {
  const sc = el?.scale;
  // 기간·연별로 나뉜 형식 { period:{…}, annual:{…} } 도 받음: 연도 보기에는 연별 범위, 그 밖에는 기간 범위
  if (sc?.period) return v.s.year != null && sc.annual ? sc.annual : sc.period;
  if (sc) return sc;
  // scale이 빠진 파일을 위한 대비책(요소마다 한 번 계산해 고정). 실제 데이터에는 scale을 넣어 주세요.
  if (!fallbackCache.has(el)) {
    console.warn('요소 파일에 scale이 없어 앱에서 계산합니다:', v.elMeta?.id);
    fallbackCache.set(el, fallbackScale(el, v.manifest.scenarios.map((s) => s.id), v.manifest.regions.map((r) => r.code), v.manifest.periods));
  }
  return fallbackCache.get(el);
}

/** scale 값 하나 → [최솟값, 최댓값]. 예전 대칭 형식(숫자 m)은 [−m, m]으로 읽음 */
export function rangeOf(val) {
  if (Array.isArray(val) && val.length === 2) return [Number(val[0]), Number(val[1])];
  if (typeof val === 'number' && Number.isFinite(val)) return [-Math.abs(val), Math.abs(val)];
  return null;
}

/**
 * 변화량·차이 지도의 0 기준 색: 0은 언제나 흰색.
 * 최솟값이 0 이상이면 [0, 최댓값] 한쪽 방향, 최댓값이 0 이하이면 [최솟값, 0] 한쪽 방향,
 * 양쪽에 걸치면 [최솟값, 최댓값] 비대칭 양방향 (0의 위치가 가운데가 아닐 수 있음).
 */
function zeroAnchored(range, stops) {
  const lo = Math.min(range[0], 0);
  const hi = Math.max(range[1], 0);
  const mid = (stops.length - 1) / 2;           // stops 가운데가 흰색
  const neg = stops.slice(0, mid + 1).reverse(); // 흰색 → 줄어듦 쪽 진한 색
  const pos = stops.slice(mid);                  // 흰색 → 늘어남 쪽 진한 색
  const color = (v) => (v >= 0 ? ramp(pos, hi > 0 ? v / hi : 0) : ramp(neg, lo < 0 ? v / lo : 0));
  const z = hi - lo > 0 ? ((0 - lo) / (hi - lo)) * 100 : 0;   // 범례에서 0의 위치(%)
  const parts = [];
  if (lo < 0) neg.slice().reverse().forEach((c, i) => parts.push(`${c} ${(i / (neg.length - 1)) * z}%`));
  if (hi > 0) pos.forEach((c, i) => parts.push(`${c} ${z + (i / (pos.length - 1)) * (100 - z)}%`));
  if (parts.length === 0) parts.push('#ffffff 0%', '#ffffff 100%');
  return { min: lo, max: hi, zero: z, color, gradient: `linear-gradient(to right, ${parts.join(', ')})` };
}

/**
 * 지금 조건의 지도 색 규칙. 범위는 요소·모드별로 자료 파일의 scale에서 고정(시나리오·기간을 바꿔도 그대로).
 * which: 'value'(나란히 지도) | 'diff'(차이 지도)
 * 반환: { type:'seq'|'div', min, max, zero(0의 위치 %, div만), color(v), gradient, low, high, outside(v), annualRange }
 */
export function mapScale(v, which) {
  const { s, elMeta, el, pct } = v;
  const sc = scaleOf(el, v);
  const isPrcp = elMeta.kind === 'prcp';
  const temp = elMeta.kind === 'temp';
  let out;
  let low;
  let high;
  if (s.mode === 'abs' && which !== 'diff') {
    // 값 모드: 한쪽으로 진해지는 색
    const [min, max] = rangeOf(sc.abs) ?? [0, 1];
    const stops = isPrcp ? SEQ.wet : elMeta.id === 'cold' ? SEQ.icy : SEQ.warm;
    const span = max - min || 1;
    out = { type: 'seq', min, max, color: (val) => ramp(stops, (val - min) / span),
      gradient: `linear-gradient(to right, ${stops.map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`).join(', ')})` };
    low = temp ? '낮음' : '적음';
    high = temp ? '높음' : '많음';
  } else {
    const key = which === 'diff' ? (pct ? 'pctDiff' : 'diff') : (pct ? 'pct' : 'chg');
    out = { type: 'div', ...zeroAnchored(rangeOf(sc[key]) ?? [-1, 1], isPrcp ? DIV.prcp : DIV.temp) };
    if (which === 'diff') { low = temp ? 'B가 더 낮음' : 'B가 더 적음'; high = temp ? 'B가 더 높음' : 'B가 더 많음'; }
    else { low = temp ? '낮아짐' : '줄어듦'; high = temp ? '높아짐' : '늘어남'; }
  }
  const outside = (val) => val < out.min - 1e-9 || val > out.max + 1e-9;
  // 연도 보기에서 연별 색 범위(scale.annual)를 쓰면 범례에 표시
  const annualRange = s.year != null && !!el?.scale?.period && !!el?.scale?.annual;
  return { ...out, low, high, outside, annualRange };
}
