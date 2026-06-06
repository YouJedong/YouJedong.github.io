// PC 전용 렌더링 (공통 로직은 app-core.js 참조)

// ── 렌더링 ───────────────────────────────────────────────────
function renderNavBar() {
  const nav = document.getElementById('dayNav');
  nav.innerHTML = '';
  for (let d = 1; d <= state.numDays; d++) {
    const btn = document.createElement('button');
    btn.className = 'day-nav-btn';
    btn.textContent = getDayLabel(d);
    btn.addEventListener('click', () => {
      const sec = document.getElementById(`day-${d}`);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(btn);
  }
}

function renderAllDays() {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '';
  for (let d = 1; d <= state.numDays; d++) {
    container.appendChild(buildDaySection(d));
  }
}

function buildDaySection(dayNum) {
  const { startHour, endHour } = getDayRange(dayNum);
  const visibleStartMin = startHour * 60;
  const visibleEndMin   = endHour   * 60;
  const totalHeight     = (endHour - startHour) * HOUR_HEIGHT;

  const section = document.createElement('section');
  section.className = 'day-section';
  section.id = `day-${dayNum}`;

  // ── 헤더 ──
  const hdr = document.createElement('div');
  hdr.className = 'day-header';

  const title = document.createElement('span');
  title.className = 'day-header-title';
  title.textContent = getDayLabel(dayNum);

  const rangeCtrl = document.createElement('div');
  rangeCtrl.className = 'day-range-ctrl';

  const startInput = document.createElement('input');
  startInput.type = 'number';
  startInput.className = 'hour-input';
  startInput.min = 0; startInput.max = 23;
  startInput.value = startHour;
  startInput.title = '시작 시각 (0~23시)';

  const endInput = document.createElement('input');
  endInput.type = 'number';
  endInput.className = 'hour-input';
  endInput.min = 1; endInput.max = 24;
  endInput.value = endHour;
  endInput.title = '종료 시각 (1~24시)';

  function applyRange() {
    let sh = Math.max(0, Math.min(23, parseInt(startInput.value) || 0));
    let eh = Math.max(1, Math.min(24, parseInt(endInput.value) || 24));
    if (sh >= eh) eh = Math.min(24, sh + 1);
    startInput.value = sh;
    endInput.value   = eh;
    setDayRange(dayNum, sh, eh);
    render();
    saveToStorage();
  }
  startInput.addEventListener('change', applyRange);
  endInput.addEventListener('change', applyRange);

  rangeCtrl.appendChild(startInput);
  rangeCtrl.appendChild(Object.assign(document.createElement('span'), { textContent: '시 ~' }));
  rangeCtrl.appendChild(endInput);
  rangeCtrl.appendChild(Object.assign(document.createElement('span'), { textContent: '시' }));

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-event';
  addBtn.textContent = '+ 일정 추가';
  addBtn.addEventListener('click', () => {
    const defaultStart = toTime(Math.max(visibleStartMin, 9 * 60));
    openAddModal(dayNum, defaultStart, toTime(Math.min(toMin(defaultStart) + 60, visibleEndMin)));
  });

  hdr.appendChild(title);
  hdr.appendChild(rangeCtrl);
  hdr.appendChild(addBtn);
  section.appendChild(hdr);

  // ── 타임라인 ──
  const timeline = document.createElement('div');
  timeline.className = 'timeline';

  const labels = document.createElement('div');
  labels.className = 'time-labels';
  labels.style.height = `${totalHeight}px`;

  const area = document.createElement('div');
  area.className = 'events-area';
  area.style.height = `${totalHeight}px`;

  for (let h = startHour; h < endHour; h++) {
    const top = (h - startHour) * HOUR_HEIGHT;

    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.style.top = `${top}px`;
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

  // 빈 공간 클릭 → 이벤트 추가
  area.addEventListener('click', (e) => {
    if (e.target !== area) return;
    const rect = area.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMin = visibleStartMin + y;
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

  timeline.appendChild(labels);
  timeline.appendChild(area);
  section.appendChild(timeline);
  return section;
}

// ── 모달 ─────────────────────────────────────────────────────
let editingId = null;

function fillTypeSelect(selectedId) {
  const sel = document.getElementById('evtType');
  sel.innerHTML = '';
  state.types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    if (t.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function openAddModal(day, startTime, endTime) {
  editingId = null;
  document.getElementById('modalTitle').textContent = '일정 추가';
  document.getElementById('evtTitle').value = '';
  document.getElementById('evtDay').value   = day;
  document.getElementById('evtStart').value = startTime;
  document.getElementById('evtEnd').value   = endTime;
  document.getElementById('evtMemo').value  = '';
  document.getElementById('btnDeleteEvent').classList.add('hidden');
  fillTypeSelect(null);
  document.getElementById('eventModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('evtTitle').focus(), 60);
}

function openEditModal(eventId) {
  const ev = state.events.find(e => e.id === eventId);
  if (!ev) return;
  editingId = eventId;
  document.getElementById('modalTitle').textContent = '일정 수정';
  document.getElementById('evtTitle').value = ev.title;
  document.getElementById('evtDay').value   = ev.day;
  document.getElementById('evtStart').value = ev.startTime;
  document.getElementById('evtEnd').value   = ev.endTime;
  document.getElementById('evtMemo').value  = ev.memo || '';
  document.getElementById('btnDeleteEvent').classList.remove('hidden');
  fillTypeSelect(ev.typeId);
  document.getElementById('eventModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('evtTitle').focus(), 60);
}

function closeEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
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

  const ev = {
    id:        editingId || uid(),
    title,
    typeId:    document.getElementById('evtType').value,
    day:       parseInt(document.getElementById('evtDay').value) || 1,
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
  render();
  saveToStorage();
}

function deleteEvent() {
  if (!editingId || !confirm('이 일정을 삭제할까요?')) return;
  state.events = state.events.filter(e => e.id !== editingId);
  closeEventModal();
  render();
  saveToStorage();
}

// ── 체크리스트 ───────────────────────────────────────────────
let dragSrcId = null;

function clearDragClasses() {
  document.querySelectorAll('.checklist-item').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function renderChecklist() {
  const el = document.getElementById('checklistEl');
  el.innerHTML = '';
  if (!state.checklist.length) {
    el.innerHTML = '<li class="checklist-empty">항목이 없어요</li>';
    return;
  }
  state.checklist.forEach(item => {
    const li = document.createElement('li');
    li.className = `checklist-item${item.checked ? ' checked' : ''}`;
    li.draggable = true;

    const handle = document.createElement('span');
    handle.className = 'checklist-drag-handle';
    handle.textContent = '⠿';

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

    const del = document.createElement('button');
    del.className = 'checklist-del';
    del.textContent = '×';
    del.title = '삭제';
    del.addEventListener('click', () => {
      state.checklist = state.checklist.filter(c => c.id !== item.id);
      renderChecklist();
      saveToStorage();
    });

    li.addEventListener('dragstart', e => {
      dragSrcId = item.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => li.classList.add('dragging'), 0);
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      clearDragClasses();
      dragSrcId = null;
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragSrcId === item.id) return;
      const isTop = e.clientY < li.getBoundingClientRect().top + li.offsetHeight / 2;
      clearDragClasses();
      li.classList.add(isTop ? 'drag-over-top' : 'drag-over-bottom');
    });
    li.addEventListener('dragleave', e => {
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });
    li.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrcId || dragSrcId === item.id) return;
      const srcIdx     = state.checklist.findIndex(c => c.id === dragSrcId);
      const insertAfter = e.clientY >= li.getBoundingClientRect().top + li.offsetHeight / 2;
      const [moved] = state.checklist.splice(srcIdx, 1);
      const dstIdx  = state.checklist.findIndex(c => c.id === item.id);
      state.checklist.splice(insertAfter ? dstIdx + 1 : dstIdx, 0, moved);
      renderChecklist();
      saveToStorage();
    });

    li.append(handle, cb, span, del);
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
let editingInfoId = null;

function renderInfoList() {
  const el = document.getElementById('infoListEl');
  el.innerHTML = '';
  if (!state.infoItems.length) {
    el.innerHTML = '<li class="info-empty">정보가 없어요</li>';
    return;
  }
  state.infoItems.forEach(item => {
    const li = document.createElement('li');
    li.className   = 'info-item';
    li.textContent = item.title;
    li.title       = item.title;
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
    document.getElementById('btnDeleteInfo').classList.remove('hidden');
  } else {
    editingInfoId = null;
    document.getElementById('infoModalTitle').textContent = '정보 추가';
    document.getElementById('infoTitle').value   = '';
    document.getElementById('infoContent').value = '';
    document.getElementById('btnDeleteInfo').classList.add('hidden');
  }
  document.getElementById('infoModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('infoTitle').focus(), 60);
}

function closeInfoModal() {
  document.getElementById('infoModal').classList.add('hidden');
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
    row.className = 'type-row';

    const colorPicker = document.createElement('input');
    colorPicker.type  = 'color';
    colorPicker.value = type.color;
    colorPicker.title = '색상 변경';
    colorPicker.addEventListener('input', e => { type.color = e.target.value; saveToStorage(); });

    const emojiInput = document.createElement('input');
    emojiInput.type        = 'text';
    emojiInput.className   = 'emoji-input';
    emojiInput.value       = type.emoji || '';
    emojiInput.placeholder = '😀';
    emojiInput.title       = '이모지 입력';
    emojiInput.addEventListener('input', e => { type.emoji = e.target.value.trim(); saveToStorage(); });

    const nameInput = document.createElement('input');
    nameInput.type  = 'text';
    nameInput.value = type.name;
    nameInput.addEventListener('change', e => {
      type.name = e.target.value.trim() || type.name;
      saveToStorage();
    });

    const delBtn = document.createElement('button');
    delBtn.className  = 'btn-danger';
    delBtn.style.padding  = '4px 10px';
    delBtn.style.fontSize = '12px';
    delBtn.textContent    = '삭제';
    delBtn.addEventListener('click', () => {
      if (state.types.length <= 1) { alert('타입은 최소 1개가 있어야 해요.'); return; }
      if (!confirm(`"${type.name}" 타입을 삭제할까요?`)) return;
      state.types = state.types.filter(t => t.id !== type.id);
      renderTypesList();
      saveToStorage();
    });

    row.appendChild(colorPicker);
    row.appendChild(emojiInput);
    row.appendChild(nameInput);
    row.appendChild(delBtn);
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
  document.getElementById('typesModal').classList.add('hidden');
  render();
}

// ── 전체 렌더 ────────────────────────────────────────────────
function render() {
  renderNavBar();
  renderAllDays();
}

function syncInputs() {
  document.getElementById('tripName').value  = state.tripName;
  document.getElementById('startDate').value = state.startDate;
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
  syncInputs();

  document.getElementById('tripName').addEventListener('input', e => {
    state.tripName = e.target.value;
    document.title = (e.target.value || '일본 여행') + ' 플래너';
    saveToStorage();
  });

  document.getElementById('startDate').addEventListener('change', e => {
    state.startDate = e.target.value;
    render();
    saveToStorage();
  });

  document.getElementById('btnAddDay').addEventListener('click', () => {
    state.numDays++;
    render();
    saveToStorage();
    setTimeout(() => {
      const sec = document.getElementById(`day-${state.numDays}`);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  document.getElementById('btnRemoveDay').addEventListener('click', () => {
    if (state.numDays <= 1) return;
    const last = state.numDays;
    if (state.events.some(e => e.day === last)) {
      if (!confirm(`Day ${last}에 일정이 있어요. 일차를 삭제할까요?`)) return;
      state.events = state.events.filter(e => e.day !== last);
    }
    state.numDays--;
    render();
    saveToStorage();
  });

  document.getElementById('btnExport').addEventListener('click', exportData);

  document.getElementById('btnSaveServer').addEventListener('click', async () => {
    const btn = document.getElementById('btnSaveServer');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '저장 중…';
    try {
      await saveToServer();
      btn.textContent = '✓ 완료';
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
    } catch (e) {
      alert('서버 저장 실패:\n' + e.message);
      btn.textContent = orig;
      btn.disabled = false;
    }
  });

  document.getElementById('importFile').addEventListener('change', e => {
    if (e.target.files[0]) {
      importData(e.target.files[0], () => {
        syncInputs();
        render();
        renderChecklist();
        renderInfoList();
        saveToStorage();
      });
    }
    e.target.value = '';
  });

  // 이벤트 모달
  document.getElementById('btnSaveEvent').addEventListener('click', saveEvent);
  document.getElementById('btnDeleteEvent').addEventListener('click', deleteEvent);
  document.getElementById('btnCloseModal').addEventListener('click', closeEventModal);
  document.getElementById('eventModal').addEventListener('click', e => {
    if (e.target.id === 'eventModal') closeEventModal();
  });
  document.getElementById('eventModal').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveEvent();
    }
  });

  // 체크리스트
  document.getElementById('btnAddCheck').addEventListener('click', addCheckItem);
  document.getElementById('newCheckItem').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) addCheckItem();
  });

  // 정보 목록
  document.getElementById('btnAddInfo').addEventListener('click', () => openInfoModal(null));
  document.getElementById('btnSaveInfo').addEventListener('click', saveInfo);
  document.getElementById('btnDeleteInfo').addEventListener('click', deleteInfo);
  document.getElementById('btnCloseInfo').addEventListener('click', closeInfoModal);
  document.getElementById('infoModal').addEventListener('click', e => {
    if (e.target.id === 'infoModal') closeInfoModal();
  });
  document.getElementById('infoModal').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      saveInfo();
    }
  });

  // 타입 모달
  document.getElementById('btnManageTypes').addEventListener('click', () => {
    renderTypesList();
    document.getElementById('typesModal').classList.remove('hidden');
  });
  document.getElementById('btnAddType').addEventListener('click', addNewType);
  document.getElementById('newTypeName').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) addNewType();
  });
  document.getElementById('btnCloseTypes').addEventListener('click', closeTypesModal);
  document.getElementById('typesModal').addEventListener('click', e => {
    if (e.target.id === 'typesModal') closeTypesModal();
  });

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeEventModal();
      closeInfoModal();
      if (!document.getElementById('typesModal').classList.contains('hidden')) {
        closeTypesModal();
      }
    }
  });

  // 호버 툴팁
  const tooltip = document.getElementById('eventTooltip');

  function positionTooltip(e) {
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let x = e.clientX + 16;
    let y = e.clientY + 10;
    if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - 8;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - 8;
    tooltip.style.left = `${x}px`;
    tooltip.style.top  = `${y}px`;
  }

  function showTooltip(block, e) {
    tooltip.innerHTML = '';
    const titleEl = document.createElement('div');
    titleEl.className   = 'tt-title';
    titleEl.textContent = block.dataset.ttTitle;
    const timeEl = document.createElement('div');
    timeEl.className   = 'tt-time';
    timeEl.textContent = block.dataset.ttTime;
    tooltip.appendChild(titleEl);
    tooltip.appendChild(timeEl);
    if (block.dataset.ttMemo) {
      const memoEl = document.createElement('div');
      memoEl.className   = 'tt-memo';
      memoEl.textContent = block.dataset.ttMemo;
      tooltip.appendChild(memoEl);
    }
    tooltip.classList.add('visible');
    positionTooltip(e);
  }

  document.addEventListener('mouseover', e => {
    const block = e.target.closest('[data-needs-tooltip]');
    if (!block) return;
    showTooltip(block, e);
  });
  document.addEventListener('mousemove', e => {
    if (tooltip.classList.contains('visible')) positionTooltip(e);
  });
  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget?.closest('[data-needs-tooltip]')) {
      tooltip.classList.remove('visible');
    }
  });

  render();
  renderChecklist();
  renderInfoList();
});
