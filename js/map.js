// map.js — 지도(나란히 / 차이 B−A) 그리기
// 지도 모양: data/geo/sido.json { type:'paths', viewBox, paths:[{code, d, label:[x,y]}], insets:[{name, box, points}] }
// 미리 투영된 SVG 경로라 앱 실행 중 투영 계산이 없습니다.
import * as D from './data.js';
import { T, esc, fmtNum, fmtSigned, unitOf, modeName } from './text.js';
import { mapScale } from './scales.js';
import { regionToolsHTML } from './ui-controls.js';

const NARROW_PX = 520;  // 지도 영역 폭이 이보다 좁으면 A/B 전환 탭으로 한 장씩 (지도 한 장 최소 260px)
let narrow = false;

export function mountMap(root, rerender) {
  if (!('ResizeObserver' in window)) return;
  const ro = new ResizeObserver((entries) => {
    const n = entries[0].contentRect.width < NARROW_PX;
    if (n !== narrow) { narrow = n; rerender(); }
  });
  ro.observe(root);
  narrow = root.clientWidth - 40 < NARROW_PX;
}

const NA_FILL = '#eef0f3';

function hatchDefs(id) {
  return `<defs><pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="14" height="14" fill="${NA_FILL}"/><rect width="4" height="14" fill="#c4cad3"/></pattern></defs>`;
}

/**
 * 지도 한 장 (SVG 문자열)
 * o = { id, vals, color, blank, selA, selB, focusable, picking, aria, label(code), isProvince(code), name(code) }
 */
function drawMap(geo, o) {
  const hatch = `hatch-${o.id}`;
  const fillOf = (c) => {
    if (o.blank) return NA_FILL;
    const val = o.vals[c];
    return D.isNum(val) ? o.color(val) : `url(#${hatch})`;
  };
  const byCode = Object.fromEntries(geo.paths.map((p) => [p.code, p]));
  const labelXY = (p) => (Array.isArray(p.label) ? p.label : D.isNum(p.labelX) ? [p.labelX, p.labelY] : null);

  const regions = geo.paths.map((p) => `<path class="rg" d="${esc(p.d)}" fill="${fillOf(p.code)}" data-action="tile" data-code="${esc(p.code)}"
    data-fig="${o.id}" role="button" tabindex="${o.focusable ? 0 : -1}" aria-label="${esc(o.label(p.code))}"/>`).join('');

  // 울릉도·독도 상자: 테두리와 섬 이름 (독도는 지도에서 1px보다 작아 위치 동그라미를 함께 그림)
  const insets = (geo.insets ?? []).map((ins) => {
    const [x, y, w, h] = ins.box;
    // 섬 위치 동그라미 + 상자 아래 이름 하나("울릉도·독도", 왼쪽→오른쪽 순서가 섬 위치와 같음)
    // 상자가 작아 섬마다 이름을 달면 겹치므로 이름은 상자 밖에 한 번만 씀
    const pts = (ins.points ?? []).map((pt) => `<circle class="pt" cx="${pt.x}" cy="${pt.y}" data-r="4"><title>${esc(pt.name)}</title></circle>`).join('');
    const cap = `<text class="pt-lb" x="${x + w}" y="${y + h}" data-dy="11" text-anchor="end" dominant-baseline="central">${esc(ins.name)}</text>`;
    return `<rect class="inset-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>${pts}${cap}`;
  }).join('');

  const outline = (code, cls) => (code && byCode[code] ? `<path class="${cls}" d="${esc(byCode[code].d)}"/>` : '');

  // 이름표: 도(道)는 작게 늘 표시, 작은 시(市)는 선택했을 때만 크게
  const labels = geo.paths.map((p) => {
    const xy = labelXY(p);
    if (!xy) return '';
    const sel = p.code === o.selA || p.code === o.selB;
    if (!sel && !o.isProvince(p.code)) return '';
    return `<text class="lb${sel ? ' sel' : ''}" x="${xy[0]}" y="${xy[1]}" text-anchor="middle" dominant-baseline="central">${esc(o.name(p.code))}</text>`;
  }).join('');

  const badges = [[o.selA, 'A'], [o.selB, 'B']].filter(([c]) => c && o.badges && byCode[c]).map(([c, b]) => {
    const xy = labelXY(byCode[c]);
    return xy ? `<g class="badge-g" data-x="${xy[0]}" data-y="${xy[1]}"><circle class="badge-c" cx="${xy[0]}" cy="${xy[1]}" data-r="11" data-dy="-22"/>
      <text class="badge-t" x="${xy[0]}" y="${xy[1]}" data-dy="-22" text-anchor="middle" dominant-baseline="central">${b}</text></g>` : '';
  }).join('');

  return `<svg class="map-svg${o.picking ? ' picking' : ''}" viewBox="${esc(geo.viewBox)}" role="group" aria-label="${esc(o.aria)}">
    ${hatchDefs(hatch)}<g class="regions">${regions}</g><g class="insets">${insets}</g>
    <g class="sel">${outline(o.selA, 'sel-a')}${outline(o.selB, 'sel-b')}</g><g class="labels">${labels}</g>${badges}</svg>`;
}

/** 화면 픽셀 크기로 보이게: 지도 축척에 맞춰 글자·동그라미 크기를 바꿈 */
function applyPixelScale(root) {
  root.querySelectorAll('.map-svg').forEach((svg) => {
    const vb = svg.viewBox.baseVal;
    const r = svg.getBoundingClientRect();
    if (!r.width || !vb?.width) return;
    // 지도는 상자 안에 비율을 지켜 들어가므로(meet) 더 많이 줄어든 쪽 기준
    const k = Math.max(vb.width / r.width, r.height ? vb.height / r.height : 0);
    svg.style.setProperty('--u', k);
    svg.querySelectorAll('[data-r]').forEach((c) => c.setAttribute('r', Number(c.dataset.r) * k));
    // 픽셀 단위 위치 보정 (data-dx / data-dy)
    [['dx', 'x', 'cx'], ['dy', 'y', 'cy']].forEach(([d, attr, cattr]) => {
      svg.querySelectorAll(`[data-${d}]`).forEach((t) => {
        const a = t.tagName === 'circle' ? cattr : attr;
        const key = `${a}0`;
        const orig = t.dataset[key] ?? t.getAttribute(a);
        t.dataset[key] = orig;
        t.setAttribute(a, Number(orig) + Number(t.dataset[d]) * k);
      });
    });
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
    root.querySelector(':scope > .overlay')?.remove();
    if (!root.dataset.drawn) root.innerHTML = `<div class="map-tools"></div><div class="map-empty"></div>`;
    root.insertAdjacentHTML('beforeend', overlay);
    return;
  }
  root.dataset.drawn = '1';

  const { el, elMeta } = v;
  const periods = manifest.periods;
  const codes = manifest.regions.map((r) => r.code);
  const name = (c) => v.regionMeta(c)?.short ?? c;
  const isProvince = (c) => /도$/.test(v.regionMeta(c)?.name ?? '');
  const A = v.scenMeta(s.scenA);
  const B = s.scenB ? v.scenMeta(s.scenB) : null;
  const which = s.mapView === 'diff' && B ? 'diff' : 'value';
  const scale = mapScale(v, which);
  const where = s.year != null ? { year: s.year } : { period: s.period };
  const pMeta = s.year == null ? v.periodMeta(s.period) : null;
  const ySrc = s.year != null ? D.yearSource(el, s.year) : null;

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
  const unit = which === 'diff' ? unitOf(elMeta, v.pct, 'diff') : s.mode === 'abs' ? elMeta.unit : unitOf(elMeta, v.pct, 'change');
  const fmt = (val) => (!D.isNum(val) ? T.noData : (which === 'value' && s.mode === 'abs' ? fmtNum(val) : fmtSigned(val)) + unit);

  const valsA = valuesFor(s.scenA);
  const valsB = B ? valuesFor(s.scenB) : null;
  let figs;
  if (which === 'diff') {
    const vals = Object.fromEntries(codes.map((c) => [c, D.diffBA(valsA[c], valsB[c])]));
    figs = [{ key: 'diff', vals, title: `${esc(B.label)} − ${esc(A.label)} <span class="calc">(${T.appCalc})</span>` }];
  } else {
    figs = [{ key: 'A', scen: A, vals: valsA }];
    if (B) figs.push({ key: 'B', scen: B, vals: valsB });
    figs.forEach((f) => { f.title = `<span class="ab">${f.key}</span><span class="sdot" style="--c:${esc(f.scen.color)}"></span>${esc(f.scen.label)}`; });
  }
  const useTabs = which === 'value' && figs.length === 2 && narrow;
  const visible = useTabs ? figs.filter((f) => f.key === (s.ui.mapTab === 'B' ? 'B' : 'A')) : figs;

  // 말풍선: 탭한 지역의 A·B 값 (잠깐 보였다 사라짐)
  const pop = s.ui.popup;
  const popText = (c) => {
    if (which === 'diff') return `${esc(name(c))} · B−A ${esc(message ? '—' : fmt(D.diffBA(valsA[c], valsB[c])))}`;
    const parts = [`${esc(name(c))}`, `A ${esc(message ? '—' : fmt(valsA[c]))}`];
    if (B) parts.push(`B ${esc(message ? '—' : fmt(valsB[c]))}`);
    return parts.join(' · ');
  };

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
    const svg = drawMap(v.geo, {
      id: f.key,
      vals: f.vals,
      color: scale.color,
      blank: !!message,
      selA: s.regionA !== '00' ? s.regionA : null,
      selB: s.regionB && s.regionB !== '00' ? s.regionB : null,
      badges: !!s.regionB,
      focusable: i === 0,
      picking: s.pickingRegionB,
      isProvince,
      name,
      aria: `${f.title.replace(/<[^>]+>/g, '')} 지도`,
      label: (c) => `${name(c)} ${message ? '' : fmt(f.vals[c])}`,
    });
    const popHere = pop && pop.fig === f.key && codes.includes(pop.code);
    return `<figure class="map-fig${v.mock ? ' is-mock' : ''}" data-fig="${f.key}">
      ${useTabs ? `<figcaption class="sr-only">${f.title}</figcaption>` : `<figcaption>${f.title}</figcaption>`}
      <div class="map-box">${svg}
        ${message ? `<div class="map-msg" role="status">${esc(message)}</div>` : ''}
        ${popHere ? `<div class="map-pop" role="status" style="left:${pop.x}px;top:${pop.y}px">${popText(pop.code)}</div>` : ''}
      </div>
    </figure>`;
  }).join('');

  const tick = (x) => (scale.type === 'seq' ? fmtNum(x) : fmtSigned(x));
  const lgTitle = which === 'diff' ? `B − A (${T.appCalc})` : figs.length === 2 ? '공통 범례' : '범례';
  const legend = message ? `<div class="legend empty"></div>` : `<div class="legend">
    <span class="lg-title">${lgTitle}<span class="u">${esc(unit)} · ${which === 'diff' ? (v.pct ? '변화율 차이' : '시나리오 차이') : esc(modeName(s.mode, v.pct))}</span></span>
    <span class="lg-end">${tick(scale.min)}</span>
    <span class="lg-bar-wrap"><span class="bar" style="background:${scale.gradient}"></span>
      <span class="words"><span>${esc(scale.low)}</span>${scale.type === 'div' ? '<span>0</span>' : ''}<span>${esc(scale.high)}</span></span></span>
    <span class="lg-end">${tick(scale.max)}</span>
    ${anyNA || clamped ? `<span class="lg-extra">${anyNA ? `<span><span class="hatch-sw"></span>${T.noData}</span>` : ''}${clamped ? `<span>${T.clampNote}</span>` : ''}</span>` : ''}
  </div>`;

  const tabs = useTabs ? `<div class="map-tabs" role="group" aria-label="지도 고르기">
    ${figs.map((f) => `<button class="chip" data-action="map-tab" data-tab="${f.key}" data-key="tab-${f.key}" aria-pressed="${f.key === visible[0].key}">
      ${f.key} · ${esc(f.scen.label)}</button>`).join('')}</div>` : '';

  root.innerHTML = `
    <div class="map-tools">
      <div class="tools-left">${regionToolsHTML(v)}</div>
      <div class="seg" role="group" aria-label="지도 보기">
        <button data-action="map-view" data-view="side" data-key="mv-side" aria-pressed="${which === 'value'}">나란히</button>
        <button data-action="map-view" data-view="diff" data-key="mv-diff" aria-pressed="${which === 'diff'}" ${B ? '' : 'disabled title="B 시나리오를 고르면 쓸 수 있어요"'}>차이 B−A</button>
      </div>
    </div>
    ${tabs}
    <div class="maps${visible.length === 1 ? ' single' : ''}${which === 'diff' ? ' big' : ''}">${figHTML}</div>
    ${legend}
    ${overlay}`;
  applyPixelScale(root);
  // 말풍선이 지도 밖으로 나가지 않게
  root.querySelectorAll('.map-pop').forEach((el2) => {
    const box = el2.parentElement.getBoundingClientRect();
    const r = el2.getBoundingClientRect();
    if (r.left < box.left + 2) el2.style.left = `${parseFloat(el2.style.left) + (box.left + 2 - r.left)}px`;
    if (r.right > box.right - 2) el2.style.left = `${parseFloat(el2.style.left) - (r.right - box.right + 2)}px`;
    if (r.top < box.top) el2.classList.add('below');
  });
}

/** 탭한 위치(지도 상자 기준 px). 키보드로 눌렀으면 그 지역의 가운데 */
export function popupPosition(target, evt) {
  const box = target.closest('.map-box');
  if (!box) return null;
  const b = box.getBoundingClientRect();
  if (evt && evt.clientX && evt.detail > 0) return { x: evt.clientX - b.left, y: evt.clientY - b.top };
  const r = target.getBoundingClientRect();
  return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
}
