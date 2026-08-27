// 全局配置：路径、设置存储、DeepSeek 配置
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { writeJsonAtomic } from './json-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const GLOSSARY_FILE = path.join(DATA_DIR, 'glossary.json'); // 中英双语术语等价组
export const RAW_DIR = path.join(DATA_DIR, 'raw');
export const REGS_DIR = path.join(DATA_DIR, 'regulations');
export const PENDING_DIR = path.join(DATA_DIR, 'pending');
export const STATE_DIR = path.join(DATA_DIR, 'state');
export const WEB_DIR = path.join(ROOT, 'web');
export const SETTINGS_FILE = path.join(STATE_DIR, 'settings.json');
export const TASKS_FILE = path.join(PENDING_DIR, 'tasks.json');
export const CANDIDATES_FILE = path.join(PENDING_DIR, 'candidates.json');
export const SEEN_URLS_FILE = path.join(STATE_DIR, 'seen-urls.json');
export const CRAWL_STATE_FILE = path.join(STATE_DIR, 'crawl-state.json');
export const HISTORY_FILE = path.join(STATE_DIR, 'history.json');
export const USERS_FILE = path.join(STATE_DIR, 'users.json');
export const SESSIONS_FILE = path.join(STATE_DIR, 'sessions.json');
export const USAGE_FILE = path.join(STATE_DIR, 'usage.json');
export const QA_CACHE_FILE = path.join(STATE_DIR, 'qa-cache.json');
export const FEEDBACK_FILE = path.join(STATE_DIR, 'feedback.json');
export const ANALYTICS_FILE = path.join(STATE_DIR, 'analytics.json');
export const RATINGS_FILE = path.join(STATE_DIR, 'ratings.json');
export const CHANGELOG_FILE = path.join(STATE_DIR, 'changelog.json');

for (const dir of [DATA_DIR, RAW_DIR, REGS_DIR, PENDING_DIR, STATE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

dotenv.config({ path: path.join(ROOT, '.env') });

let settings = loadSettings();

export function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function getSettings() {
  return settings;
}

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  writeJsonAtomic(SETTINGS_FILE, settings);
  return settings;
}

export function getDeepSeekConfig() {
  const key = (settings.deepseekApiKey || process.env.DEEPSEEK_API_KEY || '').trim();
  const model = (settings.deepseekModel || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash').trim();
  return { key, model };
}

export const PORT = Number(process.env.PORT || 3000);
export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
