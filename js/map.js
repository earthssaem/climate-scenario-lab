// map.js — 지도(나란히 / 차이 B−A) 그리기
// 지도 모양은 교체할 수 있습니다:
//   임시 타일 { type:'tiles', tiles:[{code,col,row}] }
//   실제 경계 { type:'paths', viewBox:'…', paths:[{code,d, labelX?, labelY?}] }  (미리 투영된 SVG 경로)
import * as D from './data.js';
import { T, esc, fmtNum, fmtSigned, unitOf, derivedChipNote, modeName } from './text.js';
import { mapScale, textOn } from './scales.js';
import { regionRowHTML } from './ui-controls.js';

const NARROW_PX = 520;  // 지도 영역 폭이 이보다 좁으면 A/B 전환 탭으로 한 장씩
let narrow = false;

export function mountMap(root, rerender) {
  if (!('ResizeObserver' in window)) return;
  const ro = new ResizeObserver((entries) => {
    const n = entries[0].contentRect.width < NARROW_PX;
    if (n !== narrow) { narrow = n; rerender(); }
  });
  ro.observe(root);
  narrow = root.clientWidth - 28 < NARROW_PX;
}

/* ───────────── 지도 모양 그리기 ───────────── */

const TILE = 100;
const GAP = 8;
const NA_FILL = '#eef0f3';

function hatchDefs(id) {
  return `<defs><pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="10" height="10" fill="${NA_FILL}"/><rect width="3" height="10" fill="#c4cad3"/></pattern></defs>`;
}

function tileLabel(cx, y, name, valText, fill, isNA, badge) {
  const ink = isNA ? '#4c5464' : textOn(fill);
  return `<text class="t-name" x="${cx}" y="${y + 40}" text-anchor="middle" fill="${ink}">${esc(name)}</text>
    ${isNA ? `<text class="t-na" x="${cx}" y="${y + 72}" text-anchor="middle" fill="${ink}">${T.noData}</text>`
    : valText ? `<text class="t-val" x="${cx}" y="${y + 74}" text-anchor="middle" fill="${ink}">${esc(valText)}</text>` : ''}
    ${badge || ''}`;
}

/**
 * opts = { id, vals:{code→number|null}, color(v), fmt(v), names, selA, selB, badges, blank, focusable, picking, label(code,v) }
 */
function drawShapes(geo, o) {
  const hatch = `hatch-${o.id}`;
  const fillOf = (c) => {
    if (o.blank) return NA_FILL;
    const val = o.vals[c];
    return D.isNum(val) ? o.color(val) : `url(#${hatch})`;
  };
  const cls = (c) => `tile${c === o.selA ? ' sel-a' : ''}${c === o.selB ? ' sel-b' : ''}`;
  const attrs = (c) => `class="${cls(c)}" data-action="tile" data-code="${esc(c)}" role="button" tabindex="${o.focusable ? 0 : -1}"
    aria-label="${esc(o.label(c))}"`;
  const badge = (c, x, y) => {
    const b = o.badges?.[c];
    return b ? `<circle class="badge-c" cx="${x}" cy="${y}" r="15"/><text class="badge-t" x="${x}" y="${y + 6.5}" text-anchor="middle">${b}</text>` : '';
  };

  if (geo.type === 'paths') {
    // 이름표 크기는 지도 좌표 크기에 맞춰 비례 조정 (타일 지도 폭 432 기준). labelScale로 지역별 조정 가능
    const vbW = Number(String(geo.viewBox).trim().split(/[\s,]+/)[2]) || 432;
    const k = vbW / 432;
    const body = geo.paths.map((p) => {
      const val = o.vals[p.code];
      const isNA = !o.blank && !D.isNum(val);
      const fill = fillOf(p.code);
      const auto = !(D.isNum(p.labelX) && D.isNum(p.labelY));
      const ks = k * (D.isNum(p.labelScale) ? p.labelScale : 1);
      return `<g ${attrs(p.code)}${auto ? ` data-auto-label="1" data-k="${ks}"` : ''}><path class="shape" d="${esc(p.d)}" fill="${fill}" vector-effect="non-scaling-stroke"/>
        <g class="lbl" transform="translate(${auto ? 0 : p.labelX} ${auto ? 0 : p.labelY}) scale(${ks})">${tileLabel(0, -50, o.names(p.code), o.blank ? '' : o.fmt(val), D.isNum(val) ? fill : NA_FILL, isNA, badge(p.code, 34, -36))}</g></g>`;
    }).join('');
    return `<svg class="map-svg${o.picking ? ' picking' : ''}" viewBox="${esc(geo.viewBox)}" role="group" aria-label="${esc(o.aria)}">${hatchDefs(hatch)}${body}</svg>`;
  }

  // 타일 지도
  const tiles = geo.tiles;
  const maxC = Math.max(...tiles.map((t) => t.col));
  const maxR = Math.max(...tiles.map((t) => t.row));
  const W = (maxC + 1) * (TILE + GAP) - GAP;
  const H = (maxR + 1) * (TILE + GAP) - GAP;
  const body = tiles.map((t) => {
    const x = t.col * (TILE + GAP);
    const y = t.row * (TILE + GAP);
    const val = o.vals[t.code];
    const isNA = !o.blank && !D.isNum(val);
    const fill = fillOf(t.code);
    return `<g ${attrs(t.code)}><rect class="shape" x="${x}" y="${y}" width="${TILE}" height="${TILE}" rx="12" fill="${fill}"/>
      ${tileLabel(x + TILE / 2, y, o.names(t.code), o.blank ? '' : o.fmt(val), D.isNum(val) ? fill : NA_FILL, isNA, badge(t.code, x + TILE - 14, y + 14))}</g>`;
  }).join('');
  return `<svg class="map-svg${o.picking ? ' picking' : ''}" viewBox="-4 -4 ${W + 8} ${H + 8}" role="group" aria-label="${esc(o.aria)}">${hatchDefs(hatch)}${body}</svg>`;
}

/** 실제 경계(paths)에서 이름표 좌표가 없으면 모양의 가운데에 놓기 */
function placeAutoLabels(root) {
  root.querySelectorAll('g.tile[data-auto-label]').forEach((g) => {
    const shape = g.querySelector('.shape');
    const lbl = g.querySelector('.lbl');
    if (!shape || !lbl) return;
    const b = shape.getBBox();
    lbl.setAttribute('transform', `translate(${b.x + b.width / 2} ${b.y + b.height / 2}) scale(${g.dataset.k || 1})`);
  });
}

/* ───────────── 지도 영역 ───────────── */

function overlayHTML(v) {
  const geoErr = v.geoStatus === 'error';
  if (v.elStatus === 'error' || geoErr) {
    return `<div class="overlay error"><span class="pill">${T.loadFail}
      <button class="chip small" data-action="${geoErr ? 'retry-base' : 'retry-element'}">${T.retry}</button></span></div>`;
  }
  if (!v.el || !v.geo) return `<div class="overlay"><span class="pill"><span class="spinner"></span>${T.loading}</span></div>`;
  return '';
}

export function renderMap(root, v) {
  const { s, manifest } = v;
  if (!manifest) return;
  const overlay = overlayHTML(v);
  if (!v.el || !v.geo) {
    // 불러오는 동안: 이미 그린 지도가 있으면 그대로 두고 로딩 표시만 올림
    const old = root.querySelector(':scope > .overlay');
    if (old) old.remove();
    if (!root.dataset.drawn) root.innerHTML = `<div class="card-head"><h2>지도</h2></div><div class="map-empty" style="min-height:360px"></div>`;
    root.insertAdjacentHTML('beforeend', overlay);
    return;
  }
  root.dataset.drawn = '1';

  const el = v.el;
  const elMeta = v.elMeta;
  const periods = manifest.periods;
  const codes = manifest.regions.map((r) => r.code);
  const name = (c) => v.regionMeta(c)?.short ?? c;
  const A = v.scenMeta(s.scenA);
  const B = s.scenB ? v.scenMeta(s.scenB) : null;
  const which = s.mapView === 'diff' && B ? 'diff' : 'value';
  const scale = mapScale(v, which);
  const where = s.year != null ? { year: s.year } : { period: s.period };
  const pMeta = s.year == null ? v.periodMeta(s.period) : null;
  const ySrc = s.year != null ? D.yearSource(el, s.year) : null;

  // 이 시점의 지도 자료가 아예 없으면 안내만
  let message = '';
  if (s.year != null && ySrc === 'none') {
    const curRange = D.blockRange(el, 'current');
    message = curRange && s.year < curRange[0] ? T.noSidoYear : T.noYearData;
  } else if (which === 'diff' && ((pMeta && pMeta.id === 'cur') || ySrc === 'current')) {
    message = T.curNoDiff;
  } else if (pMeta?.derived && !v.derivedOk(pMeta)) {
    message = T.noData;
  }

  const measure = (scen, c) => D.measure(el, { scen, region: c, mode: s.mode, pct: v.pct, ...where, periods });
  const valuesFor = (scen) => Object.fromEntries(codes.map((c) => [c, measure(scen, c)]));
  const fmt = (val) => {
    if (!D.isNum(val)) return '';
    return which === 'value' && s.mode === 'abs' ? fmtNum(val) : fmtSigned(val);
  };
  const unit = which === 'diff' ? unitOf(elMeta, v.pct, 'diff') : s.mode === 'abs' ? elMeta.unit : unitOf(elMeta, v.pct, 'change');
  const timeLabel = s.year != null ? `${s.year}년` : pMeta ? (pMeta.derived ? `${pMeta.label}*` : pMeta.label) : '';

  const badges = s.regionB ? { [s.regionA]: 'A', [s.regionB]: 'B' } : null;
  const selLine = (vals) => {
    const show = [s.regionA, ...(s.regionB ? [s.regionB] : [])];
    return show.map((c) => `<span class="sel">${esc(name(c))} <b>${D.isNum(vals[c]) ? esc(fmt(vals[c]) + unit) : T.noData}</b></span>`).join('');
  };

  // 그릴 지도 목록
  let figs;
  if (which === 'diff') {
    const a = valuesFor(s.scenA);
    const b = valuesFor(s.scenB);
    const vals = Object.fromEntries(codes.map((c) => [c, D.diffBA(a[c], b[c])]));
    figs = [{ key: 'diff', vals, title: `${esc(B.label)} − ${esc(A.label)} (${T.appCalc}) · ${esc(timeLabel)}` }];
  } else {
    figs = [{ key: 'A', scen: A, vals: valuesFor(s.scenA) }];
    if (B) figs.push({ key: 'B', scen: B, vals: valuesFor(s.scenB) });
    figs.forEach((f) => {
      const cur = pMeta?.id === 'cur' || ySrc === 'current';
      f.title = `${f.key} · ${esc(f.scen.label)} · ${esc(timeLabel)}${cur ? ' (시나리오와 무관)' : ''}`;
    });
  }
  const useTabs = which === 'value' && figs.length === 2 && narrow;
  const visible = useTabs ? figs.filter((f) => f.key === (s.ui.mapTab === 'B' ? 'B' : 'A')) : figs;

  let anyNA = false;
  let clamped = false;
  const figHTML = visible.map((f, i) => {
    if (!message) {
      codes.forEach((c) => {
        if (c === '00') return;
        if (!D.isNum(f.vals[c])) anyNA = true;
        else if (scale.outside(f.vals[c])) clamped = true;
      });
    }
    const svg = drawShapes(v.geo, {
      id: `${f.key}-${i}`,
      vals: f.vals,
      color: scale.color,
      fmt,
      names: name,
      selA: s.regionA !== '00' ? s.regionA : null,
      selB: s.regionB && s.regionB !== '00' ? s.regionB : null,
      badges,
      blank: !!message,
      focusable: i === 0,
      picking: s.pickingRegionB,
      aria: `${f.title.replace(/<[^>]+>/g, '')} 지도`,
      label: (c) => `${name(c)} ${message ? '' : D.isNum(f.vals[c]) ? fmt(f.vals[c]) + unit : T.noData}`,
    });
    return `<figure class="map-fig">
      <figcaption><span>${f.title}</span>${message ? '' : selLine(f.vals)}</figcaption>
      ${svg}
      ${message ? `<div class="map-msg" role="status">${esc(message)}</div>` : ''}
    </figure>`;
  }).join('');

  // 범례 (두 지도 공통)
  const tick = (x) => (scale.type === 'seq' ? fmtNum(x) : fmtSigned(x));
  const lgTitle = which === 'diff' ? `차이 B − A (${T.appCalc})` : figs.length === 2 ? '공통 범례' : '범례';
  const legend = message ? '' : `<div class="legend">
    <div class="lg-head">${lgTitle} <span class="u">단위: ${esc(unit)} · ${which === 'diff' ? (v.pct ? '변화율 차이' : '시나리오 차이') : esc(modeName(s.mode, v.pct))}</span></div>
    <div class="bar" style="background:${scale.gradient}"></div>
    <div class="ticks"><span>${tick(scale.min)}</span>${scale.type === 'div' ? '<span>0</span>' : ''}<span>${tick(scale.max)}</span></div>
    <div class="words"><span>← ${esc(scale.low)}</span><span>${esc(scale.high)} →</span></div>
    ${anyNA || clamped ? `<div class="extra">${anyNA ? `<span><span class="hatch-sw"></span>${T.noData}</span>` : ''}${clamped ? `<span>${T.clampNote}</span>` : ''}</div>` : ''}
  </div>`;

  // 기간 칩 / 연도 보기 칩
  let periodRow;
  if (s.year != null) {
    periodRow = `<div class="period-row"><span class="bar-label">기간</span>
      <span class="year-chip">연도 보기: ${s.year}년<button class="x" data-action="clear-year" data-key="clear-year" aria-label="연도 보기 끝내기, 20년 평균으로">✕</button></span></div>
      ${ySrc === 'projection' ? `<p class="note">${T.notWeather}</p>` : ''}`;
  } else {
    const derived = periods.find((p) => p.derived);
    periodRow = `<div class="period-row" role="group" aria-label="기간"><span class="bar-label">기간</span>
      ${periods.map((p) => {
        const off = p.derived && !v.derivedOk(p);
        const label = p.derived ? `${esc(p.label)}*` : esc(p.label);
        const sub = p.derived ? T.appCalc : `${p.start}~${p.end}`;
        return `<button class="chip" data-action="period" data-id="${esc(p.id)}" data-key="period-${esc(p.id)}" ${off ? 'disabled' : ''}
          aria-pressed="${p.id === s.period}"${off ? ' title="10년 공식값이 없어 계산할 수 없어요"' : ''}>${label}<span class="yr">${sub}</span></button>`;
      }).join('')}</div>
      ${derived ? `<p class="note">${derivedChipNote}${!v.derivedOk(derived) ? ' — 이 요소는 10년 값이 없어 쓸 수 없어요.' : ''}</p>` : ''}`;
  }

  const tabs = useTabs ? `<div class="map-tabs" role="group" aria-label="지도 고르기">
    ${figs.map((f) => `<button class="chip" data-action="map-tab" data-tab="${f.key}" data-key="tab-${f.key}" aria-pressed="${f.key === visible[0].key}">
      ${f.key} · ${esc(f.scen.label)}</button>`).join('')}</div>` : '';

  const notes = [];
  if (which === 'value' && B && (pMeta?.id === 'cur' || ySrc === 'current')) notes.push('현재(2000~2019)는 현재기후 값이라 두 지도가 같아요.');
  if (v.geo.type === 'tiles') notes.push(esc(v.geo.note || '임시 타일 지도입니다. 실제 시도 경계가 아닙니다.'));

  root.innerHTML = `
    <div class="card-head"><h2>지도</h2>
      <div class="map-tools"><span class="lbl">보기</span>
        <div class="seg" role="group" aria-label="지도 보기">
          <button data-action="map-view" data-view="side" data-key="mv-side" aria-pressed="${which === 'value'}">나란히</button>
          <button data-action="map-view" data-view="diff" data-key="mv-diff" aria-pressed="${which === 'diff'}" ${B ? '' : 'disabled title="B 시나리오를 고르면 쓸 수 있어요"'}>차이 B−A</button>
        </div>
      </div>
    </div>
    ${tabs}
    <div class="maps${visible.length === 1 ? ' single' : ''}">${figHTML}</div>
    ${legend}
    ${periodRow}
    ${regionRowHTML(v)}
    ${notes.map((n) => `<p class="temp-note">${n}</p>`).join('')}
    ${overlay}`;
  if (v.geo.type === 'paths') placeAutoLabels(root);
}
