// chart.js — 시계열 그래프 (Chart.js 4 + annotation 플러그인, CDN의 전역 Chart 사용)
// 관측·현재기후·전망은 모두 별도 데이터셋이고 서로 잇지 않습니다. 빈 값(null)은 선을 끊습니다(spanGaps:false).
import * as D from './data.js';
import { DEFAULT_X_MIN } from './state.js';
import { T, esc, fmtNum, fmtSigned, fmtDiff, unitOf, modeName, withUnit, periodOnlyNote } from './text.js';

let chart = null;
let actionsRef = null;
let lastView = null;

const C_OBS = '#9aa1ab';   // 관측: 옅은 회색 가는 점선 + 작은 점
const C_CUR = '#262b33';   // 현재기후: 진한 회색 굵은 실선
const FILL_AB = 'rgba(115, 125, 140, 0.16)';

/* ───────────── 자료 → 점 ───────────── */

function points(series, base, mode, pct, from = -Infinity) {
  if (!series) return [];
  return series.values.map((val, i) => ({ x: series.startYear + i, y: D.toMode(val, base, mode, pct) }))
    .filter((p) => p.x >= from);
}

function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/* ───────────── 그래프 구성 ───────────── */

function build(v) {
  const { s, el, manifest } = v;
  const periods = manifest.periods;
  const regions = [s.regionA, ...(s.regionB ? [s.regionB] : [])];
  const compare = regions.length === 2;
  const scenA = v.scenMeta(s.scenA);
  const scenB = s.scenB ? v.scenMeta(s.scenB) : null;
  const others = s.showAll4 && !compare ? manifest.scenarios.filter((m) => m.id !== s.scenA && m.id !== s.scenB) : [];
  const obsSeries = v.obsOn && v.stations ? v.stations.series?.[s.obsLayer.series] : null;
  const curRange = D.blockRange(el, 'current');
  const xMin = obsSeries ? obsSeries.startYear : DEFAULT_X_MIN;
  const xMax = D.blockRange(el, 'projection')?.[1] ?? 2100;
  const dash = (r) => (r === s.regionB ? [7, 5] : []);

  const datasets = [];
  if (obsSeries) {
    datasets.push({
      key: 'obs', data: points(obsSeries, 0, 'abs', false), // 이미 2000~2019 기준 편차
      borderColor: C_OBS, backgroundColor: C_OBS, borderWidth: 1.2, borderDash: [3, 3], pointRadius: 1.6, pointHoverRadius: 1.6, order: 50,
    });
  }
  let idxA = -1;
  // 연별 값이 없는 지역(전국 등)은 선 없이 공식 20년 평균 막대만 그림. 시도 값을 평균해 만들지 않음
  const periodOnly = regions.filter((r) => !D.hasAnnual(el, r));
  regions.forEach((r) => {
    if (periodOnly.includes(r)) return;
    const base = D.curValue(el, r);
    datasets.push({
      key: `cur-${r}`, data: points(D.seriesOf(el, 'current', r), base, s.mode, v.pct),
      borderColor: C_CUR, borderWidth: 2.8, borderDash: dash(r), pointRadius: 0, order: 40,
    });
    others.forEach((m) => datasets.push({
      key: `oth-${m.id}`, data: points(D.seriesOf(el, m.id, r), base, s.mode, v.pct),
      borderColor: alpha(m.color, 0.85), borderWidth: 1.2, pointRadius: 0, order: 30,
    }));
    const a = { key: `A-${r}`, data: points(D.seriesOf(el, s.scenA, r), base, s.mode, v.pct), borderColor: scenA.color, borderWidth: 2.5, borderDash: dash(r), pointRadius: 0, order: 10 };
    datasets.push(a);
    if (r === s.regionA) idxA = datasets.length - 1;
    if (scenB) {
      const b = { key: `B-${r}`, data: points(D.seriesOf(el, s.scenB, r), base, s.mode, v.pct), borderColor: scenB.color, borderWidth: 2.5, borderDash: dash(r), pointRadius: 0, order: 10 };
      // A·B 사이를 옅게 채움 (지역 비교 중에는 선이 많아 생략)
      if (!compare && r === s.regionA && idxA > -1) b.fill = { target: idxA, above: FILL_AB, below: FILL_AB };
      datasets.push(b);
    }
  });
  datasets.forEach((d) => { d.spanGaps = false; d.fill = d.fill ?? false; d.tension = 0; });

  // 주석: 현재기후 평균 띠, 0선, 선택 기간 음영, 20년 평균 막대, 연도 커서
  const ann = {};
  if (s.mode !== 'abs') ann.zero = { type: 'line', yMin: 0, yMax: 0, borderColor: '#8a929e', borderWidth: 1, drawTime: 'beforeDatasetsDraw' };
  if (curRange) {
    regions.forEach((r) => {
      const base = D.curValue(el, r);
      const y = D.toMode(base, base, s.mode, v.pct);
      if (!D.isNum(y)) return;
      ann[`curband-${r}`] = { type: 'line', xMin: curRange[0], xMax: curRange[1], yMin: y, yMax: y, borderColor: 'rgba(71, 78, 89, 0.28)', borderWidth: 9, borderDash: dash(r), drawTime: 'beforeDatasetsDraw' };
    });
  }
  if (s.year == null) {
    const pm = v.periodMeta(s.period);
    if (pm) ann.sel = { type: 'box', xMin: pm.start - 0.5, xMax: pm.end + 0.5, backgroundColor: 'rgba(28, 35, 48, 0.07)', borderWidth: 0, drawTime: 'beforeDatasetsDraw' };
  }
  // 20년 평균 가로선
  //  · 「20년 평균」 켬: 모든 기간(전반기·중반기·2061~2080·후반기)의 A·B 가로선
  //  · 끔(기본): 지금 선택한 기간(음영)의 A·B만 얇고 반투명하게 — 지도에 칠한 값이 그래프의 어느 값인지 이어 줌.
  //    연도 보기에서는 지도가 20년 평균이 아니므로 이것도 숨김
  //  · 연별 선이 없는 지역(전국)은 이 막대가 유일한 자료라 늘 모두 그림
  const barScens = [scenA, ...(scenB ? [scenB] : [])];
  const selPeriod = s.year == null ? s.period : null;
  let derivedShown = false;
  let allBarsShown = false;
  let selBarsShown = false;
  periods.filter((p) => p.id !== 'cur').forEach((p) => {
    regions.forEach((r) => {
      const po = periodOnly.includes(r);
      const full = s.periodBars || po;
      const faint = !full;
      if (faint && p.id !== selPeriod) return;
      // 4개 모두: 연별 선이 없는 지역은 나머지 시나리오를 가는 20년 평균 막대로 추가
      const scens = po ? [...barScens, ...others] : barScens;
      scens.forEach((m) => {
        const y = D.toMode(D.periodValue(el, m.id, p.id, r, periods), D.curValue(el, r), s.mode, v.pct);
        if (!D.isNum(y)) return;
        if (full) { allBarsShown = allBarsShown || s.periodBars; if (p.derived) derivedShown = true; } else selBarsShown = true;
        const thin = others.includes(m);
        if (full) {
          // 흰 테두리를 먼저 깔아 같은 색 선 위에서도 막대가 보이게
          ann[`halo-${p.id}-${r}-${m.id}`] = {
            type: 'line', xMin: p.start - 0.3, xMax: p.end + 0.3, yMin: y, yMax: y,
            borderColor: 'rgba(255,255,255,0.95)', borderWidth: thin ? 6 : 9, borderCapStyle: 'butt', drawTime: 'afterDatasetsDraw',
          };
        }
        ann[`bar-${p.id}-${r}-${m.id}`] = {
          type: 'line', xMin: p.start, xMax: p.end, yMin: y, yMax: y,
          borderColor: faint ? alpha(m.color, p.derived ? 0.4 : 0.6) : p.derived ? alpha(m.color, 0.5) : m.color,
          borderWidth: faint ? 2.5 : thin ? 2.5 : 5, borderDash: dash(r),
          borderCapStyle: 'butt', drawTime: 'afterDatasetsDraw',
        };
      });
    });
  });
  // 현재기후 연도별 선(진한 회색)에 이름표 — 관측 점선과 헷갈리지 않게
  const lineRegions = regions.filter((r) => !periodOnly.includes(r));
  if (lineRegions.length && curRange) {
    const base = D.curValue(el, lineRegions[0]);
    const cv = (D.seriesOf(el, 'current', lineRegions[0])?.values ?? []).map((x) => D.toMode(x, base, s.mode, v.pct)).filter(D.isNum);
    if (cv.length) {
      const names = lineRegions.map((r) => v.regionMeta(r)?.short ?? r).join('·');
      // 관측을 켜서 x축이 1912년부터면 선 끝(2019년)에 맞춰 왼쪽으로, 아니면 선 시작(2000년)에서 오른쪽으로
      const leftward = !!obsSeries;
      ann.curLabel = {
        type: 'label', xValue: leftward ? curRange[1] + 0.5 : curRange[0], yValue: Math.max(...cv),
        position: { x: leftward ? 'end' : 'start', y: 'end' }, yAdjust: -7,
        content: [`현재기후 · ${names} 평균(${curRange[0]}~${curRange[1]})`], color: C_CUR, font: { size: 14, weight: '800' },
        backgroundColor: 'rgba(255, 255, 255, 0.82)', borderColor: C_CUR, borderWidth: 1, borderRadius: 6, padding: { x: 6, y: 3 },
        drawTime: 'beforeDatasetsDraw',
      };
    }
  }
  // 회색 관측선 이름표를 선 바로 옆(앞쪽 20여 년 위)에 — 지역(예: 서울) 자료로 오해하지 않게 지점 자료임을 분명히
  if (obsSeries) {
    const head = obsSeries.values.slice(0, 25).filter(D.isNum);
    if (head.length) {
      ann.obsLabel = {
        type: 'label', xValue: obsSeries.startYear + 1, yValue: Math.max(...head), position: { x: 'start', y: 'end' },
        yAdjust: -6, content: [obsLabelText(obsSeries)], color: '#6b7382', font: { size: 14, weight: '600' },
        backgroundColor: 'rgba(255, 255, 255, 0.88)', borderColor: C_OBS, borderWidth: 1, borderDash: [3, 3], borderRadius: 6,
        padding: { x: 6, y: 3 }, drawTime: 'afterDatasetsDraw',
      };
    }
  }
  if (s.year != null) ann.cursor = { type: 'line', xMin: s.year, xMax: s.year, borderColor: '#1c2330', borderWidth: 1.5, borderDash: [4, 4], drawTime: 'afterDatasetsDraw' };

  // y축: 요소·모드·지역 기준, 4개 시나리오 전체 포함 → A·B를 바꿔도 고정
  const extra = obsSeries ? obsSeries.values : [];
  const range = D.chartRange(el, {
    regions, scenarios: manifest.scenarios.map((m) => m.id), mode: s.mode, pct: v.pct, periods, extra,
    zeroFloor: s.mode === 'abs' && v.elMeta.kind === 'days',
  }) ?? { min: 0, max: 1, step: 1 };

  return { datasets, ann, range, xMin, xMax, regions, compare, scenA, scenB, others, obsSeries, derivedShown, periodOnly, allBarsShown, selBarsShown };
}

/** 관측 자료 이름표: "관측 · 6개 지점 평균(지점값)" */
export function obsLabelText(series) {
  return `관측 · ${series.name}(지점값)`;
}

/* ───────────── 도구 줄·범례·안내 ───────────── */

/** 그래프 안 왼쪽 위 작은 범례: 시나리오 색 점 + 이름, 「20년 평균」을 켰을 때만 ▬ 20년 평균 */
function innerLegendHTML(b) {
  const items = [b.scenA, ...(b.scenB ? [b.scenB] : []), ...b.others];
  let html = items.map((m) => `<span class="li"><span class="sdot" style="--c:${esc(m.color)}"></span>${esc(m.label)}</span>`).join('');
  if (b.allBarsShown) {
    html += `<span class="li"><span class="bar-sw" aria-hidden="true"></span>20년 평균</span>`;
    if (b.derivedShown) html += `<span class="li"><span class="bar-sw light" aria-hidden="true"></span>20년 평균(${T.appCalc})</span>`;
  }
  return html;
}

function toolsHTML(v) {
  const { s } = v;
  const series = v.stations?.series ?? {};
  const obsDisabled = !v.obsAllowed || !v.stations;
  const all4Disabled = !!s.regionB;
  const opts = Object.entries(series).map(([k, val]) => `<option value="${esc(k)}" ${k === s.obsLayer.series ? 'selected' : ''}>${esc(val.name)}</option>`).join('');
  return `
    <label class="check${all4Disabled ? ' disabled' : ''}" title="${all4Disabled ? T.all4Disabled : ''}">
      <input type="checkbox" data-change="all4" data-key="all4" ${s.showAll4 && !all4Disabled ? 'checked' : ''} ${all4Disabled ? 'disabled' : ''}>
      <span>4개 모두</span></label>
    <label class="check${obsDisabled ? ' disabled' : ''}"><input type="checkbox" data-change="obs-on" data-key="obs-on"
      ${v.obsOn ? 'checked' : ''} ${obsDisabled ? 'disabled' : ''}><span>관측 겹쳐 보기</span></label>
    <select data-change="obs-series" data-key="obs-series" aria-label="관측 자료 고르기" ${obsDisabled || !s.obsLayer.on ? 'disabled' : ''}>${opts}</select>
    <label class="check"><input type="checkbox" data-change="period-bars" data-key="period-bars" ${s.periodBars ? 'checked' : ''}>
      <span>20년 평균</span></label>
    <button class="icon-btn" data-action="graph-info" data-key="graph-info" aria-haspopup="dialog" aria-label="그래프 읽는 법">ⓘ</button>`;
}

/** 그래프 아래 한 줄 — 지금 상황에 맞는 짧은 문장 하나 */
function noteLine(v, b) {
  const { s } = v;
  const parts = [];
  if (b.periodOnly.length) parts.push(`<b>${esc(b.periodOnly.map((r) => periodOnlyNote(v.regionMeta(r)?.short ?? r)).join(' / '))}</b>`);
  if (b.compare) parts.push(`실선 ${esc(v.regionMeta(s.regionA)?.short)} · 점선 ${esc(v.regionMeta(s.regionB)?.short)}`);
  if (b.periodOnly.length === b.regions.length) parts.push(T.graphLinePeriodOnly);
  else {
    parts.push(b.obsSeries ? T.graphLineObs : T.graphLine);
    if (b.allBarsShown) parts.push(T.graphLineBars);
    else if (b.selBarsShown) parts.push(T.graphLineSelBar);
  }
  if (!v.obsAllowed) parts.push(`관측: ${v.elMeta?.kind !== 'temp' ? T.obsOnlyTemp : T.obsNeedsChg}`);
  if (s.regionB) parts.push('지역 비교 중에는 4개 모두를 쓸 수 없어요');
  return parts.join(' · ');
}

/* ───────────── 연도 정보 줄 (그래프 위쪽 가장자리) ───────────── */

function yearStripHTML(v, b) {
  const { s, el, elMeta } = v;
  const y = s.year;
  const nm = (c) => v.regionMeta(c)?.short ?? c;
  const src = D.yearSource(el, y);
  const kind = src === 'projection' ? '전망 · 5개 모델 평균' : src === 'current' ? '현재기후 · 면적 평균' : b.obsSeries ? '관측' : '';
  const fmtV = (val) => (s.mode === 'abs' ? withUnit(fmtNum(val), elMeta.unit) : withUnit(fmtSigned(val), unitOf(elMeta, v.pct, 'change')));
  const item = (dot, label, val, cls = '') => `<span class="yi ${cls}">${dot}<span class="nm">${label}</span><b>${val}</b></span>`;
  const dot = (c) => `<span class="sdot" style="--c:${esc(c)}"></span>`;
  let body = '';
  if (src === 'none') {
    const cr = D.blockRange(el, 'current');
    body += `<span class="msg">${cr && y > cr[1] ? `${y}년은 시나리오·현재기후 자료에 없는 해입니다.` : '이 연도에는 시도 자료가 없습니다.'}</span>`;
  } else {
    b.regions.forEach((r) => {
      const base = D.curValue(el, r);
      const pre = b.compare ? `<span class="grp">${esc(nm(r))}</span>` : '';
      if (b.periodOnly.includes(r)) { body += `${pre}<span class="msg">${esc(periodOnlyNote(nm(r)))}</span>`; return; }
      if (src === 'current') {
        body += pre + item(`<span class="sdot" style="--c:${C_CUR}"></span>`, '현재기후', fmtV(D.toMode(D.regionYearValue(el, s.scenA, r, y), base, s.mode, v.pct)));
        return;
      }
      const a = D.toMode(D.regionYearValue(el, s.scenA, r, y), base, s.mode, v.pct);
      body += pre + item(dot(b.scenA.color), esc(b.scenA.label), fmtV(a));
      if (b.scenB) {
        const bb = D.toMode(D.regionYearValue(el, s.scenB, r, y), base, s.mode, v.pct);
        body += item(dot(b.scenB.color), esc(b.scenB.label), fmtV(bb));
        body += item('', `B−A <span class="calc">(${T.appCalc})</span>`, fmtDiff(D.diffBA(a, bb), elMeta, v.pct), 'diff');
      }
    });
  }
  if (b.obsSeries) {
    const o = D.obsYearValue(b.obsSeries, y);
    body += item('<span class="obs-dot"></span>', esc(obsLabelText(b.obsSeries)), D.isNum(o) ? withUnit(fmtSigned(o), '℃') : '자료 없음');
  }
  return `<div class="ys-row"><b class="yr">${y}년</b>${kind ? `<span class="kind">${kind}</span>` : ''}${body}
      <button class="x" data-action="clear-year" data-key="ys-close" aria-label="연도 보기 끝내기">✕</button></div>
    ${src === 'projection' ? `<p class="fc">${T.notWeather}</p>` : ''}`;
}

/* ───────────── 기간 띠 (x축과 같은 위치) ───────────── */

function placePeriodBand(root) {
  const band = root.querySelector('.period-band');
  if (!band || !chart || !lastView) return;
  const sx = chart.scales.x;
  const { periods } = lastView.manifest;
  const s = lastView.s;
  // 띠와 그래프 캔버스의 왼쪽 끝 차이 (둘 다 같은 카드 안)
  const offset = chart.canvas.getBoundingClientRect().left - band.getBoundingClientRect().left;
  const cells = periods.map((p) => {
    const x0 = Math.max(sx.left, sx.getPixelForValue(p.start - 0.5));
    const x1 = Math.min(sx.right, sx.getPixelForValue(p.end + 0.5));
    return { p, x0, w: x1 - x0 };
  });
  // x축 위치에 맞춘 칸이 누르기에 너무 좁으면(44px 미만) 그래프 폭에 같은 너비로 나란히 놓고,
  // 위치가 맞지 않는 대신 칸마다 연도 범위를 함께 적음 (선택 구간은 그래프 음영으로도 보임)
  const aligned = cells.every((c) => c.w >= 44);
  band.classList.toggle('compact', !aligned);
  const btn = (p, extra, inner) => {
    const off = p.derived && !lastView.derivedOk(p);
    const full = p.derived ? `${p.label}*` : p.label;
    return `<button class="pb" data-action="period" data-id="${esc(p.id)}" data-key="pb-${esc(p.id)}" ${off ? 'disabled' : ''}
      aria-pressed="${s.year == null && p.id === s.period}" ${extra} aria-label="${esc(full)} ${p.start}~${p.end}년">${inner}</button>`;
  };
  if (!aligned) {
    const bandW = band.getBoundingClientRect().width;
    band.style.paddingLeft = `${Math.max(0, offset + sx.left)}px`;
    band.style.paddingRight = `${Math.max(0, bandW - (offset + sx.right))}px`;
    band.innerHTML = cells.map(({ p }) => btn(p, '',
      `<span class="pn">${esc(p.derived ? `${T.appCalc}*` : p.label)}</span><span class="yrs">${p.start}~<wbr>${p.end}</span>`)).join('');
    return;
  }
  band.style.paddingLeft = '';
  band.style.paddingRight = '';
  band.innerHTML = cells.map(({ p, x0, w }) => {
    const full = p.derived ? `${p.label}*` : p.label;
    const short = p.derived ? `${p.start % 100}~${p.end % 100}*` : p.label;
    const text = w >= full.length * 9 + 10 ? full : short;
    return btn(p, `style="left:${offset + x0 + 1}px;width:${w - 2}px"`, esc(text));
  }).join('');
}

/* ───────────── 그리기 ───────────── */

function skeleton(root) {
  root.innerHTML = `
    <div class="chart-tools"></div>
    <div class="year-strip" hidden></div>
    <div class="chart-wrap"><canvas role="img" aria-label="연도별 값 그래프"></canvas><div class="in-legend"></div></div>
    <div class="period-band" role="group" aria-label="기간 선택 (그래프 x축과 같은 위치)"></div>
    <p class="graph-note"></p>`;
  root.dataset.built = '1';
}

function setOverlay(root, v) {
  root.querySelector(':scope > .overlay')?.remove();
  let html = '';
  if (v.elStatus === 'error') html = `<div class="overlay error"><span class="pill">${T.loadFail} <button class="chip small" data-action="retry-element">${T.retry}</button></span></div>`;
  else if (!v.el) html = `<div class="overlay"><span class="pill"><span class="spinner"></span>${T.loading}</span></div>`;
  if (html) root.insertAdjacentHTML('beforeend', html);
}

export function renderChart(root, v, actions) {
  actionsRef = actions;
  if (!v.manifest) return;
  if (!root.dataset.built) skeleton(root);
  setOverlay(root, v);
  if (!v.el) return;
  if (typeof window.Chart === 'undefined') {
    root.querySelector('.chart-wrap').innerHTML = `<p class="placeholder">그래프 도구(Chart.js)를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>`;
    return;
  }
  lastView = v;
  const { s } = v;
  const b = build(v);

  root.querySelector('.chart-tools').innerHTML = toolsHTML(v);
  const wrap = root.querySelector('.chart-wrap');
  wrap.classList.toggle('is-mock', !!v.mock);
  root.querySelector('.in-legend').innerHTML = innerLegendHTML(b);

  // 연도 정보 줄 (그래프 위쪽 가장자리, 그래프를 가리지 않음)
  const strip = root.querySelector('.year-strip');
  if (s.year != null) { strip.hidden = false; strip.innerHTML = yearStripHTML(v, b); }
  else { strip.hidden = true; strip.innerHTML = ''; }

  const yUnit = s.mode === 'abs' ? v.elMeta.unit : unitOf(v.elMeta, v.pct, 'change');
  const yTitle = `${yUnit} (${modeName(s.mode, v.pct)})`;
  const xStep = b.xMax - b.xMin > 120 ? 20 : 10;

  if (!chart) {
    const ctx = root.querySelector('canvas');
    window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    window.Chart.defaults.font.size = 14;
    window.Chart.defaults.color = '#4b5262';
    chart = new window.Chart(ctx, {
      type: 'line',
      data: { datasets: [] },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        normalized: true,
        events: ['click'],
        layout: { padding: { top: 6, right: 10, left: 2 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false }, annotation: { annotations: {} } },
        scales: {
          x: { type: 'linear', ticks: { includeBounds: false, callback: (val) => String(val), maxRotation: 0, font: { size: 14 } }, grid: { color: '#eceff3' } },
          y: { ticks: { maxTicksLimit: 7, font: { size: 14 } }, grid: { color: '#eceff3' }, title: { display: true, text: '', font: { size: 14 } } },
        },
        onClick: (evt, _els, ch) => {
          const { left, right, top, bottom } = ch.chartArea;
          if (evt.x < left - 6 || evt.x > right + 6 || evt.y < top - 6 || evt.y > bottom + 6) return;
          const sx = ch.scales.x;
          const year = Math.round(sx.getValueForPixel(evt.x));
          actionsRef?.setYear(Math.min(sx.max, Math.max(sx.min, year)));
        },
      },
      plugins: [{ id: 'periodBand', afterRender: () => placePeriodBand(root) }],
    });
  }
  chart.data.datasets = b.datasets;
  const o = chart.options;
  o.scales.x.min = b.xMin;
  o.scales.x.max = b.xMax;
  o.scales.x.ticks.stepSize = xStep;
  o.scales.y.min = b.range.min;
  o.scales.y.max = b.range.max;
  o.scales.y.title.text = yTitle;
  o.plugins.annotation.annotations = b.ann;
  chart.resize();
  chart.update('none');
  placePeriodBand(root);

  root.querySelector('.graph-note').innerHTML = noteLine(v, b);
  root.querySelector('canvas').setAttribute('aria-label', `${v.elMeta.name} 연도별 그래프, ${b.xMin}~${b.xMax}년, ${yTitle}`);
}
