// map.js — 지도(나란히 / 차이 B−A) 그리기
// 지도 모양: data/geo/sido.json { type:'paths', viewBox, paths:[{code, d, label:[x,y]}], insets:[{name, box, points}] }
// 미리 투영된 SVG 경로라 앱 실행 중 투영 계산이 없습니다.
import * as D from './data.js';
import { T, esc, fmtNum, fmtSigned, unitOf, modeName } from './text.js';
import { mapScale } from './scales.js';
import { regionToolsHTML, legendNote } from './ui-controls.js';

const NARROW_PX = 520;  // 지도 영역 폭이 이보다 좁으면 A/B 전환 탭으로 한 장씩 (지도 한 장 최소 260px)
let narrow = false;

export function mountMap(root, rerender) {
  if (!('ResizeObserver' in window)) return;
  const ro = new ResizeObserver((entries) => {
    const n = entries[0].contentRect.width < NARROW_PX;
    if (n !== narrow) { narrow = n; rerender(); return; }
    // 크기만 바뀌면 다시 그리지 않고 이름표 크기·자리만 다시 맞춤 (화면 회전, 전체화면 등)
    applyPixelScale(root);
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

  // 선택한 지역 경계: 흰 테두리를 먼저 깔고 굵은 선 (A·B 두 지도 모두)
  const outline = (code, cls) => (code && byCode[code] ? `<path class="sel-halo" d="${esc(byCode[code].d)}"/><path class="${cls}" d="${esc(byCode[code].d)}"/>` : '');

  // 이름표: 17개 시도 모두 늘 표시(시는 class "city"), 선택한 지역은 크고 굵게.
  // 겹치면 applyPixelScale에서 선택 > 시 > 도 순서로 자리를 잡고 뒤의 이름표를 비켜 둠
  const labels = geo.paths.map((p) => {
    const xy = labelXY(p);
    if (!xy) return '';
    const sel = p.code === o.selA || p.code === o.selB;
    const cls = ['lb', sel ? 'sel' : '', o.isProvince(p.code) ? '' : 'city'].filter(Boolean).join(' ');
    return `<text class="${cls}" x="${xy[0]}" y="${xy[1]}" text-anchor="middle" dominant-baseline="central" data-code="${esc(p.code)}">${esc(o.name(p.code))}</text>`;
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
    // 이름표 겹침 풀기: 선택한 지역 > 시(특별·광역시) > 도 순서로 자리를 잡고, 앞의 이름표와 겹치면
    // 가까운 자리부터(위·아래 한 줄, 옆으로 반 글자폭 …) 옮겨 봄. 시는 제 지역 가까이만, 도는 조금 더 멀리까지.
    // 빈 자리가 없으면 겹침이 가장 적은 자리. 울릉도·독도 이름은 고정
    const texts = [...svg.querySelectorAll('text.lb')];
    texts.forEach((t) => {
      t.dataset.lx = t.dataset.lx ?? t.getAttribute('x'); t.dataset.ly = t.dataset.ly ?? t.getAttribute('y');
      t.setAttribute('x', t.dataset.lx); t.setAttribute('y', t.dataset.ly);
    });
    const rank = (t) => (t.classList.contains('sel') ? 0 : t.classList.contains('city') ? 1 : 2);
    const area = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) - 0.5 * k)
      * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) - 0.5 * k);
    const placed = [...svg.querySelectorAll('text.pt-lb')].map((t) => t.getBBox());
    texts.sort((a, b) => rank(a) - rank(b)).forEach((t) => {
      const x0 = Number(t.dataset.lx); const y0 = Number(t.dataset.ly);
      const bb0 = t.getBBox();
      const stepY = bb0.height + k; const stepX = bb0.width / 2 + k;
      const maxD = rank(t) === 2 ? 2.2 * stepY : 1.8 * stepY;   // 도는 두 줄, 시·선택 지역은 한 줄 반 남짓까지만
      const cands = [];
      for (const dy of [0, 1, -1, 2, -2]) for (const dx of [0, 1, -1, 2, -2]) {
        const d = Math.hypot(dx * stepX, dy * stepY);
        if (d <= maxD) cands.push([dx * stepX, dy * stepY, d]);
      }
      cands.sort((a, b) => a[2] - b[2]);
      let best = null;
      for (const [dx, dy] of cands) {
        t.setAttribute('x', x0 + dx); t.setAttribute('y', y0 + dy);
        const bb = t.getBBox();
        if (bb.x < vb.x || bb.x + bb.width > vb.x + vb.width || bb.y < vb.y || bb.y + bb.height > vb.y + vb.height) continue;   // 지도 밖으로는 안 나가게
        const cost = placed.reduce((sum, q) => sum + area(bb, q), 0);
        if (!best || cost < best.cost) best = { dx, dy, cost };
        if (cost === 0) break;
      }
      t.setAttribute('x', x0 + (best?.dx ?? 0)); t.setAttribute('y', y0 + (best?.dy ?? 0));
      placed.push(t.getBBox());
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
    // 하나만 보기: A·B 표시 없이 시나리오 이름만
    const single = s.scenMode === 'single';
    figs.forEach((f) => { f.title = `${single ? '' : `<span class="ab">${f.key}</span>`}<span class="sdot" style="--c:${esc(f.scen.color)}"></span>${esc(f.scen.label)}`; });
  }
  const useTabs = which === 'value' && figs.length === 2 && narrow;
  const visible = useTabs ? figs.filter((f) => f.key === (s.ui.mapTab === 'B' ? 'B' : 'A')) : figs;

  // 말풍선: 탭한 지역의 A·B 값 (잠깐 보였다 사라짐)
  const pop = s.ui.popup;
  const popText = (c) => {
    if (which === 'diff') return `${esc(name(c))} · B−A ${esc(message ? '—' : fmt(D.diffBA(valsA[c], valsB[c])))}`;
    const parts = [`${esc(name(c))}`, `${s.scenMode === 'single' ? esc(A.label) : 'A'} ${esc(message ? '—' : fmt(valsA[c]))}`];
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
  // 변화량·차이: 0(흰색) 위치를 범례 막대 위에 표시. 한쪽 방향이면 그 쪽 낱말만
  const isDiv = scale.type === 'div';
  const zeroIn = isDiv && scale.zero > 0.5 && scale.zero < 99.5;
  const zeroMark = zeroIn ? `<span class="zero-mark" style="left:${scale.zero.toFixed(1)}%"><span>0</span></span>` : '';
  const lowWord = !isDiv || scale.min < 0 ? `<span>← ${esc(scale.low)}</span>` : '<span></span>';
  const highWord = !isDiv || scale.max > 0 ? `<span>${esc(scale.high)} →</span>` : '<span></span>';
  const legend = message ? `<div class="legend empty"></div>` : `<div class="legend${zeroIn ? ' has-zero' : ''}">
    <span class="lg-title"><span class="lg-name">${lgTitle}${which !== 'diff' ? `<button class="lg-info" data-action="note" data-id="legend" data-key="note-legend" aria-haspopup="dialog" aria-label="지도 색 설명: ${esc(legendNote(v))}">ⓘ</button>` : ''}</span>${scale.annualRange ? `<span class="lg-tag">연도 보기 색 범위</span>` : ''}<span class="u">${esc(unit)} · ${which === 'diff' ? (v.pct ? '변화율 차이' : '시나리오 차이') : esc(modeName(s.mode, v.pct))}</span></span>
    <span class="lg-end">${tick(scale.min)}</span>
    <span class="lg-bar-wrap"><span class="bar" style="background:${scale.gradient}">${zeroMark}</span>
      <span class="words">${lowWord}${highWord}</span></span>
    <span class="lg-end">${tick(scale.max)}</span>
    ${anyNA || clamped ? `<span class="lg-extra">${anyNA ? `<span><span class="hatch-sw"></span>${T.noData}</span>` : ''}${clamped ? `<span>${T.clampNote}</span>` : ''}</span>` : ''}
  </div>`;

  const tabs = useTabs ? `<div class="seg map-tabs" role="group" aria-label="지도 고르기">
    ${figs.map((f) => `<button data-action="map-tab" data-tab="${f.key}" data-key="tab-${f.key}" aria-pressed="${f.key === visible[0].key}">
      ${f.key} · ${esc(f.scen.label)}</button>`).join('')}</div>` : '';

  const viewSeg = `<div class="seg" role="group" aria-label="지도 보기">
        <button data-action="map-view" data-view="side" data-key="mv-side" aria-pressed="${which === 'value'}">나란히</button>
        <button data-action="map-view" data-view="diff" data-key="mv-diff" aria-pressed="${which === 'diff'}" ${B ? '' : 'disabled'}>차이 B−A</button>
      </div>`;
  // 지도 한 장씩 보는 좁은 화면: [나란히|차이]를 A/B 고르기 줄에 함께 두어 지도 높이를 확보
  root.innerHTML = `
    <div class="map-tools">
      <div class="tools-left">${regionToolsHTML(v)}</div>
      ${useTabs || s.scenMode === 'single' ? '' : viewSeg}
    </div>
    ${useTabs ? `<div class="map-tabs-row">${tabs}${viewSeg}</div>` : ''}
    <div class="maps${visible.length === 1 ? ' single' : ''}${which === 'diff' ? ' big' : ''}">${figHTML}</div>
    ${legend}
    ${overlay}`;
  applyPixelScale(root);
  requestAnimationFrame(() => applyPixelScale(root));   // 배치가 끝난 뒤 한 번 더 (처음 그릴 때 크기가 덜 잡혔을 수 있음)
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
