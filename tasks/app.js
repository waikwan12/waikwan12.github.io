(() => {
  'use strict';
  const G = window.Growth;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const palette = { study: ['#a18bb8', '#f3edf8', '#a087b7'], research: ['#a18fbd', '#f0ecf7', '#9d88b3'], life: ['#93a787', '#eef3ea', '#8e9f82'], work: ['#ba9d82', '#f6f0e8', '#b2987f'] };
  const projectStyle = p => { const [color, bg, fg] = palette[p?.category] || palette.study; return `--project-color:${color};--tag-bg:${bg};--tag-fg:${fg}`; };
  const names = { overview: ['成长总览', '让进步，有迹可循', '把远方的目标，拆成今天可以完成的一小步。'], tasks: ['全部任务', '把今天，过得具体一点', '课程、论文与生活，每个小任务都有自己的位置。'], goals: ['阶段目标', '每个目标，都有下一步', '点亮一个个里程碑，让积累成为看得见的成长。'], history: ['成长记录', '你走过的路，都算数', '回看真实的行动，也给努力过的自己一点肯定。'] };
  let state, demo = false, blockedStorage = false, filter = 'all', category = 'all', view = 'overview', selectedDay = '', openProject = '', confirmAction = null, currentDay = G.today(), toastTimer;
  function warning(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = false; }
  function load() {
    try { const raw = localStorage.getItem(G.KEY); return raw ? G.validate(JSON.parse(raw)) : G.createDefault(currentDay); }
    catch (_) { blockedStorage = true; warning('本地记录无法读取，已进入临时模式以保护原数据。此时修改不会覆盖原记录，请先保留原备份，或导出当前临时记录。'); return G.createDefault(currentDay); }
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    if (demo) return;
    if (blockedStorage) { $('save-status').innerHTML = '<i></i>临时模式 · 请导出'; return; }
    try { localStorage.setItem(G.KEY, JSON.stringify(state)); $('save-status').innerHTML = '<i></i>已保存在本机'; $('storage-warning').hidden = true; }
    catch (_) { $('save-status').innerHTML = '<i></i>暂未保存'; warning('浏览器未能保存记录，可能是空间不足或存储被限制。请立即导出备份，刷新可能丢失本次修改。'); }
  }
  function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('visible'); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }
  function celebrate() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#b39bc9', '#a9ba99', '#d6bfa4', '#d6c5e8'];
    for (let i = 0; i < 18; i++) { const el = document.createElement('i'); el.className = 'confetti-piece'; el.style.background = colors[i % 4]; el.style.setProperty('--x', `${Math.sin(i * 2.4) * (80 + i * 5)}px`); el.style.setProperty('--y', `${50 + i * 8}px`); el.style.setProperty('--r', `${i * 45}deg`); $('confetti').append(el); el.addEventListener('animationend', () => el.remove(), { once: true }); }
  }
  function commit(message, success = false) { persist(); render(); if (message) toast(message); if (success) celebrate(); }
  function setView(next) {
    if (!names[next]) return;
    view = next; filter = 'all'; $('task-search').value = '';
    document.body.className = `view-${next}`;
    document.querySelectorAll('.nav-item').forEach(btn => { const active = btn.dataset.view === next; btn.classList.toggle('active', active); if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current'); });
    $('view-label').textContent = names[next][0]; $('page-title').innerHTML = `${names[next][1]}<span class="heading-dot">.</span>`; $('page-subtitle').textContent = names[next][2];
    $('overview-hero').hidden = next !== 'overview';
    document.querySelector('.stats-grid').hidden = next === 'goals';
    $('task-area').hidden = !['overview', 'tasks'].includes(next);
    $('goal-area').hidden = !['overview', 'goals'].includes(next);
    $('history-area').hidden = !['overview', 'history'].includes(next);
    render(); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function renderTasks() {
    const query = $('task-search').value.trim().toLocaleLowerCase();
    const all = state.tasks.filter(t => view === 'tasks' || t.date === currentDay);
    const list = all.filter(t => (filter === 'all' || t.done === (filter === 'done')) && t.title.toLocaleLowerCase().includes(query)).sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
    $('task-heading').firstChild.textContent = view === 'tasks' ? '每个小任务，都算数 ' : '今天，先做这些 ';
    $('task-count').textContent = `${all.filter(t => t.done).length}/${all.length}`;
    document.querySelectorAll('[data-filter]').forEach(btn => btn.classList.toggle('selected', btn.dataset.filter === filter));
    $('task-list').innerHTML = list.length ? list.map(t => {
      const p = state.projects.find(p => p.id === t.projectId);
      return `<article class="task-row ${t.done ? 'done' : ''}"><button class="check-button ${t.done ? 'checked' : ''}" data-task-toggle="${esc(t.id)}" role="checkbox" aria-checked="${t.done}" aria-label="${esc((t.done ? '撤销完成：' : '完成：') + t.title)}"></button><div class="task-content"><div class="task-title">${esc(t.title)}</div><div class="task-meta"><span class="task-badge" style="${projectStyle(p)}">${esc(p?.name || '日常任务')}</span>${t.minutes ? `<span class="task-duration">${icon('clock')}${t.minutes} 分钟</span>` : ''}${view === 'tasks' ? `<span>${esc(t.date)}${t.date < currentDay && !t.done ? ' · 待继续' : ''}</span>` : ''}${t.milestoneId ? '<span>关联里程碑</span>' : ''}</div></div><div class="row-actions"><button class="icon-button" data-task-edit="${esc(t.id)}" aria-label="编辑任务：${esc(t.title)}">${icon('edit')}</button><button class="icon-button" data-task-delete="${esc(t.id)}" aria-label="删除任务：${esc(t.title)}">${icon('trash')}</button></div></article>`;
    }).join('') : `<div class="empty-state">${icon('leaf')}${query ? '没有找到匹配的任务。' : filter === 'done' ? '还没有完成记录，下一步从这里开始。' : filter === 'pending' ? '这里的任务都完成了，给自己一点休息。' : '今天还没有安排任务，添加一个小目标吧。'}</div>`;
    $('nav-task-count').textContent = state.tasks.filter(t => !t.done).length;
  }
  function renderGoals() {
    const list = state.projects.filter(p => category === 'all' || p.category === category);
    $('goal-grid').innerHTML = list.length ? list.map(p => {
      const count = p.milestones.filter(m => m.done).length, total = p.milestones.length, percent = total ? Math.round(count / total * 100) : 0;
      return `<article class="goal-card" style="${projectStyle(p)}"><div class="goal-card-top"><span class="goal-icon">${icon(p.category === 'study' ? 'book' : p.category === 'research' ? 'spark' : p.category === 'life' ? 'leaf' : 'checklist')}</span><h3>${esc(p.name)}</h3><div class="goal-menu"><button class="icon-button" data-goal-edit="${esc(p.id)}" aria-label="编辑目标：${esc(p.name)}">${icon('edit')}</button><button class="icon-button" data-goal-delete="${esc(p.id)}" aria-label="删除目标：${esc(p.name)}">${icon('trash')}</button></div></div><p class="goal-baseline">${esc(p.baseline || '从一个小步骤开始')}</p><p class="goal-description">${esc(p.description || '给目标留下一项可检查的成果。')}</p><div class="goal-progress-label"><span>${count} / ${total} 个里程碑</span><b>${percent}%</b></div><div class="progress-track" role="progressbar" aria-label="${esc(p.name)}完成进度" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent}%"></i></div><div class="goal-bottom"><span>${p.deadline ? `目标 ${esc(p.deadline)}` : esc(G.categories[p.category])}</span><button class="text-button" data-project="${esc(p.id)}">查看里程碑 ${icon('arrow')}</button></div></article>`;
    }).join('') : '<div class="empty-state">这个分类还没有目标，可以新建一个。</div>';
    document.querySelectorAll('[data-category]').forEach(btn => btn.classList.toggle('selected', category === btn.dataset.category));
    $('sidebar-projects').innerHTML = state.projects.slice(0, 7).map(p => `<button class="project-link" data-project="${esc(p.id)}" style="${projectStyle(p)}"><i class="project-dot"></i>${esc(p.name)}</button>`).join('');
  }
  function renderHistory(stats) {
    const start = G.weekStart(currentDay);
    const days = Array.from({ length: 7 }, (_, i) => G.shift(start, i));
    const maximum = Math.max(4, ...days.map(d => stats.counts[d] || 0));
    $('week-chart').innerHTML = days.map((day, i) => `<div class="week-column ${day === currentDay ? 'current' : day > currentDay ? 'future' : ''}" title="${day}：${stats.counts[day] || 0} 项完成"><div class="week-bar" style="height:${Math.max(4, (stats.counts[day] || 0) / maximum * 80)}px"></div><span>${['一', '二', '三', '四', '五', '六', '日'][i]}</span></div>`).join('');
    $('week-total').textContent = `${stats.week} 项`;
    const first = G.shift(start, -77);
    $('heatmap').innerHTML = Array.from({ length: 84 }, (_, i) => {
      const day = G.shift(first, i), count = stats.counts[day] || 0;
      return `<button class="heat-cell ${selectedDay === day ? 'selected' : ''}" data-day="${day}" data-level="${Math.min(4, count)}" title="${day}：${count} 次行动" aria-label="${day}，${count} 次行动" ${day > currentDay ? 'disabled' : ''}></button>`;
    }).join('');
    $('activity-total').textContent = `累计 ${stats.all} 次行动`;
    if (selectedDay || view === 'history') {
      const chosen = selectedDay || currentDay;
      const events = G.activeEvents(state).filter(e => e.date === chosen).slice().reverse();
      $('history-selection').textContent = `${chosen} · ${events.length} 次行动`;
      $('history-log').hidden = false;
      $('history-log').innerHTML = events.length ? events.map(e => `<div class="log-row">${icon('spark')}<span>${esc(e.title)}</span><small>${e.kind === 'milestone' ? '里程碑' : '任务'}</small></div>`).join('') : '<div class="empty-state">这一天还没有记录。休息也是生活的一部分。</div>';
    } else { $('history-log').hidden = true; $('history-selection').textContent = stats.all ? '每一个小格，都来自一次真实的完成。' : '点亮第一格，从一个小任务开始。'; }
  }
  function renderMilestones() {
    const p = state.projects.find(p => p.id === openProject); if (!p) return;
    $('milestone-title').textContent = p.name; $('milestone-baseline').textContent = p.baseline;
    const count = p.milestones.filter(m => m.done).length, percent = p.milestones.length ? Math.round(100 * count / p.milestones.length) : 0;
    $('milestone-progress').innerHTML = `<div class="goal-progress-label"><span>${count} / ${p.milestones.length} 个里程碑</span><b>${percent}%</b></div><div class="progress-track" role="progressbar" aria-label="当前目标进度" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent}%"></i></div>`;
    $('milestone-list').innerHTML = p.milestones.map(m => `<div class="milestone-row ${m.done ? 'done' : ''}"><button class="check-button ${m.done ? 'checked' : ''}" role="checkbox" aria-checked="${m.done}" data-milestone-toggle="${esc(m.id)}" aria-label="${esc((m.done ? '撤销：' : '完成：') + m.title)}"></button><span>${esc(m.title)}</span><button class="icon-button" data-milestone-edit="${esc(m.id)}" aria-label="编辑里程碑：${esc(m.title)}">${icon('edit')}</button><button class="icon-button" data-milestone-delete="${esc(m.id)}" aria-label="删除里程碑：${esc(m.title)}">${icon('trash')}</button></div>`).join('') || '<div class="empty-state">还没有里程碑，先添加一个可以检查的小步骤。</div>';
  }
  function render() {
    const stats = G.summary(state, currentDay), tasks = state.tasks.filter(t => t.date === currentDay), done = tasks.filter(t => t.done).length;
    $('stat-percent').textContent = stats.percent; $('stat-progress').style.width = `${stats.percent}%`; $('stat-milestones').textContent = `${stats.complete} / ${stats.total} 个已完成`;
    $('stat-today').textContent = done; $('stat-today-total').textContent = `/ ${tasks.length}`;
    $('stat-today-copy').textContent = tasks.length && done === tasks.length ? '今天的安排完成了，记得休息' : '每完成一件，就向前一点';
    $('stat-streak').textContent = stats.streak; $('stat-week').textContent = stats.week;
    $('date-day').textContent = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', timeZone: 'Asia/Shanghai' }).format(new Date(`${currentDay}T12:00:00+08:00`));
    $('date-full').textContent = currentDay.replaceAll('-', ' . ');
    $('demo-banner').hidden = !demo; $('demo-btn').textContent = demo ? '退出演示数据' : '体验演示数据';
    if (demo) $('save-status').innerHTML = '<i></i>演示模式';
    renderTasks(); renderGoals(); renderHistory(stats);
    if ($('milestone-dialog').open) renderMilestones();
  }
  function fillMilestones(projectId, selected = '') {
    const p = state.projects.find(p => p.id === projectId);
    $('task-milestone').innerHTML = '<option value="">仅记录日常任务</option>' + (p ? p.milestones.map(m => `<option value="${esc(m.id)}">${m.done ? '✓ ' : ''}${esc(m.title)}</option>`).join('') : '');
    $('task-milestone').value = selected;
  }
  function openTask(id = '') {
    const t = state.tasks.find(t => t.id === id), form = $('task-form'); form.reset();
    $('task-dialog-title').textContent = t ? '编辑这个小任务' : '添加一个小任务';
    $('task-project').innerHTML = '<option value="">日常任务</option>' + state.projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    form.elements.id.value = t?.id || ''; form.elements.title.value = t?.title || ''; form.elements.projectId.value = t?.projectId || ''; form.elements.date.value = t?.date || currentDay; form.elements.minutes.value = t?.minutes ?? 25;
    fillMilestones(t?.projectId || '', t?.milestoneId || ''); $('task-dialog').showModal();
  }
  function openGoal(id = '') {
    const p = state.projects.find(p => p.id === id), form = $('goal-form'); form.reset();
    $('goal-dialog-title').textContent = p ? '编辑阶段目标' : '新建阶段目标';
    ['id', 'name', 'category', 'baseline', 'description', 'deadline'].forEach(key => { form.elements[key].value = p?.[key] || (key === 'category' ? 'study' : ''); });
    $('new-milestones-label').hidden = Boolean(p); $('goal-dialog').showModal();
  }
  function openMilestones(id) { if (!state.projects.some(p => p.id === id)) return; openProject = id; renderMilestones(); $('milestone-dialog').showModal(); }
  function confirm(title, copy, action) { $('confirm-title').textContent = title; $('confirm-copy').textContent = copy; confirmAction = action; $('confirm-dialog').showModal(); }
  function downloadBackup() {
    const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.href = url; a.download = `growth-journal-${demo ? 'demo-' : ''}${currentDay}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-close')) { b.closest('dialog').close(); return; }
    if (b.dataset.view) { setView(b.dataset.view); return; }
    if (b.dataset.action === 'new-task') { openTask(); return; }
    if (b.dataset.action === 'copy-day') {
      const dates = state.tasks.map(t => t.date).filter(d => d < currentDay).sort();
      const last = dates.at(-1);
      if (!last) { toast('还没有此前的安排，先添加今天的任务即可'); return; }
      const source = state.tasks.filter(t => t.date === last && !state.tasks.some(other => other.date === currentDay && other.title === t.title && other.projectId === t.projectId));
      if (!source.length) { toast('今天已有相同安排，无需重复添加'); return; }
      if (state.tasks.length + source.length > 2000) { toast('任务已达到上限，请先整理列表'); return; }
      confirm('沿用最近一次安排？', `将 ${last} 的 ${source.length} 个任务复制到今天，全部从未完成开始。已完成的阶段关联将取消，原记录保留。`, () => {
        source.forEach(t => { const m = state.projects.find(p => p.id === t.projectId)?.milestones.find(m => m.id === t.milestoneId); state.tasks.push({ ...t, id: G.uid(), date: currentDay, done: false, completedAt: '', milestoneId: m?.done ? '' : t.milestoneId }); });
        commit('今天的安排已生成，开始新的小步骤');
      }); return;
    }
    if (b.dataset.action === 'new-goal') { openGoal(); return; }
    if (b.dataset.filter) { filter = b.dataset.filter; renderTasks(); return; }
    if (b.dataset.category) { category = b.dataset.category; renderGoals(); return; }
    if (b.dataset.project) { openMilestones(b.dataset.project); return; }
    if (b.dataset.taskToggle) {
      const t = state.tasks.find(t => t.id === b.dataset.taskToggle); if (!t) return;
      const done = !t.done; G.setTask(state, t.id, done, currentDay); commit(done ? (t.milestoneId ? '任务与关联里程碑已点亮，进步 +1' : '完成一小步，今天的记录 +1') : '已撤销完成，记录同步更新', done); return;
    }
    if (b.dataset.taskEdit) { openTask(b.dataset.taskEdit); return; }
    if (b.dataset.taskDelete) { const t = state.tasks.find(t => t.id === b.dataset.taskDelete); if (!t) return; confirm('删除这个任务？', `“${t.title}”将从列表移除。已有完成记录和关联里程碑会保留。`, () => { state.tasks = state.tasks.filter(item => item.id !== t.id); commit('任务已移除'); }); return; }
    if (b.dataset.goalEdit) { openGoal(b.dataset.goalEdit); return; }
    if (b.dataset.goalDelete) { const p = state.projects.find(p => p.id === b.dataset.goalDelete); if (!p) return; confirm('删除这个阶段目标？', `“${p.name}”及其里程碑会移除，所属日常任务会保留并取消关联。完成历史仍保留。`, () => { state.projects = state.projects.filter(item => item.id !== p.id); state.tasks.filter(t => t.projectId === p.id).forEach(t => { t.projectId = ''; t.milestoneId = ''; }); commit('目标已移除，完成历史已保留'); }); return; }
    if (b.dataset.milestoneToggle) { const p = state.projects.find(p => p.id === openProject), m = p?.milestones.find(m => m.id === b.dataset.milestoneToggle); if (!m) return; const done = !m.done; G.setMilestone(state, p.id, m.id, done, currentDay); commit(done ? '一个里程碑被点亮了，继续慢慢向前' : '已撤销里程碑完成', done); return; }
    if (b.dataset.milestoneEdit) {
      const p = state.projects.find(p => p.id === openProject), m = p?.milestones.find(m => m.id === b.dataset.milestoneEdit); if (!m) return;
      const value = window.prompt('修改里程碑标题（最多 300 字）', m.title); if (value === null) return;
      if (!value.trim() || value.trim().length > 300) { toast('请填写 1—300 字的里程碑名称'); return; } m.title = value.trim(); commit('里程碑名称已更新'); return;
    }
    if (b.dataset.milestoneDelete) { const p = state.projects.find(p => p.id === openProject), m = p?.milestones.find(m => m.id === b.dataset.milestoneDelete); if (!m) return; confirm('移除这个里程碑？', '目标的计算分母会改变。已有完成历史保留，关联任务将转为普通任务。', () => { p.milestones = p.milestones.filter(item => item.id !== m.id); state.tasks.filter(t => t.milestoneId === m.id).forEach(t => { t.milestoneId = ''; }); commit('里程碑已移除'); }); return; }
    if (b.dataset.day) { selectedDay = b.dataset.day; renderHistory(G.summary(state, currentDay)); return; }
  });
  $('task-search').addEventListener('input', renderTasks);
  $('task-project').addEventListener('change', () => fillMilestones($('task-project').value));
  $('task-form').addEventListener('submit', e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), title = String(f.get('title')).trim(), date = f.get('date'), minutes = Number(f.get('minutes'));
    if (!title || !G.goodDate(date) || !Number.isInteger(minutes) || minutes < 0 || minutes > 1440) { toast('请填写有效的任务、日期和用时'); return; }
    const existing = state.tasks.find(t => t.id === f.get('id'));
    const projectId = f.get('projectId'), milestoneId = f.get('milestoneId');
    if (existing?.done && (existing.projectId !== projectId || existing.milestoneId !== milestoneId)) { toast('请先撤销完成，再更改任务的目标关联'); return; }
    const p = state.projects.find(p => p.id === projectId), m = p?.milestones.find(m => m.id === milestoneId);
    if (m?.done && !existing?.done) { toast('这个里程碑已经完成，请选择其他里程碑或仅记录日常任务'); return; }
    if (!existing && state.tasks.length >= 2000) { toast('任务已达到上限，请先整理列表'); return; }
    const task = { id: existing?.id || G.uid(), title, projectId, milestoneId, date, minutes, done: existing?.done || false, completedAt: existing?.completedAt || '' };
    if (existing) state.tasks[state.tasks.indexOf(existing)] = task; else state.tasks.push(task);
    $('task-dialog').close(); if (date !== currentDay && view === 'overview') setView('tasks'); commit(existing ? '任务已更新' : '新的小步骤，已安排好');
  });
  $('goal-form').addEventListener('submit', e => {
    e.preventDefault(); const f = new FormData(e.currentTarget), name = String(f.get('name')).trim(); if (!name) return;
    const existing = state.projects.find(p => p.id === f.get('id'));
    const deadline = f.get('deadline'); if (deadline && !G.goodDate(deadline)) { toast('请选择有效的日期'); return; }
    const lines = String(f.get('milestones') || '').split('\n').map(t => t.trim()).filter(Boolean);
    if (!existing && (state.projects.length >= 100 || lines.length > 100 || lines.some(t => t.length > 300))) { toast('目标过多，或里程碑过长，请缩减后保存'); return; }
    const p = { id: existing?.id || G.uid(), name, category: f.get('category'), baseline: String(f.get('baseline')).trim(), description: String(f.get('description')).trim(), deadline, milestones: existing?.milestones || lines.map(title => ({ id: G.uid(), title, done: false })) };
    if (existing) state.projects[state.projects.indexOf(existing)] = p; else state.projects.push(p);
    $('goal-dialog').close(); commit(existing ? '目标已更新' : '新的目标，已经种下');
  });
  $('milestone-form').addEventListener('submit', e => {
    e.preventDefault(); const p = state.projects.find(p => p.id === openProject); if (!p) return;
    const input = e.currentTarget.elements.title, title = input.value.trim(); if (!title) return;
    if (p.milestones.length >= 500) { toast('这个目标的里程碑已达到上限'); return; }
    p.milestones.push({ id: G.uid(), title, done: false }); input.value = ''; commit('新里程碑已添加');
  });
  $('confirm-accept').addEventListener('click', () => { const action = confirmAction; confirmAction = null; $('confirm-dialog').close(); action?.(); });
  $('confirm-dialog').addEventListener('close', () => { confirmAction = null; });
  $('export-btn').addEventListener('click', () => { downloadBackup(); toast('备份已导出，记得妥善保存'); });
  $('import-btn').addEventListener('click', () => { if (demo) { toast('请退出演示模式后再导入个人记录'); return; } $('import-file').click(); });
  $('import-file').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('备份文件超过 2 MB，无法导入'); return; }
    try {
      const imported = G.validate(JSON.parse(await file.text()));
      confirm('用备份恢复记录？', `将导入 ${imported.projects.length} 个目标、${imported.tasks.length} 个任务，替换当前记录。确认后会先导出当前看板的备份。`, () => { downloadBackup(); state = imported; blockedStorage = false; selectedDay = ''; commit('备份已恢复'); });
    } catch (err) { toast(`导入未执行：${err instanceof SyntaxError ? '文件不是有效 JSON' : err.message}`); }
  });
  function toggleDemo() {
    if (!demo) { demo = true; state = G.createDemo(currentDay); }
    else { demo = false; state = load(); if (!blockedStorage) $('save-status').innerHTML = '<i></i>已保存在本机'; }
    selectedDay = ''; document.querySelectorAll('dialog[open]').forEach(d => d.close()); render(); toast(demo ? '演示模式：不会改变你的个人数据' : '已回到你的真实记录');
  }
  $('demo-btn').addEventListener('click', toggleDemo); $('exit-demo').addEventListener('click', toggleDemo);
  $('about-btn').addEventListener('click', () => $('about-dialog').showModal());
  window.addEventListener('storage', e => {
    if (e.key !== G.KEY || demo) return;
    state = load(); document.querySelectorAll('dialog[open]').forEach(d => d.close()); render(); toast('另一标签页更新了记录，当前看板已同步');
  });
  setInterval(() => { const now = G.today(); if (now !== currentDay) { currentDay = now; render(); } }, 60000);
  state = load(); setView('overview');
  // No requests, analytics, external fonts or remote synchronization are used.
})();
