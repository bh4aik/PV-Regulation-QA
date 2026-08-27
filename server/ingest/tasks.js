// 任务存储：上传/爬虫候选的清洗入库任务（data/pending/tasks.json）
import fs from 'node:fs';
import { nanoid } from '../util.js';
import { TASKS_FILE } from '../config.js';
import { writeJsonAtomic } from '../json-store.js';

export function loadTasks() {
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  writeJsonAtomic(TASKS_FILE, tasks);
}

export function createTask({ kind, title, source = {}, rawText, meta = {}, filename = '' }) {
  const tasks = loadTasks();
  const task = {
    id: nanoid(),
    kind, // upload | crawl
    status: 'parsed', // parsed -> cleaned -> committed | ignored | failed
    title: title || source.title || '未命名法规',
    filename,
    source, // {title, url, date, sourceName}
    rawText,
    meta, // 探测到的元数据
    cleaned: null, // 清洗后的结构化结果
    cleanedBy: '',
    regId: '',
    error: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.unshift(task);
  saveTasks(tasks);
  return task;
}

export function getTask(id) {
  return loadTasks().find((t) => t.id === id) || null;
}

export function updateTask(id, patch) {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...patch, updatedAt: new Date().toISOString() };
  saveTasks(tasks);
  return tasks[idx];
}

export function removeTask(id) {
  const tasks = loadTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
}

export function activeTasks() {
  return loadTasks().filter((t) => ['parsed', 'cleaned'].includes(t.status));
}

export function recentTasks(limit = 50) {
  return loadTasks().slice(0, limit);
}
