// 모바일 전용 렌더링 (공통 로직은 app-core.js 참조)

let currentDay = 1;
let currentTab = 'schedule';
let editingId = null;
let editingInfoId = null;

// ── 탭 전환 ──────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;

  ['schedule', 'checklist', 'info'].forEach(t => {
    const pane = document.getElementById(`pane${capitalize(t)}`);
    const btn  = document.getElementById(`tabBtn${capitalize(t)}`);
    if (t === tab) {
      pane.classList.remove('m-tab-pane--hidden');
      btn.classList.add('m-tab-btn--active');
    } else {
      pane.classList.add('m-tab-pane--hidden');
      btn.classList.remove('m-tab-btn--active');
    }
  });

  // 날짜 네비바는 일정 탭에서만 표시
  document.getElementById('dayNavBar').classList.toggle('m-day-nav--hidden', tab !== 'schedule');

  // 콘텐츠 영역 top 조정 (일정 탭은 daynav 있음)
  const content = document.querySelector('.m-content');
  if (tab === 'schedule') {
    content.style.top = 'calc(var(--header-h) + var(--daynav-h))';
  } else {
    content.style.top = 'var(--header-h)';
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── 날짜 네비게이션 ──────────────────────────────────────────
function updateDayNav() {
  document.getElementById('currentDayLabel').textContent = getDayLabelShort(currentDay);
  document.getElementById('dayCountLabel').textContent   = `${state.numDays}일`;

  const { startHour, endHour } = getDayRange(currentDay);
  document.getElementById('mDayStart').value = startHour;
  document.getElementById('mDayEnd').value   = endHour;
}

function goToPrevDay() {
  if (currentDay <= 1) return;
  currentDay--;
  updateDayNav();
  renderTimeline();
}

function goToNextDay() {
  if (currentDay >= state.numDays) return;
  currentDay++;
  updateDayNav();
  renderTimeline();
}

// ── 타임라인 렌더링 (현재 날짜 1개) ─────────────────────────
function renderTimeline() {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '';
  container.appendChild(buildMobileDaySection(currentDay));
}

function buildMobileDaySection(dayNum) {
  const { startHour, endHour } = getDayRange(dayNum);
  const visibleStartMin = startHour * 60;
  const visibleEndMin   = endHour   * 60;
  const totalHeight     = (endHour - startHour) * HOUR_HEIGHT;

  const wrap = document.createElement('div');
  wrap.className = 'timeline';

  const labels = document.createElement('div');
  labels.className = 'time-labels';
  labels.style.height = `${totalHeight}px`;

  const area = document.createElement('div');
  area.className = 'events-area';
  area.style.height = `${totalHeight}px`;

  for (let h = startHour; h < endHour; h++) {
    const top = (h - startHour) * HOUR_HEIGHT;

    const lbl = document.createElement('div');
    lbl.className   = 'time-label';
    lbl.style.top   = `${top}px`;
    lbl.textContent = `${String(h).padStart(2, '0')}:00`;
    labels.appendChild(lbl);

    const row = document.createElement('div');
    row.className = 'hour-row';
    row.style.top = `${top}px`;
    area.appendChild(row);

    const half = document.createElement('div');
    half.className = 'half-row';
    half.style.top = `${top + HOUR_HEIGHT / 2}px`;
    area.appendChild(half);
  }

  // 빈 공간 탭 → 이벤트 추가
  area.addEventListener('click', (e) => {
    if (e.target !== area) return;
    const rect    = area.getBoundingClientRect();
    const y       = e.clientY - rect.top;
    const rawMin  = visibleStartMin + y;
    const snapped = Math.max(visibleStartMin, Math.min(Math.round(rawMin / 30) * 30, visibleEndMin - 60));
    openAddModal(dayNum, toTime(snapped), toTime(Math.min(snapped + 60, visibleEndMin)));
  });

  const dayEvents = state.events.filter(ev =>
    ev.day === dayNum &&
    toMin(ev.endTime)   > visibleStartMin &&
    toMin(ev.startTime) < visibleEndMin
  );
  const layout = calcLayout(dayEvents);

  dayEvents.forEach(ev => {
    const { lane, numLanes } = layout.get(ev.id) || { lane: 0, numLanes: 1 };
    const block = buildEventBlock(ev, lane, numLanes, visibleStartMin, visibleEndMin, openEditModal);
    if (block) area.appendChild(block);
  });

  wrap.appendChild(labels);
  wrap.appendChild(area);
  return wrap;
}

// ── 이벤트 모달 ──────────────────────────────────────────────
function fillTypeSelect(selectedId) {
  const sel = document.getElementById('evtType');
  sel.innerHTML = '';
  state.types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = (t.emoji ? t.emoji + ' ' : '') + t.name;
    if (t.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function fillDaySelect(selectedDay) {
  const sel = document.getElementById('evtDay');
  sel.innerHTML = '';
  for (let d = 1; d <= state.numDays; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = getDayLabelShort(d);
    if (d === selectedDay) opt.selected = true;
    sel.appendChild(opt);
  }
}

function openAddModal(day, startTime, endTime) {
  editingId = null;
  document.getElementById('modalTitle').textContent = '일정 추가';
  document.getElementById('evtTitle').value = '';
  document.getElementById('evtStart').value = startTime;
  document.getElementById('evtEnd').value   = endTime;
  document.getElementById('evtMemo').value  = '';
  document.getElementById('btnDeleteEvent').classList.add('m-btn--hidden');
  fillTypeSelect(null);
  fillDaySelect(day);
  openSheet('eventModal');
  setTimeout(() => document.getElementById('evtTitle').focus(), 300);
}

function openEditModal(eventId) {
  const ev = state.events.find(e => e.id === eventId);
  if (!ev) return;
  editingId = eventId;
  document.getElementById('modalTitle').textContent = '일정 수정';
  document.getElementById('evtTitle').value = ev.title;
  document.getElementById('evtStart').value = ev.startTime;
  document.getElementById('evtEnd').value   = ev.endTime;
  document.getElementById('evtMemo').value  = ev.memo || '';
  document.getElementById('btnDeleteEvent').classList.remove('m-btn--hidden');
  fillTypeSelect(ev.typeId);
  fillDaySelect(ev.day);
  openSheet('eventModal');
}

function closeEventModal() {
  closeSheet('eventModal');
  editingId = null;
}

function saveEvent() {
  const title = document.getElementById('evtTitle').value.trim();
  if (!title) { document.getElementById('evtTitle').focus(); return; }

  const startTime = document.getElementById('evtStart').value;
  const endTime   = document.getElementById('evtEnd').value;
  if (!startTime || !endTime) { alert('시작/종료 시간을 입력해 주세요.'); return; }
  if (toMin(startTime) >= toMin(endTime)) {
    alert('종료 시간이 시작 시간보다 늦어야 해요.');
    return;
  }

  const dayVal = parseInt(document.getElementById('evtDay').value) || currentDay;
  const ev = {
    id:        editingId || uid(),
    title,
    typeId:    document.getElementById('evtType').value,
    day:       dayVal,
    startTime,
    endTime,
    memo:      document.getElementById('evtMemo').value.trim(),
  };

  if (editingId) {
    const idx = state.events.findIndex(e => e.id === editingId);
    if (idx !== -1) state.events[idx] = ev;
  } else {
    state.events.push(ev);
  }

  closeEventModal();
  if (dayVal !== currentDay) {
    currentDay = dayVal;
    updateDayNav();
  }
  renderTimeline();
  saveToStorage();
}

function deleteEvent() {
  if (!editingId || !confirm('이 일정을 삭제할까요?')) return;
  state.events = state.events.filter(e => e.id !== editingId);
  closeEventModal();
  renderTimeline();
  saveToStorage();
}

// ── 체크리스트 ───────────────────────────────────────────────
function renderChecklist() {
  const el = document.getElementById('checklistEl');
  el.innerHTML = '';

  if (!state.checklist.length) {
    const li = document.createElement('li');
    li.className   = 'm-checklist-empty';
    li.textContent = '항목이 없어요';
    el.appendChild(li);
    return;
  }

  state.checklist.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = `m-checklist-item${item.checked ? ' m-checked' : ''}`;

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = item.checked;
    cb.addEventListener('change', () => {
      item.checked = cb.checked;
      renderChecklist();
      saveToStorage();
    });

    const span = document.createElement('span');
    span.textContent = item.text;

    const actions = document.createElement('div');
    actions.className = 'm-checklist-item-actions';

    const upBtn = document.createElement('button');
    upBtn.className   = 'm-order-btn';
    upBtn.textContent = '↑';
    upBtn.title       = '위로';
    upBtn.disabled    = idx === 0;
    upBtn.addEventListener('click', () => {
      [state.checklist[idx - 1], state.checklist[idx]] = [state.checklist[idx], state.checklist[idx - 1]];
      renderChecklist();
      saveToStorage();
    });

    const downBtn = document.createElement('button');
    downBtn.className   = 'm-order-btn';
    downBtn.textContent = '↓';
    downBtn.title       = '아래로';
    downBtn.disabled    = idx === state.checklist.length - 1;
    downBtn.addEventListener('click', () => {
      [state.checklist[idx], state.checklist[idx + 1]] = [state.checklist[idx + 1], state.checklist[idx]];
      renderChecklist();
      saveToStorage();
    });

    const del = document.createElement('button');
    del.className   = 'm-checklist-del';
    del.textContent = '×';
    del.title       = '삭제';
    del.addEventListener('click', () => {
      state.checklist = state.checklist.filter(c => c.id !== item.id);
      renderChecklist();
      saveToStorage();
    });

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(del);
    li.append(cb, span, actions);
    el.appendChild(li);
  });
}

function addCheckItem() {
  const input = document.getElementById('newCheckItem');
  const text  = input.value.trim();
  if (!text) { input.focus(); return; }
  state.checklist.push({ id: uid(), text, checked: false });
  input.value = '';
  renderChecklist();
  input.focus();
  saveToStorage();
}

// ── 정보 목록 ────────────────────────────────────────────────
function renderInfoList() {
  const el = document.getElementById('infoListEl');
  el.innerHTML = '';

  if (!state.infoItems.length) {
    const li = document.createElement('li');
    li.className   = 'm-info-empty';
    li.textContent = '정보가 없어요';
    el.appendChild(li);
    return;
  }

  state.infoItems.forEach(item => {
    const li = document.createElement('li');
    li.className   = 'm-info-item';
    li.textContent = item.title;
    li.addEventListener('click', () => openInfoModal(item.id));
    el.appendChild(li);
  });
}

function openInfoModal(id) {
  if (id) {
    const item = state.infoItems.find(i => i.id === id);
    if (!item) return;
    editingInfoId = id;
    document.getElementById('infoModalTitle').textContent = '정보 수정';
    document.getElementById('infoTitle').value   = item.title;
    document.getElementById('infoContent').value = item.content || '';
    document.getElementById('btnDeleteInfo').classList.remove('m-btn--hidden');
  } else {
    editingInfoId = null;
    document.getElementById('infoModalTitle').textContent = '정보 추가';
    document.getElementById('infoTitle').value   = '';
    document.getElementById('infoContent').value = '';
    document.getElementById('btnDeleteInfo').classList.add('m-btn--hidden');
  }
  openSheet('infoModal');
  setTimeout(() => document.getElementById('infoTitle').focus(), 300);
}

function closeInfoModal() {
  closeSheet('infoModal');
  editingInfoId = null;
}

function saveInfo() {
  const title = document.getElementById('infoTitle').value.trim();
  if (!title) { document.getElementById('infoTitle').focus(); return; }
  const content = document.getElementById('infoContent').value.trim();

  if (editingInfoId) {
    const item = state.infoItems.find(i => i.id === editingInfoId);
    if (item) { item.title = title; item.content = content; }
  } else {
    state.infoItems.push({ id: uid(), title, content });
  }
  closeInfoModal();
  renderInfoList();
  saveToStorage();
}

function deleteInfo() {
  if (!editingInfoId || !confirm('이 정보를 삭제할까요?')) return;
  state.infoItems = state.infoItems.filter(i => i.id !== editingInfoId);
  closeInfoModal();
  renderInfoList();
  saveToStorage();
}

// ── 타입 관리 ────────────────────────────────────────────────
function renderTypesList() {
  const list = document.getElementById('typesList');
  list.innerHTML = '';

  state.types.forEach(type => {
    const row = document.createElement('div');
    row.className = 'm-type-row';

    const colorPicker = document.createElement('input');
    colorPicker.type  = 'color';
    colorPicker.value = type.color;
    colorPicker.addEventListener('input', e => { type.color = e.target.value; saveToStorage(); });

    const emojiInput = document.createElement('input');
    emojiInput.type        = 'text';
    emojiInput.className   = 'm-emoji-input';
    emojiInput.value       = type.emoji || '';
    emojiInput.placeholder = '😀';
    emojiInput.addEventListener('input', e => { type.emoji = e.target.value.trim(); saveToStorage(); });

    const nameInput = document.createElement('input');
    nameInput.type  = 'text';
    nameInput.value = type.name;
    nameInput.style.flex = '1';
    nameInput.addEventListener('change', e => {
      type.name = e.target.value.trim() || type.name;
      saveToStorage();
    });

    const delBtn = document.createElement('button');
    delBtn.className   = 'm-type-del-btn';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
      if (state.types.length <= 1) { alert('타입은 최소 1개가 있어야 해요.'); return; }
      if (!confirm(`"${type.name}" 타입을 삭제할까요?`)) return;
      state.types = state.types.filter(t => t.id !== type.id);
      renderTypesList();
      saveToStorage();
    });

    row.append(colorPicker, emojiInput, nameInput, delBtn);
    list.appendChild(row);
  });
}

function addNewType() {
  const name  = document.getElementById('newTypeName').value.trim();
  if (!name) { document.getElementById('newTypeName').focus(); return; }
  const color = document.getElementById('newTypeColor').value;
  const emoji = document.getElementById('newTypeEmoji').value.trim();
  state.types.push({ id: uid(), name, color, emoji });
  document.getElementById('newTypeName').value  = '';
  document.getElementById('newTypeEmoji').value = '';
  renderTypesList();
  saveToStorage();
}

function closeTypesModal() {
  closeSheet('typesModal');
  renderTimeline();
}

// ── 바텀시트 열기/닫기 ───────────────────────────────────────
function openSheet(overlayId) {
  document.getElementById(overlayId).classList.remove('m-overlay--hidden');
}

function closeSheet(overlayId) {
  document.getElementById(overlayId).classList.add('m-overlay--hidden');
}

// ── 입력 동기화 ──────────────────────────────────────────────
function syncMobileInputs() {
  document.getElementById('tripName').value  = state.tripName;
  document.getElementById('startDate').value = state.startDate;
  if (currentDay > state.numDays) currentDay = state.numDays;
  if (currentDay < 1) currentDay = 1;
}

// ── FAB 동작 ─────────────────────────────────────────────────
function handleFab() {
  if (currentTab === 'schedule') {
    const { startHour, endHour } = getDayRange(currentDay);
    const defaultStart = toTime(Math.max(startHour * 60, 9 * 60));
    openAddModal(currentDay, defaultStart, toTime(Math.min(toMin(defaultStart) + 60, endHour * 60)));
  } else if (currentTab === 'checklist') {
    document.getElementById('newCheckItem').focus();
  } else if (currentTab === 'info') {
    openInfoModal(null);
  }
}

// ── 초기화 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // plan.json 항상 우선 (온라인), 실패 시 localStorage fallback (오프라인)
  const fetched = await fetchDefaultPlan();
  if (fetched) {
    saveToStorage();
  } else {
    const stored = loadFromStorage();
    if (!stored) state.startDate = new Date().toISOString().slice(0, 10);
  }
  syncMobileInputs();
  updateDayNav();
  renderTimeline();
  renderChecklist();
  renderInfoList();

  // 헤더 컨트롤
  document.getElementById('tripName').addEventListener('input', e => {
    state.tripName = e.target.value;
    document.title = (e.target.value || '일본 여행') + ' 플래너';
    saveToStorage();
  });

  document.getElementById('startDate').addEventListener('change', e => {
    state.startDate = e.target.value;
    updateDayNav();
    renderTimeline();
    saveToStorage();
  });

  document.getElementById('btnExport').addEventListener('click', exportData);

  document.getElementById('btnSaveServer').addEventListener('click', async () => {
    const btn = document.getElementById('btnSaveServer');
    const orig = btn.title;
    btn.disabled = true;
    btn.textContent = '…';
    try {
      await saveToServer();
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = '☁'; btn.title = orig; btn.disabled = false; }, 2000);
    } catch (e) {
      alert('서버 저장 실패:\n' + e.message);
      btn.textContent = '☁';
      btn.disabled = false;
    }
  });

  document.getElementById('importFile').addEventListener('change', e => {
    if (e.target.files[0]) {
      importData(e.target.files[0], () => {
        syncMobileInputs();
        updateDayNav();
        renderTimeline();
        renderChecklist();
        renderInfoList();
        saveToStorage();
      });
    }
    e.target.value = '';
  });

  // 날짜 네비게이션
  document.getElementById('btnPrevDay').addEventListener('click', goToPrevDay);
  document.getElementById('btnNextDay').addEventListener('click', goToNextDay);

  document.getElementById('btnAddDay').addEventListener('click', () => {
    state.numDays++;
    updateDayNav();
    saveToStorage();
  });

  document.getElementById('btnRemoveDay').addEventListener('click', () => {
    if (state.numDays <= 1) return;
    const last = state.numDays;
    if (state.events.some(e => e.day === last)) {
      if (!confirm(`Day ${last}에 일정이 있어요. 일차를 삭제할까요?`)) return;
      state.events = state.events.filter(e => e.day !== last);
    }
    state.numDays--;
    if (currentDay > state.numDays) currentDay = state.numDays;
    updateDayNav();
    renderTimeline();
    saveToStorage();
  });

  // 날짜별 시간 범위 변경
  function applyDayRange() {
    let sh = Math.max(0, Math.min(23, parseInt(document.getElementById('mDayStart').value) || 0));
    let eh = Math.max(1, Math.min(24, parseInt(document.getElementById('mDayEnd').value)   || 24));
    if (sh >= eh) eh = Math.min(24, sh + 1);
    document.getElementById('mDayStart').value = sh;
    document.getElementById('mDayEnd').value   = eh;
    setDayRange(currentDay, sh, eh);
    renderTimeline();
    saveToStorage();
  }
  document.getElementById('mDayStart').addEventListener('change', applyDayRange);
  document.getElementById('mDayEnd').addEventListener('change', applyDayRange);

  // 탭 전환
  document.querySelectorAll('.m-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // FAB
  document.getElementById('fabBtn').addEventListener('click', handleFab);

  // 이벤트 모달
  document.getElementById('btnSaveEvent').addEventListener('click', saveEvent);
  document.getElementById('btnDeleteEvent').addEventListener('click', deleteEvent);
  document.getElementById('btnCloseModal').addEventListener('click', closeEventModal);
  document.getElementById('eventModal').addEventListener('click', e => {
    if (e.target.id === 'eventModal') closeEventModal();
  });

  // 정보 모달
  document.getElementById('btnAddInfo').addEventListener('click', () => openInfoModal(null));
  document.getElementById('btnSaveInfo').addEventListener('click', saveInfo);
  document.getElementById('btnDeleteInfo').addEventListener('click', deleteInfo);
  document.getElementById('btnCloseInfo').addEventListener('click', closeInfoModal);
  document.getElementById('infoModal').addEventListener('click', e => {
    if (e.target.id === 'infoModal') closeInfoModal();
  });

  // 체크리스트
  document.getElementById('btnAddCheck').addEventListener('click', addCheckItem);
  document.getElementById('newCheckItem').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) addCheckItem();
  });

  // 타입 모달
  document.getElementById('btnManageTypes').addEventListener('click', () => {
    renderTypesList();
    openSheet('typesModal');
  });
  document.getElementById('btnAddType').addEventListener('click', addNewType);
  document.getElementById('newTypeName').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) addNewType();
  });
  document.getElementById('btnCloseTypes').addEventListener('click', closeTypesModal);
  document.getElementById('typesModal').addEventListener('click', e => {
    if (e.target.id === 'typesModal') closeTypesModal();
  });

  // ESC 키
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEventModal();
      closeInfoModal();
      if (!document.getElementById('typesModal').classList.contains('m-overlay--hidden')) {
        closeTypesModal();
      }
    }
  });
});
