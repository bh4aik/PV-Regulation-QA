// 定时任务：每日定时检查新法规
import cron from 'node-cron';
import fs from 'node:fs';
import { crawlAllSources } from './crawl.js';
import { CRAWL_STATE_FILE } from '../config.js';
import { writeJsonAtomic } from '../json-store.js';

let job = null;

export function getCrawlState() {
  try {
    return JSON.parse(fs.readFileSync(CRAWL_STATE_FILE, 'utf-8'));
  } catch {
    return { lastRunAt: null, lastRunResults: [], lastRunAdded: 0 };
  }
}

function saveCrawlState(state) {
  writeJsonAtomic(CRAWL_STATE_FILE, state);
}

export async function runCrawlOnce() {
  const out = await crawlAllSources();
  saveCrawlState({
    lastRunAt: new Date().toISOString(),
    lastRunResults: out.results,
    lastRunAdded: out.added,
  });
  return out;
}

// 由 index.js 调用；settings 变化时调用 resyncScheduler
export function resyncScheduler(getSettings) {
  if (job) {
    job.stop();
    job = null;
  }
  const s = getSettings();
  if (s.crawlEnabled === false) return;
  const schedule = s.crawlSchedule || '0 9 * * *';
  if (!cron.validate(schedule)) return;
  job = cron.schedule(schedule, async () => {
    try {
      await runCrawlOnce();
    } catch (e) {
      console.error('[crawler] 定时任务失败:', e.message);
    }
  }, { noOverlap: true });
}

export function isSchedulerActive() {
  return !!job;
}
