// chart.js — 시계열 그래프 (Chart.js 4 + annotation 플러그인, CDN의 전역 Chart 사용)
// 관측·현재기후·전망은 모두 별도 데이터셋이고 서로 잇지 않습니다. 빈 값(null)은 선을 끊습니다(spanGaps:false).
import * as D from './data.js';
import { DEFAULT_X_MIN } from './state.js';
import { T, esc, fmtNum, fmtSigned, fmtDiff, unitOf, modeName, withUnit } from './text.js';

let chart = null;
let actionsRef = null;
let lastView = null;

const C_OBS = '#8d949f';
const C_CUR = '#474e59';
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
      borderColor: C_OBS, backgroundColor: C_OBS, borderWidth: 1, pointRadius: 1.8, pointHoverRadius: 1.8, order: 50,
    });
  }
  let idxA = -1;
  regions.forEach((r) => {
    const base = D.curValue(el, r);
    datasets.push({
      key: `cur-${r}`, data: points(D.seriesOf(el, 'current', r), base, s.mode, v.pct),
      borderColor: C_CUR, borderWidth: 2, borderDash: dash(r), pointRadius: 0, order: 40,
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
      if (!compare && r === s.regionA) b.fill = { target: idxA, above: FILL_AB, below: FILL_AB };
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
  const barScens = [scenA, ...(scenB ? [scenB] : [])];
  let derivedShown = false;
  periods.filter((p) => p.id !== 'cur').forEach((p) => {
    regions.forEach((r) => {
      barScens.forEach((m) => {
        const y = D.toMode(D.periodValue(el, m.id, p.id, r, periods), D.curValue(el, r), s.mode, v.pct);
        if (!D.isNum(y)) return;
        if (p.derived) derivedShown = true;
        // 흰 테두리를 먼저 깔아 같은 색 선 위에서도 막대가 보이게
        ann[`halo-${p.id}-${r}-${m.id}`] = {
          type: 'line', xMin: p.start - 0.3, xMax: p.end + 0.3, yMin: y, yMax: y,
          borderColor: 'rgba(255,255,255,0.95)', borderWidth: 9, borderCapStyle: 'butt', drawTime: 'afterDatasetsDraw',
        };
        ann[`bar-${p.id}-${r}-${m.id}`] = {
          type: 'line', xMin: p.start, xMax: p.end, yMin: y, yMax: y,
          borderColor: p.derived ? alpha(m.color, 0.5) : m.color, borderWidth: 5, borderDash: dash(r),
          borderCapStyle: 'butt', drawTime: 'afterDatasetsDraw',
        };
      });
    });
  });
  if (s.year != null) ann.cursor = { type: 'line', xMin: s.year, xMax: s.year, borderColor: '#1c2330', borderWidth: 1.5, borderDash: [4, 4], drawTime: 'afterDatasetsDraw' };

  // y축: 요소·모드·지역 기준, 4개 시나리오 전체 포함 → A·B를 바꿔도 고정
  const extra = obsSeries ? obsSeries.values : [];
  const range = D.chartRange(el, {
    regions, scenarios: manifest.scenarios.map((m) => m.id), mode: s.mode, pct: v.pct, extra,
    zeroFloor: s.mode === 'abs' && v.elMeta.kind === 'days',
  }) ?? { min: 0, max: 1, step: 1 };

  return { datasets, ann, range, xMin, xMax, regions, compare, scenA, scenB, others, obsSeries, derivedShown };
}

/* ───────────── 범례·안내 ───────────── */

function sample({ color, width = 2.5, dash = '', dot = false, band = false, bar = false }) {
  if (band) return `<svg width="26" height="12" aria-hidden="true"><line x1="1" x2="25" y1="6" y2="6" stroke="rgba(71,78,89,0.3)" stroke-width="9"/></svg>`;
  if (bar) return `<svg width="26" height="12" aria-hidden="true"><line x1="3" x2="23" y1="6" y2="6" stroke="${color}" stroke-width="5"/></svg>`;
  return `<svg width="26" height="12" aria-hidden="true"><line x1="1" x2="25" y1="6" y2="6" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>${dot ? `<circle cx="7" cy="6" r="2.2" fill="${color}"/><circle cx="19" cy="6" r="2.2" fill="${color}"/>` : ''}</svg>`;
}

function legendHTML(v, b) {
  const { s } = v;
  const nm = (c) => v.regionMeta(c)?.short ?? c;
  const items = [];
  if (b.obsSeries) items.push([sample({ color: C_OBS, width: 1, dot: true }), `관측 · ${esc(b.obsSeries.name)} (지점값)`]);
  const where = b.compare ? `${nm(s.regionA)}·${nm(s.regionB)}` : nm(s.regionA);
  const yrs = D.blockRange(v.el, 'current');
  items.push([sample({ color: C_CUR, width: 2 }), `현재기후 · ${esc(where)} 평균${yrs ? ` (${yrs[0]}~${yrs[1]})` : ''}`]);
  items.push([sample({ band: true }), '현재기후 평균']);
  items.push([sample({ color: b.scenA.color }), `${esc(b.scenA.label)} 전망 · ${esc(where)} 평균`]);
  if (b.scenB) items.push([sample({ color: b.scenB.color }), `${esc(b.scenB.label)} 전망 · ${esc(where)} 평균`]);
  b.others.forEach((m) => items.push([sample({ color: m.color, width: 1.2 }), `${esc(m.label)} 전망`]));
  items.push([sample({ color: '#5b6475', bar: true }), `20년 평균${b.derivedShown ? ' (2061~2080은 앱 계산, 옅게)' : ''}`]);
  if (b.compare) items.push([`${sample({ color: '#1c2330', width: 2 })}${sample({ color: '#1c2330', width: 2, dash: '7 5' })}`, `실선 ${esc(nm(s.regionA))} · 점선 ${esc(nm(s.regionB))}`]);
  return items.map(([sw, label]) => `<span class="li">${sw}${label}</span>`).join('');
}

function obsControlHTML(v) {
  const { s } = v;
  const series = v.stations?.series ?? {};
  const disabled = !v.obsAllowed || !v.stations;
  const reason = v.elMeta?.kind !== 'temp' ? T.obsOnlyTemp : s.mode !== 'chg' ? T.obsNeedsChg : v.stStatus === 'error' ? T.loadFail : '';
  const opts = Object.entries(series).map(([k, val]) => `<option value="${esc(k)}" ${k === s.obsLayer.series ? 'selected' : ''}>${esc(val.name)}</option>`).join('');
  return `<label class="check${disabled ? ' disabled' : ''}"><input type="checkbox" data-change="obs-on" data-key="obs-on"
      ${v.obsOn ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>관측 겹쳐 보기</span></label>
    <select data-change="obs-series" data-key="obs-series" aria-label="관측 자료 고르기" ${disabled || !s.obsLayer.on ? 'disabled' : ''}>${opts}</select>
    ${reason ? `<span class="hint">${esc(reason)}</span>` : ''}`;
}

/* ───────────── 연도 카드 ───────────── */

function yearCardHTML(v, b) {
  const { s, el, elMeta } = v;
  const y = s.year;
  const nm = (c) => v.regionMeta(c)?.short ?? c;
  const src = D.yearSource(el, y);
  const kind = src === 'projection' ? '전망 · 5개 모델 평균' : src === 'current' ? '현재기후 · 면적 평균' : b.obsSeries ? '관측' : '';
  const fmtV = (val) => (s.mode === 'abs' ? withUnit(fmtNum(val), elMeta.unit) : withUnit(fmtSigned(val), unitOf(elMeta, v.pct, 'change')));
  const row = (dot, label, val, cls = '') => `<div class="row ${cls}"><span class="nm">${dot}${label}</span><span class="val">${val}</span></div>`;
  const dot = (c) => `<span class="sdot" style="--c:${esc(c)}"></span>`;
  let body = '';
  if (src === 'none') {
    const cr = D.blockRange(el, 'current');
    body += `<p class="msg">${cr && y > cr[1] ? `${y}년은 시나리오·현재기후 자료에 없는 해입니다.` : '이 연도에는 시도 자료가 없습니다.'}</p>`;
  } else {
    b.regions.forEach((r) => {
      const base = D.curValue(el, r);
      if (b.compare) body += `<div class="grp">${esc(nm(r))}</div>`;
      if (src === 'current') {
        body += row(`<span class="sdot" style="--c:${C_CUR}"></span>`, '현재기후', fmtV(D.toMode(D.regionYearValue(el, s.scenA, r, y), base, s.mode, v.pct)));
        return;
      }
      const a = D.toMode(D.regionYearValue(el, s.scenA, r, y), base, s.mode, v.pct);
      body += row(dot(b.scenA.color), esc(b.scenA.label), fmtV(a));
      if (b.scenB) {
        const bb = D.toMode(D.regionYearValue(el, s.scenB, r, y), base, s.mode, v.pct);
        body += row(dot(b.scenB.color), esc(b.scenB.label), fmtV(bb));
        body += row('', `B − A (${T.appCalc})`, fmtDiff(D.diffBA(a, bb), elMeta, v.pct), 'diff');
      }
    });
  }
  if (b.obsSeries) {
    const o = D.obsYearValue(b.obsSeries, y);
    body += row('<span class="obs-dot"></span>', `관측 · ${esc(b.obsSeries.name)}`, D.isNum(o) ? withUnit(fmtSigned(o), '℃') : '자료 없음');
  }
  return `<div class="yc-head"><b>${y}년</b>${kind ? `<span class="kind">${kind}</span>` : ''}
      <button class="x" data-action="clear-year" data-key="yc-close" aria-label="연도 보기 끝내기">✕</button></div>
    ${body}
    ${src === 'projection' ? `<p class="fc">${T.notWeather}</p>` : ''}`;
}

function placeYearCard(root) {
  const card = root.querySelector('.year-card');
  if (!card || card.hidden || !chart || !lastView || lastView.s.year == null) return;
  const wrap = root.querySelector('.chart-wrap');
  const W = wrap.clientWidth;
  if (W < 520) { card.classList.add('below'); wrap.after(card); return; }
  card.classList.remove('below');
  if (card.parentElement !== wrap) wrap.appendChild(card);
  // 커서 반대쪽 위 모서리에 붙임 (초기 값은 아래쪽에 있어 위 모서리가 대체로 비어 있음)
  const px = chart.scales.x.getPixelForValue(lastView.s.year);
  const area = chart.chartArea;
  card.style.top = `${Math.max(4, (area?.top ?? 8) + 4)}px`;
  if (px > (area.left + area.right) / 2) { card.style.right = ''; card.style.left = `${area.left + 6}px`; }
  else { card.style.left = ''; card.style.right = `${Math.max(4, W - area.right + 6)}px`; }
}

/* ───────────── 그리기 ───────────── */

function skeleton(root) {
  root.innerHTML = `
    <div class="card-head"><h2>시계열 그래프</h2><div class="obs-ctl"></div></div>
    <div class="ts-legend"></div>
    <div class="chart-wrap"><canvas role="img" aria-label="연도별 값 그래프"></canvas><div class="year-card" hidden></div></div>
    <div class="chart-notes"></div>`;
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

  root.querySelector('.obs-ctl').innerHTML = obsControlHTML(v);
  root.querySelector('.ts-legend').innerHTML = legendHTML(v, b);

  const yUnit = s.mode === 'abs' ? v.elMeta.unit : unitOf(v.elMeta, v.pct, 'change');
  const yTitle = `${yUnit} (${modeName(s.mode, v.pct)})`;
  const span = b.xMax - b.xMin;
  const xStep = span > 120 ? 20 : 10;

  if (!chart) {
    const ctx = root.querySelector('canvas');
    window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    window.Chart.defaults.font.size = 13;
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
        layout: { padding: { top: 4, right: 8 } },
        plugins: { legend: { display: false }, tooltip: { enabled: false }, annotation: { annotations: {} } },
        scales: {
          x: { type: 'linear', ticks: { includeBounds: false, callback: (val) => String(val), maxRotation: 0 }, grid: { color: '#eceff3' } },
          y: { ticks: { maxTicksLimit: 8 }, grid: { color: '#eceff3' }, title: { display: true, text: '' } },
        },
        onClick: (evt, _els, ch) => {
          const { left, right, top, bottom } = ch.chartArea;
          if (evt.x < left - 6 || evt.x > right + 6 || evt.y < top - 6 || evt.y > bottom + 6) return;
          const sx = ch.scales.x;
          const year = Math.round(sx.getValueForPixel(evt.x));
          actionsRef?.setYear(Math.min(sx.max, Math.max(sx.min, year)));
        },
      },
      plugins: [{ id: 'placeCard', afterRender: () => placeYearCard(root) }],
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
  chart.update('none');

  // 연도 카드
  const card = root.querySelector('.year-card');
  if (s.year != null) {
    card.hidden = false;
    card.innerHTML = yearCardHTML(v, b);
    placeYearCard(root);
  } else {
    card.hidden = true;
    card.innerHTML = '';
  }

  // 안내 문구
  const notes = [];
  if (b.obsSeries) notes.push(`<p class="obs">${T.obsNote}</p>`);
  notes.push(`<p>${T.ensembleNote}</p>`);
  if (s.year == null) notes.push(`<p class="tap-hint">그래프를 누르면 그 연도의 값을 보고, 지도도 그 연도로 바뀌어요.</p>`);
  if (b.obsSeries && v.stations?.missingNote) notes.push(`<p>${esc(v.stations.missingNote)}</p>`);
  root.querySelector('.chart-notes').innerHTML = notes.join('');
  const cv = root.querySelector('canvas');
  cv.setAttribute('aria-label', `${v.elMeta.name} 연도별 그래프, ${b.xMin}~${b.xMax}년, ${yTitle}`);
}
