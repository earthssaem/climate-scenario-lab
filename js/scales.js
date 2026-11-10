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
  if (el?.scale) return el.scale;
  // scale이 빠진 파일을 위한 대비책(요소마다 한 번 계산해 고정). 실제 데이터에는 scale을 넣어 주세요.
  if (!fallbackCache.has(el)) {
    console.warn('요소 파일에 scale이 없어 앱에서 계산합니다:', v.elMeta?.id);
    fallbackCache.set(el, fallbackScale(el, v.manifest.scenarios.map((s) => s.id), v.manifest.regions.map((r) => r.code), v.manifest.periods));
  }
  return fallbackCache.get(el);
}

/**
 * 지금 조건의 지도 색 규칙.
 * which: 'value'(나란히 지도) | 'diff'(차이 지도)
 * 반환: { type:'seq'|'div', min, max, color(v), gradient, low, high }
 */
export function mapScale(v, which) {
  const { s, elMeta, el, pct } = v;
  const sc = scaleOf(el, v);
  const isPrcp = elMeta.kind === 'prcp';
  const temp = elMeta.kind === 'temp';
  let type;
  let min;
  let max;
  let stops;
  let low;
  let high;
  if (which === 'diff') {
    const m = pct ? sc.pctDiff : sc.diff;
    type = 'div'; min = -m; max = m;
    stops = isPrcp ? DIV.prcp : DIV.temp;
    low = temp ? 'B가 더 낮음' : 'B가 더 적음';
    high = temp ? 'B가 더 높음' : 'B가 더 많음';
  } else if (s.mode === 'abs') {
    type = 'seq'; [min, max] = sc.abs;
    stops = isPrcp ? SEQ.wet : elMeta.id === 'cold' ? SEQ.icy : SEQ.warm;
    low = temp ? '낮음' : '적음';
    high = temp ? '높음' : '많음';
  } else {
    const m = pct ? sc.pct : sc.chg;
    type = 'div'; min = -m; max = m;
    stops = isPrcp ? DIV.prcp : DIV.temp;
    low = temp ? '낮아짐' : '줄어듦';
    high = temp ? '높아짐' : '늘어남';
  }
  const span = max - min || 1;
  const color = (val) => ramp(stops, (val - min) / span);
  const gradient = `linear-gradient(to right, ${stops.map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`).join(', ')})`;
  const outside = (val) => val < min - 1e-9 || val > max + 1e-9;
  return { type, min, max, color, gradient, low, high, outside };
}
