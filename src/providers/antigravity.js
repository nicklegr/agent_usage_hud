const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

function clampPercent(val) {
  if (typeof val !== 'number' || Number.isNaN(val)) return null;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function formatResetDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds <= 0) return null;
  const totalMin = Math.floor(seconds / 60);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}日${hours}時間後`;
  if (hours > 0) return `${hours}時間${mins}分後`;
  return `${mins}分後`;
}

function parseStatusLineQuotaObject(obj) {
  const quota = obj?.quota;
  if (!quota || typeof quota !== 'object' || Array.isArray(quota)) return null;

  const entries = Object.entries(quota).filter(([, v]) => v && typeof v === 'object' && !v.disabled);
  if (entries.length === 0) return null;

  let weekly = null;
  let fiveH = null;
  const details = [];
  if (obj.plan_tier) details.push(`プラン: ${obj.plan_tier}`);

  const parsedBuckets = [];
  for (const [bucketId, info] of entries) {
    let pct = null;
    if (typeof info.remaining_fraction === 'number') {
      pct = clampPercent(info.remaining_fraction * 100);
    } else if (typeof info.remainingFraction === 'number') {
      pct = clampPercent(info.remainingFraction * 100);
    }
    if (pct === null) continue;

    const resetSec = typeof info.reset_in_seconds === 'number' ? info.reset_in_seconds : null;
    let resetAt = null;
    if (info.reset_time && !String(info.reset_time).startsWith('1970-01-01')) {
      const t = new Date(info.reset_time).getTime();
      if (!Number.isNaN(t)) resetAt = t;
    } else if (resetSec !== null && resetSec > 0) {
      resetAt = Date.now() + resetSec * 1000;
    }
    const resetTxt = formatResetDuration(resetSec);
    details.push(`${bucketId}: ${pct}%${resetTxt ? ` (リセット: ${resetTxt})` : ''}`);
    parsedBuckets.push({ id: bucketId.toLowerCase(), pct, resetSec, resetAt });
  }

  if (parsedBuckets.length === 0) return null;

  const shortBuckets = parsedBuckets.filter(
    (b) => /5h|5-?hour|short|session/.test(b.id) || (b.resetSec !== null && b.resetSec <= 21600 && !/week|7d/.test(b.id))
  );
  const weeklyBuckets = parsedBuckets.filter(
    (b) => /week|7d/.test(b.id) || (b.resetSec !== null && b.resetSec > 21600)
  );

  let fiveHResetAt = null;
  let weeklyResetAt = null;

  if (shortBuckets.length > 0) {
    shortBuckets.sort((a, b) => a.pct - b.pct);
    fiveH = shortBuckets[0].pct;
    fiveHResetAt = shortBuckets[0].resetAt;
  }
  if (weeklyBuckets.length > 0) {
    weeklyBuckets.sort((a, b) => a.pct - b.pct);
    weekly = weeklyBuckets[0].pct;
    weeklyResetAt = weeklyBuckets[0].resetAt;
  }
  if (weekly === null && fiveH === null) {
    parsedBuckets.sort((a, b) => a.pct - b.pct);
    weekly = parsedBuckets[0].pct;
    weeklyResetAt = parsedBuckets[0].resetAt;
  }

  return { weekly, fiveH, fiveHResetAt, weeklyResetAt, details };
}

function parseAgyUsageCommand(obj) {
  const groups = obj?.command?.data?.groups;
  if (!Array.isArray(groups) || groups.length === 0) return null;

  const fiveHList = [];
  const weeklyList = [];
  const details = [];

  for (const group of groups) {
    const groupName = group.name || 'Models';
    const buckets = Array.isArray(group.buckets) ? group.buckets : [];
    for (const b of buckets) {
      if (typeof b.remaining_fraction !== 'number') continue;
      const pct = clampPercent(b.remaining_fraction * 100);
      const win = String(b.window || b.id || '').toLowerCase();

      let resetAt = null;
      let resetTxt = null;
      if (b.reset_time && !String(b.reset_time).startsWith('1970-01-01')) {
        const t = new Date(b.reset_time).getTime();
        if (!Number.isNaN(t)) {
          resetAt = t;
          resetTxt = formatResetDuration(Math.floor((t - Date.now()) / 1000));
        }
      }

      if (win === '5h' || /5h/.test(win)) {
        fiveHList.push({ pct, resetAt });
        details.push(`${groupName} 5時間: ${pct}%${resetTxt ? ` (リセット: ${resetTxt})` : ''}`);
      } else if (win === 'weekly' || /week/.test(win)) {
        weeklyList.push({ pct, resetAt });
        details.push(`${groupName} 週間: ${pct}%${resetTxt ? ` (リセット: ${resetTxt})` : ''}`);
      } else {
        details.push(`${groupName} ${b.name || b.id}: ${pct}%`);
      }
    }
  }

  if (fiveHList.length === 0 && weeklyList.length === 0) return null;

  fiveHList.sort((a, b) => a.pct - b.pct);
  weeklyList.sort((a, b) => a.pct - b.pct);

  return {
    fiveH: fiveHList.length > 0 ? fiveHList[0].pct : null,
    fiveHResetAt: fiveHList.length > 0 ? fiveHList[0].resetAt : null,
    weekly: weeklyList.length > 0 ? weeklyList[0].pct : null,
    weeklyResetAt: weeklyList.length > 0 ? weeklyList[0].resetAt : null,
    details
  };
}

function parseAntigravityJson(obj) {
  const agyCmdParsed = parseAgyUsageCommand(obj);
  if (agyCmdParsed) return agyCmdParsed;

  const statusLineParsed = parseStatusLineQuotaObject(obj);
  if (statusLineParsed) return statusLineParsed;

  let weekly = null;
  let fiveH = null;
  let credits = null;
  const details = [];

  // Handle common shapes from `agy -p /usage --output-format json` or custom scripts
  const flatStr = JSON.stringify(obj);

  // Direct fields if provided by a wrapper script
  if (typeof obj.weeklyRemainingPercent === 'number') weekly = clampPercent(obj.weeklyRemainingPercent);
  if (typeof obj.fiveHourRemainingPercent === 'number') fiveH = clampPercent(obj.fiveHourRemainingPercent);
  if (typeof obj.primaryPercent === 'number' && weekly === null) weekly = clampPercent(obj.primaryPercent);
  if (typeof obj.secondaryPercent === 'number' && fiveH === null) fiveH = clampPercent(obj.secondaryPercent);

  // Array of quotas/models/buckets
  const list = obj.quotas || obj.models || obj.buckets || obj.limits || obj.pools;
  if (Array.isArray(list)) {
    const pcts = [];
    for (const item of list) {
      const label = item.name || item.model || item.pool || item.window || 'quota';
      let rem = null;
      if (typeof item.remainingPercent === 'number') rem = clampPercent(item.remainingPercent);
      else if (typeof item.remaining_percent === 'number') rem = clampPercent(item.remaining_percent);
      else if (typeof item.remainingFraction === 'number') rem = clampPercent(item.remainingFraction * 100);
      else if (typeof item.remaining_fraction === 'number') rem = clampPercent(item.remaining_fraction * 100);
      else if (typeof item.usedPercent === 'number') rem = clampPercent(100 - item.usedPercent);
      else if (typeof item.used_percent === 'number') rem = clampPercent(100 - item.used_percent);

      if (rem !== null) {
        details.push(`${label}: ${rem}%`);
        pcts.push({ label: String(label).toLowerCase(), rem });
      }
    }
    if (weekly === null) {
      const w = pcts.find((p) => /week|7d|週間/.test(p.label));
      if (w) weekly = w.rem;
    }
    if (fiveH === null) {
      const s = pcts.find((p) => /5h|5 hour|session|short/.test(p.label));
      if (s) fiveH = s.rem;
    }
    if (weekly === null && pcts.length > 0) {
      // Fall back to minimum remaining across model pools
      weekly = Math.min(...pcts.map((p) => p.rem));
    }
  }

  if (obj.credits !== undefined) {
    credits = typeof obj.credits === 'object' ? obj.credits.remaining ?? obj.credits.balance : obj.credits;
    if (credits !== undefined && credits !== null) {
      details.push(`AI Credits: ${credits}`);
    }
  }

  if (weekly === null && fiveH === null) {
    const match = flatStr.match(/(\d{1,3})\s*%/);
    if (match) weekly = clampPercent(Number(match[1]));
  }

  return { weekly, fiveH, details };
}

function parseAntigravityText(text) {
  const details = [];
  let weekly = null;
  let fiveH = null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const pctMatch = line.match(/(\d{1,3})\s*%/);
    if (!pctMatch) continue;
    let pct = clampPercent(Number(pctMatch[1]));
    if (/used|消費|使用/i.test(line) && !/remain|残り/i.test(line)) {
      pct = clampPercent(100 - pct);
    }
    if (/week|7d|週間/i.test(line) && weekly === null) {
      weekly = pct;
    } else if (/5h|5\s*hour|session/i.test(line) && fiveH === null) {
      fiveH = pct;
    }
    details.push(line);
  }

  if (weekly === null) {
    const anyPct = text.match(/(\d{1,3})\s*%/);
    if (anyPct) weekly = clampPercent(Number(anyPct[1]));
  }

  return { weekly, fiveH, details: details.slice(0, 6) };
}

function resolveAgyExecutable(cliPath) {
  const configured = (cliPath || 'agy').trim();
  if (configured !== 'agy') return configured;
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const defaultExe = path.join(localAppData, 'agy', 'bin', 'agy.exe');
  if (fs.existsSync(defaultExe)) return defaultExe;
  return 'agy';
}

async function fetchAntigravityQuota(serviceConfig = {}) {
  const updatedAt = Date.now();
  const quotaCachePath =
    (serviceConfig.quotaCachePath || '').trim() ||
    path.join(os.homedir(), '.gemini', 'antigravity-cli', 'hud-quota-cache.json');
  const customCommand = (serviceConfig.customCommand || '').trim();
  const cliPath = resolveAgyExecutable(serviceConfig.cliPath);

  // 1. Prefer official statusLine quota cache JSON if present
  if (fs.existsSync(quotaCachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(quotaCachePath, 'utf8'));
      const parsed = parseAntigravityJson(cached);
      if (parsed && (parsed.weekly !== null || parsed.fiveH !== null)) {
        const primary = parsed.fiveH !== null ? parsed.fiveH : parsed.weekly;
        return {
          id: 'antigravity',
          name: serviceConfig.label || 'Antigravity',
          status: 'ok',
          headerLabel: '',
          primaryPercent: primary,
          primaryResetAt: parsed.fiveHResetAt || null,
          secondaryLabel: '週間',
          secondaryPercent: parsed.weekly,
          weeklyPercent: parsed.weekly,
          weeklyResetAt: parsed.weeklyResetAt || null,
          detail: parsed.details.join('\n') || 'statusLine キャッシュから取得しました',
          updatedAt: cached.updated_at || updatedAt
        };
      }
    } catch {
      // fall through to CLI/customCommand
    }
  }

  // 2. Fallback to CLI / customCommand
  try {
    let stdout = '';
    if (customCommand) {
      const res = await execAsync(customCommand, { timeout: 15000, windowsHide: true });
      stdout = res.stdout || '';
    } else {
      const res = await execFileAsync(cliPath, ['-p', '/usage', '--output-format', 'json'], {
        timeout: 15000,
        windowsHide: true
      });
      stdout = res.stdout || '';
    }

    let parsed;
    try {
      const jsonStart = stdout.indexOf('{');
      const jsonText = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;
      parsed = parseAntigravityJson(JSON.parse(jsonText));
    } catch {
      parsed = parseAntigravityText(stdout);
    }

    if (parsed.weekly === null && parsed.fiveH === null) {
      return {
        id: 'antigravity',
        name: serviceConfig.label || 'Antigravity',
        status: 'error',
        headerLabel: '5時間',
        primaryPercent: null,
        secondaryLabel: '週間',
        secondaryPercent: null,
        detail: 'CLI出力から残量%を読み取れませんでした。設定でコマンドを確認してください。',
        updatedAt
      };
    }

    return {
      id: 'antigravity',
      name: serviceConfig.label || 'Antigravity',
      status: 'ok',
      headerLabel: '',
      primaryPercent: parsed.fiveH,
      primaryResetAt: parsed.fiveHResetAt || null,
      secondaryLabel: '週間',
      secondaryPercent: parsed.weekly,
      weeklyPercent: parsed.weekly,
      weeklyResetAt: parsed.weeklyResetAt || null,
      detail: parsed.details.join('\n') || 'Antigravity CLI から取得しました',
      updatedAt
    };
  } catch (err) {
    const notFound = err.code === 'ENOENT' || /not recognized|見つかりません/i.test(err.message || '');
    return {
      id: 'antigravity',
      name: serviceConfig.label || 'Antigravity',
      status: notFound ? 'unconfigured' : 'error',
      headerLabel: '5時間',
      primaryPercent: null,
      secondaryLabel: '週間',
      secondaryPercent: null,
      detail: notFound
        ? `Antigravity CLI (${cliPath}) が見つかりません。\n設定から CLI パスまたは取得コマンドを指定してください。`
        : `取得エラー: ${err.message}`,
      updatedAt
    };
  }
}

module.exports = { fetchAntigravityQuota };
