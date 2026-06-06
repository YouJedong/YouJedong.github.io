// 1px = 1분 (HOUR_HEIGHT = 60px = 1시간)
const HOUR_HEIGHT = 60;

// ── ID 생성 ──────────────────────────────────────────────────
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── 초기 상태 ────────────────────────────────────────────────
let state = {
  tripName: '일본 여행',
  startDate: '',
  numDays: 4,
  daySettings: {},
  events: [],
  checklist: [],
  infoItems: [],
  types: [
    { id: uid(), name: '비행기',      color: '#3A86FF', emoji: '✈️' },
    { id: uid(), name: '신칸센/기차', color: '#E63946', emoji: '🚄' },
    { id: uid(), name: '버스',        color: '#2DC653', emoji: '🚌' },
    { id: uid(), name: '식사',        color: '#9B59B6', emoji: '🍽️' },
    { id: uid(), name: '관광/활동',   color: '#FF6B35', emoji: '📸' },
    { id: uid(), name: '숙박/체크인', color: '#06D6A0', emoji: '🏨' },
    { id: uid(), name: '도보/이동',   color: '#F4A261', emoji: '🚶' },
  ],
};

// ── 시간 유틸 ────────────────────────────────────────────────
function toMin(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function toTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDayLabel(dayNum) {
  if (!state.startDate) return `Day ${dayNum}`;
  const d = new Date(state.startDate + 'T00:00:00');
  d.setDate(d.getDate() + dayNum - 1);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `Day ${dayNum}  ·  ${d.getMonth() + 1}/${d.getDate()} (${wd})`;
}

function getDayLabelShort(dayNum) {
  if (!state.startDate) return `Day ${dayNum}`;
  const d = new Date(state.startDate + 'T00:00:00');
  d.setDate(d.getDate() + dayNum - 1);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `Day ${dayNum} · ${d.getMonth() + 1}/${d.getDate()}(${wd})`;
}

function getType(typeId) {
  return state.types.find(t => t.id === typeId);
}

function getDayRange(dayNum) {
  const s = state.daySettings?.[dayNum];
  return { startHour: s?.startHour ?? 0, endHour: s?.endHour ?? 24 };
}

function setDayRange(dayNum, startHour, endHour) {
  if (!state.daySettings) state.daySettings = {};
  state.daySettings[dayNum] = { startHour, endHour };
}

function darken(hex, amt = 40) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── 겹치는 이벤트 레이아웃 계산 ─────────────────────────────
function calcLayout(events) {
  const info = new Map();
  if (!events.length) return info;

  const sorted = [...events].sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  const laneEnds = [];

  for (const ev of sorted) {
    const s = toMin(ev.startTime);
    let lane = laneEnds.findIndex(end => end <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = toMin(ev.endTime);
    info.set(ev.id, { lane });
  }

  const numLanes = laneEnds.length;
  for (const v of info.values()) v.numLanes = numLanes;
  return info;
}

// ── 이벤트 블록 빌더 (PC/모바일 공용) ───────────────────────
// onClickEdit: (eventId) => void
function buildEventBlock(event, lane, numLanes, visibleStartMin = 0, visibleEndMin = 24 * 60, onClickEdit) {
  const type = getType(event.typeId);
  const color = type ? type.color : '#95A5A6';
  const startMin = toMin(event.startTime);
  const endMin   = toMin(event.endTime);

  if (endMin <= visibleStartMin || startMin >= visibleEndMin) return null;

  const clippedStart = Math.max(startMin, visibleStartMin);
  const clippedEnd   = Math.min(endMin,   visibleEndMin);
  const top    = clippedStart - visibleStartMin;
  const height = Math.max(clippedEnd - clippedStart, 15);

  const clippedTop    = startMin < visibleStartMin;
  const clippedBottom = endMin   > visibleEndMin;

  const block = document.createElement('div');
  block.className = 'event-block';
  block.style.top    = `${top}px`;
  block.style.height = `${height}px`;
  block.style.backgroundColor = color;
  block.style.borderLeft = `4px solid ${darken(color, 40)}`;
  if (clippedTop)    block.style.borderTopLeftRadius    = '0';
  if (clippedBottom) block.style.borderBottomLeftRadius = '0';

  if (numLanes > 1) {
    const pct = 100 / numLanes;
    block.style.left  = `calc(${lane * pct}% + 4px)`;
    block.style.width = `calc(${pct}% - 8px)`;
  } else {
    block.style.left  = '8px';
    block.style.right = '8px';
  }

  const timeText  = `${event.startTime} – ${event.endTime}`;
  const isCompact = height < 32;

  const title = document.createElement('div');
  title.className = 'event-title';
  title.textContent = (type?.emoji ? type.emoji + ' ' : '') + event.title;
  block.appendChild(title);

  if (isCompact) {
    block.classList.add('event-block--compact');
  } else {
    if (height >= 25) {
      const time = document.createElement('div');
      time.className = 'event-time';
      time.textContent = (clippedTop || clippedBottom) ? `(${timeText})` : timeText;
      block.appendChild(time);
    }
    if (height >= 48 && event.memo) {
      const memo = document.createElement('div');
      memo.className = 'event-memo';
      memo.textContent = event.memo;
      block.appendChild(memo);
    }
  }

  const needsTooltip = isCompact || (event.memo && height < 120);
  if (needsTooltip) {
    block.dataset.needsTooltip = 'true';
    block.dataset.ttTitle = (type?.emoji ? type.emoji + ' ' : '') + event.title;
    block.dataset.ttTime  = (clippedTop || clippedBottom) ? `(${timeText})` : timeText;
    block.dataset.ttMemo  = event.memo || '';
  }

  block.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onClickEdit) onClickEdit(event.id);
  });

  return block;
}

// ── JSON 내보내기/가져오기 ───────────────────────────────────
function exportData() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `japan_plan_${state.startDate || 'draft'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── localStorage 자동 저장/불러오기 ─────────────────────────
const STORAGE_KEY = 'travel_planner_state';

function saveToStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// 저장된 데이터가 있으면 state에 로드하고 true 반환, 없으면 false
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.events) || !Array.isArray(data.types)) return false;
    state = data;
    if (!state.checklist) state.checklist = [];
    if (!state.infoItems)  state.infoItems  = [];
    return true;
  } catch { return false; }
}

// ── GitHub API 서버 저장/불러오기 ─────────────────────────────
const GITHUB_REPO = 'YouJedong/travel-mng';
const PLAN_FILE   = 'plan.json';
const PAT_KEY     = 'travel_planner_pat';

async function fetchDefaultPlan() {
  try {
    const res = await fetch('./plan.json', { cache: 'no-cache' });
    if (!res.ok) return false;
    const data = await res.json();
    if (!Array.isArray(data.events) || !Array.isArray(data.types)) return false;
    state = data;
    if (!state.checklist) state.checklist = [];
    if (!state.infoItems)  state.infoItems  = [];
    return true;
  } catch { return false; }
}

async function saveToServer() {
  let pat = localStorage.getItem(PAT_KEY);
  if (!pat) {
    pat = (window.prompt('GitHub Personal Access Token 입력\n(Settings → Developer settings → PAT → repo 권한):') || '').trim();
    if (!pat) return false;
    localStorage.setItem(PAT_KEY, pat);
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${PLAN_FILE}`;
  const headers = {
    Authorization: `token ${pat}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const getRes = await fetch(url, { headers });
  if (getRes.status === 401) {
    localStorage.removeItem(PAT_KEY);
    throw new Error('인증 실패 — PAT를 확인하고 다시 시도하세요.');
  }
  if (!getRes.ok) throw new Error(`파일 조회 실패 (${getRes.status})`);
  const { sha } = await getRes.json();

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
  const putRes  = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `plan: 여행 일정 업데이트 ${new Date().toISOString().slice(0, 10)}`,
      content,
      sha,
    }),
  });
  if (putRes.status === 401) {
    localStorage.removeItem(PAT_KEY);
    throw new Error('인증 실패 — PAT를 확인하고 다시 시도하세요.');
  }
  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    throw new Error(err.message || `저장 실패 (${putRes.status})`);
  }
  return true;
}

// onSuccess: () => void — 각 플랫폼(PC/모바일)이 UI 갱신 콜백을 넘겨줌
function importData(file, onSuccess) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.events) || !Array.isArray(data.types)) throw new Error();
      state = data;
      if (!state.checklist) state.checklist = [];
      if (!state.infoItems)  state.infoItems  = [];
      if (onSuccess) onSuccess();
    } catch {
      alert('올바른 형식의 JSON 파일이 아니에요.');
    }
  };
  reader.readAsText(file);
}
