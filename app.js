const KEY = 'focus-tracker-data-v4';
const OLD = ['focus-tracker-data-v3', 'focus-tracker-data-v2', 'focus-tracker-data-v1'];
const USER_ID = 'leequyn';
const SUPABASE_URL = 'https://yduzszsyrbbugjmlrceh.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || localStorage.getItem('supabase-anon-key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkdXpzenN5YnJidWdqbWxyY2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDcxNjAsImV4cCI6MjA5NjcyMzE2MH0.x80POR0U86eaNXfKGVeD6axkfdFgW3H0b85GEBEZUjA';
const DEFAULT_SETTINGS = { moneyPrefixes: ['AFF', 'SI', 'GT'], opsPrefixes: ['CHECK', 'MEET', 'OPS'] };

let state = loadState();
let dashboardFilter = { mode: 'last7', start: '', end: '' };
let currentPage = 'today';
ensureState();

function fallbackState() {
  return { sessions: [], active: null, reviews: {}, settings: structuredClone(DEFAULT_SETTINGS) };
}

function loadState() {
  let raw = localStorage.getItem(KEY);
  if (!raw) {
    for (const k of OLD) {
      raw = localStorage.getItem(k);
      if (raw) break;
    }
  }
  if (!raw) return fallbackState();
  try {
    return JSON.parse(raw);
  } catch {
    return fallbackState();
  }
}

function ensureState() {
  state.sessions = state.sessions || [];
  state.reviews = state.reviews || {};
  state.settings = state.settings || structuredClone(DEFAULT_SETTINGS);
  state.settings.moneyPrefixes = cleanPrefixes(state.settings.moneyPrefixes?.length ? state.settings.moneyPrefixes : DEFAULT_SETTINGS.moneyPrefixes);
  state.settings.opsPrefixes = cleanPrefixes(state.settings.opsPrefixes?.length ? state.settings.opsPrefixes : DEFAULT_SETTINGS.opsPrefixes);
}

function save() {
  ensureState();
  localStorage.setItem(KEY, JSON.stringify(state));
}

function setSyncStatus(status) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const labels = { synced: 'Đã đồng bộ', syncing: 'Đang đồng bộ', error: 'Lỗi kết nối' };
  el.textContent = labels[status] || labels.error;
  el.className = `sync-status ${status}`;
}

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function supabaseRequest(path, options = {}) {
  if (!hasSupabaseConfig()) throw new Error('Missing Supabase anon key');
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(options.headers || {})
  };
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) return null;
  return response.json();
}

function cleanPrefixes(input) {
  const arr = Array.isArray(input) ? input : String(input || '').split(/[\n,]+/);
  return [...new Set(arr.map(x => String(x).trim().toUpperCase()).filter(Boolean))];
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeText(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minText(m) {
  m = Math.max(0, Math.round(m));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h}h${r}p` : h ? `${h}h` : `${r}p`;
}

function mins(a, b) {
  return Math.max(0, Math.round((endSafe(b) - a) / 60000));
}

function endSafe(v) {
  return v || Date.now();
}

function esc(s) {
  return String(s || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function prefix(name) {
  const m = (name || '').trim().toUpperCase().match(/^([A-ZÀ-Ỵ0-9_]+)\b/);
  return m ? m[1] : '';
}

function detectGroup(name) {
  const p = prefix(name);
  if (!p) return 'B';
  if (state.settings.moneyPrefixes.includes(p)) return 'A';
  if (state.settings.opsPrefixes.includes(p)) return 'C';
  return 'B';
}

function groupName(g) {
  return g === 'A' ? 'A - Tạo tiền' : g === 'B' ? 'B - Xây tài sản' : 'C - Vận hành';
}

function badge(g) {
  return g === 'A' ? 'badge-a' : g === 'B' ? 'badge-b' : 'badge-c';
}

function taskClass(g) {
  return g === 'A' ? 'task-a' : g === 'B' ? 'task-b' : 'task-c';
}

function stat(s) {
  const end = endSafe(s.endTime);
  const total = mins(s.startTime, end);
  const distract = (s.distractions || []).reduce((a, d) => a + Number(d.minutes || 0), 0);
  return { total, distract, work: Math.max(0, total - distract) };
}

function sessionToRow(session) {
  const x = stat(session);
  return {
    local_id: session.localId || session.id,
    user_id: USER_ID,
    work_date: session.date,
    task_name: session.name,
    task_group: session.group || detectGroup(session.name),
    energy: Number(session.energy || 0),
    start_time: new Date(session.startTime).toISOString(),
    end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
    work_minutes: x.work,
    distraction_minutes: x.distract,
    distraction_data: session.distractions || [],
    result: session.result || '',
    value_level: session.valueLevel || ''
  };
}

function rowToSession(row) {
  const localId = row.local_id || row.id;
  return {
    id: localId,
    localId,
    supabaseId: row.id,
    date: row.work_date,
    name: row.task_name || '',
    group: row.task_group || detectGroup(row.task_name || ''),
    energy: String(row.energy || 4),
    startTime: row.start_time ? new Date(row.start_time).getTime() : Date.now(),
    endTime: row.end_time ? new Date(row.end_time).getTime() : null,
    result: row.result || '',
    valueLevel: row.value_level || '',
    distractions: Array.isArray(row.distraction_data) ? row.distraction_data : []
  };
}

async function loadRemoteSessions() {
  setSyncStatus('syncing');
  try {
    const rows = await supabaseRequest(`sessions?user_id=eq.${encodeURIComponent(USER_ID)}&select=*&order=start_time.asc`);
    const remoteSessions = rows.map(rowToSession);
    state.sessions = remoteSessions.filter(s => s.endTime);
    state.active = remoteSessions.find(s => !s.endTime) || null;
    save();
    renderAll();
    setSyncStatus('synced');
  } catch (error) {
    console.error('Supabase load failed:', error);
    setSyncStatus('error');
  }
}

async function insertRemoteSession(session) {
  setSyncStatus('syncing');
  try {
    const rows = await supabaseRequest('sessions', {
      method: 'POST',
      body: JSON.stringify(sessionToRow(session))
    });
    if (rows?.[0]) {
      session.supabaseId = rows[0].id;
      session.localId = rows[0].local_id || session.localId || session.id;
    }
    save();
    setSyncStatus('synced');
  } catch (error) {
    console.error('Supabase insert failed:', error);
    setSyncStatus('error');
  }
}

async function updateRemoteSession(session) {
  setSyncStatus('syncing');
  try {
    const filter = session.supabaseId
      ? `id=eq.${encodeURIComponent(session.supabaseId)}`
      : `local_id=eq.${encodeURIComponent(session.localId || session.id)}&user_id=eq.${encodeURIComponent(USER_ID)}`;
    await supabaseRequest(`sessions?${filter}`, {
      method: 'PATCH',
      body: JSON.stringify(sessionToRow(session))
    });
    setSyncStatus('synced');
  } catch (error) {
    console.error('Supabase update failed:', error);
    setSyncStatus('error');
  }
}

function aggregate(list) {
  let total = 0;
  let distract = 0;
  let work = 0;
  list.forEach(s => {
    const x = stat(s);
    total += x.total;
    distract += x.distract;
    work += x.work;
  });
  return { total, distract, work, score: total ? Math.round(work / total * 100) : 0 };
}

function todaySessions() {
  return state.sessions.filter(s => s.date === dateKey());
}

function metrics(id, items) {
  document.getElementById(id).innerHTML = items.map(i => `<div class="metric-card"><p>${i.label}</p><strong>${i.value}</strong></div>`).join('');
}

function allocation(list) {
  const work = { A: 0, B: 0, C: 0 };
  list.forEach(s => {
    const g = s.group || detectGroup(s.name);
    work[g] += stat(s).work;
  });
  const total = work.A + work.B + work.C;
  return { A: total ? Math.round(work.A / total * 100) : 0, B: total ? Math.round(work.B / total * 100) : 0, C: total ? Math.round(work.C / total * 100) : 0, work, total };
}

function renderAllocation(id, list) {
  const a = allocation(list);
  document.getElementById(id).innerHTML = `<div class="allocation-grid"><div class="allocation-card allocation-a"><span>Tạo tiền</span>${a.A}%</div><div class="allocation-card allocation-b"><span>Xây tài sản</span>${a.B}%</div><div class="allocation-card allocation-c"><span>Vận hành</span>${a.C}%</div></div>`;
}

function renderToday() {
  document.getElementById('todayDate').textContent = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  document.getElementById('prefixHelp').innerHTML = `<strong>Tự phân loại bằng tiền tố:</strong> ${state.settings.moneyPrefixes.join(' / ')} = Tạo tiền · ${state.settings.opsPrefixes.join(' / ')} = Vận hành. Không nhập hoặc không khớp thì mặc định Xây tài sản.`;
  const list = todaySessions();
  const all = list.concat(state.active ? [state.active] : []);
  const a = aggregate(all);
  metrics('todayMetrics', [
    { label: 'Tổng giờ làm', value: minText(a.work) },
    { label: 'Xao nhãng', value: minText(a.distract) },
    { label: 'Focus score', value: `${a.score}%` },
    { label: 'Block hoàn thành', value: list.length }
  ]);
  renderAllocation('todayAllocation', all);
  renderActive();
  renderTable('todayTable', list, true);
  renderInsight();
  fillReview();
}

function renderActive() {
  const el = document.getElementById('activeTaskCard');
  if (!state.active) {
    el.classList.remove('active-task');
    el.innerHTML = '<h2>Chưa có block đang chạy</h2><p class="hint">Nhập công việc và bấm <strong>Bắt đầu</strong>.</p>';
    return;
  }
  el.classList.add('active-task');
  const x = stat(state.active);
  const g = state.active.group;
  el.innerHTML = `<h2>Đang làm: <span class="task-label ${taskClass(g)}">${esc(state.active.name)}</span></h2><p class="hint">Bắt đầu lúc ${timeText(state.active.startTime)} · ${groupName(g)} · Năng lượng: ${state.active.energy}/5</p><div class="timer">${minText(x.total)}</div><p class="hint">Làm thật: <strong>${minText(x.work)}</strong> · Xao nhãng: <strong>${minText(x.distract)}</strong></p><div class="btn-row"><button class="btn btn-muted" onclick="quickBreak(5)">Nghỉ 5p</button><button class="btn btn-muted" onclick="quickBreak(15)">Nghỉ 15p</button><button class="btn btn-danger" onclick="openDistract()">Xao nhãng</button><button class="btn btn-success" onclick="openEndModal()">Kết thúc việc</button></div>`;
}

function renderTable(id, list, isToday) {
  if (!list.length) {
    document.getElementById(id).innerHTML = `<div class="empty">${isToday ? 'Hôm nay chưa có log nào.' : 'Chưa có dữ liệu log.'}</div>`;
    return;
  }
  document.getElementById(id).innerHTML = `<table><thead><tr><th>Ngày</th><th>Bắt đầu</th><th>Kết thúc</th><th>Công việc</th><th>Nhóm</th><th>Làm thật</th><th>Xao nhãng</th><th>Nguyên nhân</th><th>Giá trị</th><th>Kết quả</th></tr></thead><tbody>${list.map(s => {
    const x = stat(s);
    const g = s.group || detectGroup(s.name);
    const reasons = (s.distractions || []).map(d => `${esc(d.reason)} (${d.minutes}p)`).join('<br>') || '-';
    return `<tr><td>${s.date}</td><td>${timeText(s.startTime)}</td><td>${s.endTime ? timeText(s.endTime) : '-'}</td><td><span class="task-label ${taskClass(g)}">${esc(s.name)}</span></td><td><span class="badge ${badge(g)}">${g}</span></td><td>${minText(x.work)}</td><td>${minText(x.distract)}</td><td>${reasons}</td><td>${esc(s.valueLevel || '-')}</td><td>${esc(s.result || '')}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function renderInsight() {
  document.getElementById('todayInsights').innerHTML = '<p><strong>Gợi ý:</strong> Dùng nút nghỉ nhanh khi nghỉ chủ động để không lẫn với xao nhãng.</p><p><strong>Cuối block:</strong> Ghi ngắn kết quả và chọn mức giá trị để sau này nhìn ra việc nào đáng ưu tiên.</p>';
}

function countReasons(list) {
  const r = {};
  list.forEach(s => (s.distractions || []).forEach(d => r[d.reason] = (r[d.reason] || 0) + 1));
  return r;
}

function sumGroups(list) {
  const groups = {};
  list.forEach(s => {
    const label = groupName(s.group || detectGroup(s.name));
    groups[label] = (groups[label] || 0) + stat(s).work;
  });
  return groups;
}

function bar(id, data, suffix, divisor = 1) {
  const e = Object.entries(data).sort((a, b) => b[1] - a[1]);
  if (!e.length) {
    document.getElementById(id).innerHTML = '<div class="empty">Chưa đủ dữ liệu.</div>';
    return;
  }
  const max = Math.max(...e.map(x => x[1]), 1);
  document.getElementById(id).innerHTML = e.map(([label, value]) => `<div class="bar-item"><div class="bar-label"><span>${esc(label)}</span><span>${divisor === 60 ? (value / 60).toFixed(1).replace('.0', '') : value} ${suffix}</span></div><div class="bar-bg"><div class="bar-fill" style="width:${Math.max(8, value / max * 100)}%"></div></div></div>`).join('');
}

function sessionsInRange() {
  let list = [...state.sessions];
  if (dashboardFilter.mode === 'last7') {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const s = dateKey(start);
    const e = dateKey(end);
    filterStart.value = s;
    filterEnd.value = e;
    return list.filter(x => x.date >= s && x.date <= e);
  }
  if (dashboardFilter.mode === 'range') {
    const s = filterStart.value;
    const e = filterEnd.value;
    if (s) list = list.filter(x => x.date >= s);
    if (e) list = list.filter(x => x.date <= e);
    return list;
  }
  filterStart.value = '';
  filterEnd.value = '';
  return list;
}

function renderDashboard() {
  const list = sessionsInRange();
  const a = aggregate(list);
  metrics('dashboardMetrics', [
    { label: 'Tổng giờ làm', value: minText(a.work) },
    { label: 'Tổng xao nhãng', value: minText(a.distract) },
    { label: 'Focus score', value: `${a.score}%` },
    { label: 'Tổng block', value: list.length }
  ]);
  renderAllocation('dashboardAllocation', list);
  bar('groupChart', sumGroups(list), 'giờ', 60);
  bar('reasonChart', countReasons(list), 'lần');
  const alloc = allocation(list);
  document.getElementById('dashboardInsights').innerHTML = list.length ? `<p><strong>Khoảng lọc hiện tại:</strong> ${filterStart.value || 'đầu'} → ${filterEnd.value || 'nay'}.</p><p><strong>Nhóm chiếm nhiều nhất:</strong> ${alloc.A >= alloc.B && alloc.A >= alloc.C ? 'Tạo tiền' : alloc.B >= alloc.C ? 'Xây tài sản' : 'Vận hành'}.</p>` : '<p><strong>Chưa có dữ liệu</strong> trong khoảng ngày này.</p>';
}

function applyDashboardRange(e) {
  e.preventDefault();
  dashboardFilter = { mode: 'range', start: filterStart.value, end: filterEnd.value };
  renderDashboard();
}

function setLast7() {
  dashboardFilter = { mode: 'last7', start: '', end: '' };
  renderDashboard();
}

function setAllTime() {
  dashboardFilter = { mode: 'all', start: '', end: '' };
  renderDashboard();
}

function historySuggestions() {
  return [...new Set(state.sessions.map(s => s.name).filter(Boolean))].slice(-80).reverse();
}

function setupAutocomplete() {
  const input = document.getElementById('taskName');
  const datalist = document.getElementById('taskSuggestions');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    datalist.innerHTML = historySuggestions().filter(x => x.toLowerCase().includes(q)).slice(0, 10).map(x => `<option value="${esc(x)}"></option>`).join('');
  });
}

async function startSession(e) {
  e.preventDefault();
  if (state.active && !confirm('Đang có một block chạy. Kết thúc block cũ và bắt đầu block mới?')) return;
  if (state.active) await finishSession('Tự kết thúc khi bắt đầu block mới', 'Trung bình');
  const name = document.getElementById('taskName').value.trim();
  const localId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  state.active = {
    id: localId,
    localId,
    date: dateKey(),
    name,
    group: detectGroup(name),
    energy: document.getElementById('energy').value,
    startTime: Date.now(),
    endTime: null,
    result: '',
    valueLevel: '',
    distractions: []
  };
  document.getElementById('startForm').reset();
  save();
  renderAll();
  await insertRemoteSession(state.active);
  renderAll();
}

async function finishSession(result = '', value = 'Trung bình') {
  if (!state.active) return;
  const finished = state.active;
  finished.endTime = Date.now();
  finished.result = result || '';
  finished.valueLevel = value || 'Trung bình';
  state.sessions.push(finished);
  state.active = null;
  save();
  renderAll();
  await updateRemoteSession(finished);
}

function openEndModal() {
  if (!state.active) return;
  endResult.value = '';
  valueLevel.value = 'Trung bình';
  document.getElementById('endModal').classList.add('open');
  endResult.focus();
}

function closeEndModal() {
  document.getElementById('endModal').classList.remove('open');
  document.getElementById('endForm').reset();
}

async function submitEnd(e) {
  e.preventDefault();
  await finishSession(endResult.value.trim(), valueLevel.value);
  closeEndModal();
  renderAll();
}

function endSession() {
  openEndModal();
}

function quickBreak(m) {
  if (!state.active) return;
  state.active.distractions.push({ reason: `Break ${m}p`, minutes: m, note: 'Nghỉ chủ động', time: Date.now() });
  save();
  renderAll();
}

function openDistract() {
  document.getElementById('distractModal').classList.add('open');
}

function closeDistract() {
  document.getElementById('distractModal').classList.remove('open');
  document.getElementById('distractForm').reset();
}

function saveDistraction(e) {
  e.preventDefault();
  if (!state.active) return;
  state.active.distractions.push({
    reason: document.getElementById('distractReason').value,
    minutes: Number(document.getElementById('distractMinutes').value || 0),
    note: document.getElementById('distractNote').value.trim(),
    time: Date.now()
  });
  save();
  closeDistract();
  renderAll();
}

function fillReview() {
  const r = state.reviews[dateKey()] || {};
  bestWork.value = r.bestWork || '';
  wasteTime.value = r.wasteTime || '';
  satisfaction.value = r.satisfaction || '8';
}

function saveReview(e) {
  e.preventDefault();
  state.reviews[dateKey()] = { bestWork: bestWork.value.trim(), wasteTime: wasteTime.value.trim(), satisfaction: satisfaction.value };
  save();
  alert('Đã lưu review hôm nay.');
}

function fillSettings() {
  moneyPrefixes.value = state.settings.moneyPrefixes.join('\n');
  opsPrefixes.value = state.settings.opsPrefixes.join('\n');
}

function savePrefixes(e) {
  e.preventDefault();
  state.settings.moneyPrefixes = cleanPrefixes(moneyPrefixes.value);
  state.settings.opsPrefixes = cleanPrefixes(opsPrefixes.value);
  state.sessions.forEach(s => s.group = detectGroup(s.name));
  if (state.active) state.active.group = detectGroup(state.active.name);
  save();
  renderAll();
  fillSettings();
  alert('Đã lưu quy tắc phân loại.');
}

function resetPrefixes() {
  state.settings = structuredClone(DEFAULT_SETTINGS);
  state.sessions.forEach(s => s.group = detectGroup(s.name));
  if (state.active) state.active.group = detectGroup(state.active.name);
  save();
  renderAll();
  fillSettings();
}

function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (page === 'log') renderTable('allLogTable', [...state.sessions].reverse(), false);
  if (page === 'dashboard') renderDashboard();
  if (page === 'settings') fillSettings();
  if (page === 'today') renderToday();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `focus-tracker-${dateKey()}.json`);
}

function csvCell(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = [['date', 'start', 'end', 'task', 'group', 'energy', 'work_minutes', 'distraction_minutes', 'reasons', 'value_level', 'result']];
  state.sessions.forEach(s => {
    const x = stat(s);
    const g = s.group || detectGroup(s.name);
    rows.push([s.date, timeText(s.startTime), s.endTime ? timeText(s.endTime) : '', s.name, groupName(g), s.energy, x.work, x.distract, (s.distractions || []).map(d => `${d.reason} (${d.minutes}p)`).join('; '), s.valueLevel || '', s.result || '']);
  });
  const csv = '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `focus-tracker-${dateKey()}.csv`);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function clearData() {
  if (!confirm('Xóa toàn bộ dữ liệu trên trình duyệt này?')) return;
  [KEY, ...OLD].forEach(k => localStorage.removeItem(k));
  state = fallbackState();
  save();
  renderAll();
  fillSettings();
}

function renderAll() {
  renderToday();
  renderTable('allLogTable', [...state.sessions].reverse(), false);
  renderDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchPage(btn.dataset.page)));
  startForm.addEventListener('submit', startSession);
  distractForm.addEventListener('submit', saveDistraction);
  closeModalBtn.addEventListener('click', closeDistract);
  reviewForm.addEventListener('submit', saveReview);
  prefixForm.addEventListener('submit', savePrefixes);
  resetPrefixBtn.addEventListener('click', resetPrefixes);
  exportBtn.addEventListener('click', exportData);
  exportCsvBtn.addEventListener('click', exportCsv);
  clearBtn.addEventListener('click', clearData);
  dashboardFilterForm.addEventListener('submit', applyDashboardRange);
  last7Btn.addEventListener('click', setLast7);
  allTimeBtn.addEventListener('click', setAllTime);
  endForm.addEventListener('submit', submitEnd);
  cancelEndBtn.addEventListener('click', closeEndModal);
  setupAutocomplete();
  renderAll();
  fillSettings();
  loadRemoteSessions();
  setInterval(() => {
    if (state.active && currentPage === 'today') renderToday();
  }, 10000);
});
