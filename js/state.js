// state.js — 화면 전체를 그리는 단 하나의 상태 객체
// 상태는 메모리에만 둡니다(저장하지 않음). 새로고침하면 기본값으로 돌아갑니다.

export const DEFAULT_STATE = Object.freeze({
  element: 'tavg',
  scenA: 'ssp126',
  scenB: 'ssp585',       // null이면 시나리오 하나만 보기
  showAll4: false,       // 그래프에 4개 시나리오 모두 표시
  mode: 'abs',           // 'abs' 값(기본) | 'chg' 현재 대비 변화량
  prcpUnit: 'mm',        // 강수량 변화량 단위: 'mm' | 'pct'
  regionA: '11',         // 서울 (첫 화면에서 연도별 선이 보이게. 전국은 기간값만 있음)
  regionB: null,         // 비교 지역
  pickingRegionB: false, // "+ 비교 지역"을 누른 뒤 다음 지도 탭을 기다리는 중
  period: 'p4',          // 후반기(2081~2100)
  year: null,            // 숫자면 연도 보기 모드
  mapView: 'side',       // 'side' 나란히 | 'diff' 차이(B−A)
  obsLayer: Object.freeze({ on: false, series: '6avg' }),   // 과거 관측 보기(1912~) — 기본 꺼짐
  periodBars: false,     // 20년 평균선 표시 — 켜면 모든 기간의 A·B 가로선, 끄면 가로선 없음
  // 화면 조작용(열린 창 등). 탐구 조건이 아니며 역시 저장하지 않습니다.
  ui: Object.freeze({
    picker: null,        // 시나리오 선택 창: 'A' | 'B' | null
    info: false,         // 기후요소 ⓘ 창
    graphInfo: false,    // 그래프 ⓘ 창
    mapTab: 'A',         // 지도 영역이 좁을 때 보이는 지도 (A | B)
    popup: null,         // 지도 말풍선 { code, fig, x, y } — 잠깐 보였다 사라짐
    details: false,      // [▾ 기간별 표] 펼침
    sources: false,      // 푸터 [자료 출처 ⓘ] 창
    regionList: false,   // "분석 지역: 서울 ▾" 시도 목록 창
    note: null,          // 짧은 ⓘ 설명 창: 'p3'(2061~2080) | 'legend'(지도 색) | null
  }),
});

// 기본 그래프 x축 시작 연도(현재기후 시작). 장기관측을 켜면 관측 시작 연도까지 넓어집니다.
export const DEFAULT_X_MIN = 2000;

const clone = (o) => JSON.parse(JSON.stringify(o));

/** 관측 겹쳐 보기를 켤 수 있는 조건: 평균기온(kind temp) + 변화량 모드 */
export function obsAllowed(s, manifest) {
  const el = manifest?.elements?.find((e) => e.id === s.element);
  return !!el && el.kind === 'temp' && s.mode === 'chg';
}
export function obsEffective(s, manifest) {
  return s.obsLayer.on && obsAllowed(s, manifest);
}

/** 규칙끼리 어긋나지 않게 상태를 정리합니다. */
export function normalize(s, manifest) {
  const n = { ...s, obsLayer: { ...s.obsLayer }, ui: { ...s.ui } };
  if (n.scenB === n.scenA) n.scenB = null;
  if (!n.scenB) {
    if (n.mapView === 'diff') n.mapView = 'side';
    n.ui.mapTab = 'A';
  }
  if (n.regionB && n.regionB === n.regionA) n.regionB = null;
  if (n.regionB) {
    n.showAll4 = false;          // 지역 비교 중에는 4개 모두 보기를 쓸 수 없음
    n.pickingRegionB = false;
  }
  if (n.year != null && n.year < DEFAULT_X_MIN && !obsEffective(n, manifest)) n.year = null;
  return n;
}

// 열린 창이 하나도 없는 상태 (창을 열 때 다른 창은 모두 닫음)
const NO_DIALOG = Object.freeze({ picker: null, info: false, graphInfo: false, sources: false, regionList: false, note: null });

export function createStore() {
  let manifest = null;
  let state = clone(DEFAULT_STATE);
  const listeners = new Set();

  const get = () => state;
  const set = (patch) => {
    const prev = state;
    const next = normalize({ ...state, ...patch }, manifest);
    state = next;
    listeners.forEach((fn) => fn(state, prev));
  };
  const setUi = (patch) => set({ ui: { ...state.ui, ...patch } });

  const actions = {
    reset: () => set(clone(DEFAULT_STATE)),
    setElement: (id) => set({ element: id, ui: { ...state.ui, info: false } }),
    openPicker: (slot) => setUi({ ...NO_DIALOG, picker: slot }),
    openInfo: () => setUi({ ...NO_DIALOG, info: true }),
    openGraphInfo: () => setUi({ ...NO_DIALOG, graphInfo: true }),
    openSources: () => setUi({ ...NO_DIALOG, sources: true }),
    openRegionList: () => setUi({ ...NO_DIALOG, regionList: true }),
    openNote: (id) => setUi({ ...NO_DIALOG, note: id }),
    closeDialogs: () => setUi({ ...NO_DIALOG }),
    showPopup: (popup) => setUi({ popup }),
    hidePopup: () => { if (state.ui.popup) setUi({ popup: null }); },
    toggleDetails: () => setUi({ details: !state.ui.details }),
    setScenario(slot, id) {
      const ui = { ...state.ui, picker: null };
      if (slot === 'A') {
        if (!id || id === state.scenB) return set({ ui });
        set({ scenA: id, ui });
      } else {
        if (id === state.scenA) return set({ ui });
        set({ scenB: id || null, ui });
      }
    },
    setAll4: (on) => set({ showAll4: !!on && !state.regionB }),
    setMode: (mode) => set({ mode }),
    setPrcpUnit: (prcpUnit) => set({ prcpUnit }),
    /** 지도 타일을 눌렀을 때 */
    tapRegion(code) {
      if (state.pickingRegionB) {
        if (code === state.regionA) return;   // 같은 지역은 비교할 수 없음 — 계속 기다림
        return set({ regionB: code, pickingRegionB: false });
      }
      set({ regionA: code, regionB: code === state.regionB ? null : state.regionB });
    },
    /** 분석 지역 목록에서 고르기 (지도 누르기와 같은 규칙, 창은 닫음) */
    selectRegion(code) {
      set({ regionA: code, regionB: code === state.regionB ? null : state.regionB, pickingRegionB: false, ui: { ...state.ui, ...NO_DIALOG } });
    },
    /** [전국] 버튼 */
    selectNation() { actions.tapRegion('00'); },
    startPickB: () => set({ pickingRegionB: true }),
    cancelPickB: () => set({ pickingRegionB: false }),
    clearRegionB: () => set({ regionB: null, pickingRegionB: false }),
    setPeriod: (period) => set({ period, year: null }),
    setYear: (year) => set({ year: year == null ? null : Math.round(year) }),
    setMapView: (mapView) => set({ mapView: mapView === 'diff' && !state.scenB ? 'side' : mapView }),
    setMapTab: (tab) => setUi({ mapTab: tab }),
    setObsOn: (on) => set({ obsLayer: { ...state.obsLayer, on: !!on } }),
    setObsSeries: (series) => set({ obsLayer: { ...state.obsLayer, series } }),
    setPeriodBars: (on) => set({ periodBars: !!on }),
  };

  return {
    get,
    set,
    actions,
    setManifest(m) { manifest = m; state = normalize(state, manifest); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
