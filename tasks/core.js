(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Growth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const KEY = 'waikwan.growth-journal.v1';
  const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const shift = (date, days) => {
    const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
  };
  const weekStart = date => shift(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
  const goodDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  const categories = { study: '课程学习', research: '论文研究', life: '健康与语言', work: '工作与生活' };
  function project(id, name, category, baseline, description, titles, deadline = '2026-12-31') {
    return { id, name, category, baseline, description, deadline, milestones: titles.map((title, i) => ({ id: `${id}-m${i}`, title, done: false })) };
  }
  function createDefault(date = today()) {
    return {
      version: VERSION,
      projects: [
        project('course', '我的课程', 'study', '从当前章节开始，按自己的节奏推进', '这是可编辑的通用示例，可以改成你正在学习的课程。', ['明确本阶段学习范围', '完成一个主题的学习', '独立写出一道习题', '完成一次自测与订正'], ''),
        project('papers', '论文阅读', 'research', '从研究问题、核心定义与例子入手', '每次阅读，留下一项可以复现的成果。', ['建立论文结构卡', '验证一个定义的例子', '复现一段关键论证', '整理问题与下一步'], ''),
        project('fitness', '健康与体能', 'life', '记录适合自己的运动和恢复', '保持可持续的节奏，也给休息留出位置。', ['记录一周运动情况', '熟悉适合自己的动作', '回顾两周的训练与恢复', '调整下一阶段目标'], ''),
        project('english', '语言学习', 'life', '从每天一小段听读开始', '让语言学习成为可以持续的小习惯。', ['记录一周学习', '完成一次能力诊断', '积累一组常用表达', '确定下一阶段目标'], ''),
        project('work', '工作与生活', 'work', '把事情做具体，也把成果留下来', '把目标拆成可以完成、可以检查的步骤。', ['明确本阶段要做的事', '完成一个代表性成果', '回顾投入的时间', '确定下一个行动'], '')
      ],
      tasks: [
        { id: 'task-course', title: '课程学习：独立尝试一道精选题', projectId: 'course', milestoneId: '', date, minutes: 45, done: false, completedAt: '' },
        { id: 'task-paper', title: '论文阅读：读清一个定义，验证一个例子', projectId: 'papers', milestoneId: '', date, minutes: 45, done: false, completedAt: '' },
        { id: 'task-english', title: '语言学习：听读 15 分钟，记一句表达', projectId: 'english', milestoneId: '', date, minutes: 15, done: false, completedAt: '' }
      ],
      events: [], updatedAt: new Date().toISOString()
    };
  }
  function activeEvents(state) { return state.events.filter(e => e.active); }
  function record(state, kind, targetId, title, done, date) {
    state.events.forEach(e => { if (e.kind === kind && e.targetId === targetId && e.active) e.active = false; });
    if (done) state.events.push({ id: uid(), kind, targetId, title, date, active: true });
  }
  function setMilestone(state, projectId, milestoneId, done, date = today()) {
    const p = state.projects.find(p => p.id === projectId);
    const m = p?.milestones.find(m => m.id === milestoneId);
    if (!m || m.done === done) return false;
    m.done = done;
    state.tasks.filter(t => t.projectId === projectId && t.milestoneId === milestoneId).forEach(t => { t.done = done; t.completedAt = done ? date : ''; });
    record(state, 'milestone', milestoneId, `${p.name} · ${m.title}`, done, date);
    return true;
  }
  function setTask(state, id, done, date = today()) {
    const t = state.tasks.find(t => t.id === id);
    if (!t || t.done === done) return false;
    if (t.milestoneId) return setMilestone(state, t.projectId, t.milestoneId, done, date);
    t.done = done; t.completedAt = done ? date : '';
    record(state, 'task', id, t.title, done, date);
    return true;
  }
  function summary(state, date = today()) {
    const milestones = state.projects.flatMap(p => p.milestones);
    const complete = milestones.filter(m => m.done).length;
    const events = activeEvents(state);
    const counts = {};
    events.forEach(e => { counts[e.date] = (counts[e.date] || 0) + 1; });
    let cursor = counts[date] ? date : shift(date, -1), streak = 0;
    while (counts[cursor]) { streak++; cursor = shift(cursor, -1); }
    const start = weekStart(date);
    return { complete, total: milestones.length, percent: milestones.length ? Math.round(100 * complete / milestones.length) : 0, counts, streak, week: events.filter(e => e.date >= start && e.date <= date).length, all: events.length };
  }
  const textValue = (v, name, max = 500) => { if (typeof v !== 'string' || v.length > max) throw new Error(`${name}格式不正确或过长`); return v; };
  function validate(input) {
    if (!input || input.version !== VERSION || !Array.isArray(input.projects) || !Array.isArray(input.tasks) || !Array.isArray(input.events)) throw new Error('不是受支持的任务看板备份');
    if (input.projects.length > 100 || input.tasks.length > 2000 || input.events.length > 20000) throw new Error('备份超过容量限制');
    const used = new Set();
    const id = v => { textValue(v, '编号', 120); if (!v || used.has(v)) throw new Error('备份中有空编号或重复编号'); used.add(v); return v; };
    const date = (v, optional = false) => { if (optional && v === '') return ''; if (!goodDate(v)) throw new Error('备份中有无效日期'); return v; };
    const flag = v => { if (typeof v !== 'boolean') throw new Error('备份中的完成状态无效'); return v; };
    const projects = input.projects.map(p => {
      if (!p || !Array.isArray(p.milestones) || p.milestones.length > 500 || !Object.hasOwn(categories, p.category)) throw new Error('目标格式无效');
      return { id: id(p.id), name: textValue(p.name, '目标名称', 100), category: p.category, baseline: textValue(p.baseline, '起点', 300), description: textValue(p.description, '说明', 1000), deadline: date(p.deadline, true), milestones: p.milestones.map(m => ({ id: id(m.id), title: textValue(m.title, '里程碑', 300), done: flag(m.done) })) };
    });
    const tasks = input.tasks.map(t => {
      const p = projects.find(p => p.id === t.projectId);
      if (t.projectId && !p || t.milestoneId && !p?.milestones.some(m => m.id === t.milestoneId)) throw new Error('任务关联的目标不存在');
      if (!Number.isInteger(t.minutes) || t.minutes < 0 || t.minutes > 1440) throw new Error('任务时间无效');
      const task = { id: id(t.id), title: textValue(t.title, '任务名称', 300), projectId: t.projectId, milestoneId: t.milestoneId, date: date(t.date), minutes: t.minutes, done: flag(t.done), completedAt: date(t.completedAt, true) };
      if (task.done !== Boolean(task.completedAt)) throw new Error('完成日期与任务状态不一致');
      if (task.milestoneId && p.milestones.find(m => m.id === task.milestoneId).done !== task.done) throw new Error('关联里程碑与任务状态不一致');
      return task;
    });
    const events = input.events.map(e => {
      if (!e || !['task', 'milestone'].includes(e.kind)) throw new Error('记录类型无效');
      return { id: id(e.id), kind: e.kind, targetId: textValue(e.targetId, '记录编号', 120), title: textValue(e.title, '记录标题', 500), date: date(e.date), active: flag(e.active) };
    });
    const activeTargets = new Set();
    events.filter(e => e.active).forEach(e => { const key = `${e.kind}:${e.targetId}`; if (activeTargets.has(key)) throw new Error('重复的完成记录'); activeTargets.add(key); });
    return { version: VERSION, projects, tasks, events, updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : '' };
  }
  function createDemo(date = today()) {
    const s = createDefault(date);
    s.projects.forEach((p, i) => p.milestones.slice(0, i === 1 ? 3 : i < 3 ? 2 : 1).forEach(m => setMilestone(s, p.id, m.id, true, shift(date, -(i + 2)))));
    s.tasks.slice(0, 3).forEach(t => setTask(s, t.id, true, date));
    for (let i = 1; i < 70; i++) if (i % 6 !== 0) for (let j = 0; j < 1 + i % 4; j++) record(s, 'task', `demo-${i}-${j}`, ['完成一段证明复现', '整理一道课程习题', '完成一次训练记录', '读清一个核心定义'][j], true, shift(date, -i));
    return s;
  }
  return { VERSION, KEY, uid, today, shift, weekStart, goodDate, categories, createDefault, createDemo, activeEvents, setMilestone, setTask, summary, validate };
});
