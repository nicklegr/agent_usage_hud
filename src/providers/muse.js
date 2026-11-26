const fs = require('fs');
const os = require('os');
const path = require('path');

const MUSE_ORIGIN = 'https://muse.ai';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

let cachedActionId = null;

function clampPercent(val) {
  if (typeof val !== 'number' || Number.isNaN(val)) return null;
  return Math.max(0, Math.min(100, Math.round(val)));
}

function formatResetDate(unixSec) {
  if (typeof unixSec !== 'number' || Number.isNaN(unixSec) || unixSec <= 0) return null;
  const d = new Date(unixSec * 1000);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 ${hh}:${mm}`;
}

async function fetchMuseFromCliAuth(cliAuthPath) {
  if (!cliAuthPath || !fs.existsSync(cliAuthPath)) return null;
  try {
    const auth = JSON.parse(fs.readFileSync(cliAuthPath, 'utf8'));
    const token = auth?.access_token || auth?.tokens?.access_token;
    if (!token) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('https://api.meta.ai/muse-code/key', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-api-version': '1.0.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ onboard: false }),
        signal: controller.signal
      });
      if (!res.ok) return null;
      const data = await res.json();
      const subs = data?.subs_usage || data?.usage || data;
      const usedPct = subs?.weekly_used_percent ?? subs?.used_percent;
      if (typeof usedPct === 'number') {
        return {
          weeklyRemaining: clampPercent(100 - usedPct),
          detail: 'Muse Code CLI 認証から取得しました'
        };
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
  return null;
}

function isSignedOut(res) {
  const loc = res.headers.get('location') || '';
  return res.status === 401 || res.status === 403 || loc.startsWith('https://auth.muse.ai/');
}

function needsActionRediscovery(res) {
  return !isSignedOut(res) && [400, 404, 409].includes(res.status);
}

function extractChunkPaths(text) {
  const matches = text.match(/static\/(?:immutable\/)?chunks\/[\w~.-]+\.js/g) || [];
  return [...new Set(matches.map((p) => `/_next/${p}`))];
}

async function fetchChunks(paths) {
  return Promise.all(
    paths.map((p) =>
      fetch(`${MUSE_ORIGIN}${p}`, {
        headers: { Accept: '*/*', 'User-Agent': USER_AGENT }
      })
        .then((r) => (r.status === 200 ? r.text() : ''))
        .catch(() => '')
    )
  );
}

async function discoverSubscriptionActionId(cookieHeader) {
  const pageRes = await fetch(`${MUSE_ORIGIN}/`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Cookie: cookieHeader,
      Accept: 'text/html',
      'User-Agent': USER_AGENT
    }
  });
  if (isSignedOut(pageRes)) return { signedOut: true };
  if (pageRes.status !== 200) {
    throw new Error(`muse.ai returned HTTP ${pageRes.status}`);
  }

  const html = await pageRes.text();
  const paths = extractChunkPaths(html).slice(0, 96);
  let combined = '';

  for (let i = 0; i < paths.length; i += 8) {
    const batch = await fetchChunks(paths.slice(i, i + 8));
    combined += '\n' + batch.join('\n');
    if (combined.length > 8 * 1024 * 1024) break;

    // Direct hit in case the server action is already in one of the initial chunks
    const directId = /"([0-9a-f]{40,})",[^"]{0,200}"fetchSubscriptionAction"/.exec(combined)?.[1];
    if (directId) return { actionId: directId };

    // Follow lazy settings module loader chunks
    const modMatch = /\.A\((\d+)\)\.then\(\(\{[^}]*Settings/.exec(combined);
    const modId = modMatch?.[1];
    if (!modId) continue;

    const loaderRe = new RegExp(`[,{\\[]${modId},\\w+=>\\{\\w+\\.v\\(\\w+=>Promise\\.all\\(\\[([^\\]]*)`);
    const loaderMatch = loaderRe.exec(combined);
    if (!loaderMatch) continue;

    const settingsPaths = extractChunkPaths(loaderMatch[1]).slice(0, 32);
    for (let j = 0; j < settingsPaths.length; j += 8) {
      const sBatch = await fetchChunks(settingsPaths.slice(j, j + 8));
      for (const body of sBatch) {
        const id = /"([0-9a-f]{40,})",[^"]{0,200}"fetchSubscriptionAction"/.exec(body)?.[1];
        if (id) return { actionId: id };
      }
    }
    break;
  }

  throw new Error('fetchSubscriptionAction ID の検出に失敗しました');
}

async function postSubscriptionAction(cookieHeader, actionId) {
  return fetch(`${MUSE_ORIGIN}/`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Cookie: cookieHeader,
      Accept: 'text/x-component',
      'Next-Action': actionId,
      Origin: MUSE_ORIGIN,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Content-Type': 'text/plain;charset=UTF-8',
      'User-Agent': USER_AGENT
    },
    body: JSON.stringify([{ includeAgreement: true }])
  });
}

async function fetchMuseFromWebSession(session) {
  if (!session) return { unauthenticated: true };

  const museSession = session.fromPartition('persist:muse');
  const cookies = await museSession.cookies.get({ url: MUSE_ORIGIN }).catch(() => []);
  if (!cookies || cookies.length === 0) {
    return { unauthenticated: true };
  }

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  try {
    let res = cachedActionId ? await postSubscriptionAction(cookieHeader, cachedActionId) : null;

    if (!res || needsActionRediscovery(res)) {
      cachedActionId = null;
      const discovered = await discoverSubscriptionActionId(cookieHeader);
      if (discovered.signedOut) return { unauthenticated: true };
      cachedActionId = discovered.actionId;
      res = await postSubscriptionAction(cookieHeader, cachedActionId);
      if (needsActionRediscovery(res)) {
        cachedActionId = null;
        return { error: 'muse.ai のサーバーアクション呼び出しに失敗しました。再取得してください。' };
      }
    }

    if (isSignedOut(res)) {
      return { unauthenticated: true };
    }

    if (res.status !== 200) {
      return { error: `muse.ai API エラー (HTTP ${res.status})` };
    }

    const bodyText = await res.text();
    let sub = null;
    for (const line of bodyText.split('\n')) {
      const m = /^[0-9a-f]+:(\{.*\})\s*$/.exec(line);
      if (!m) continue;
      try {
        const row = JSON.parse(m[1]);
        if (row?.success === true && row.subscription) {
          sub = row.subscription;
          break;
        }
      } catch {
        // ignore non-JSON flight rows
      }
    }

    if (!sub || typeof sub?.usage?.percentUsed !== 'number') {
      return { error: 'muse.ai のレスポンスから利用状況を読み取れませんでした。' };
    }

    const usedPct = Math.max(0, Math.min(100, sub.usage.percentUsed));
    const weeklyRemaining = clampPercent(100 - usedPct);
    const details = [];
    const tierName = sub.tier?.name || sub.usageRowLabel;
    if (tierName) details.push(`プラン: ${tierName}`);
    const resetTxt = formatResetDate(sub.usage.resetsAt);
    details.push(`週間残量: ${weeklyRemaining}% (使用済み: ${Math.round(usedPct)}%)${resetTxt ? ` / リセット: ${resetTxt}` : ''}`);
    if (sub.topupRowValueLabel) {
      details.push(`${sub.topupRowLabel || '追加トークン'}: ${sub.topupRowValueLabel}`);
    }

    const weeklyResetAt =
      typeof sub.usage.resetsAt === 'number' && sub.usage.resetsAt > 0
        ? sub.usage.resetsAt * 1000
        : null;

    return {
      weeklyRemaining,
      weeklyResetAt,
      detail: details.join('\n')
    };
  } catch (err) {
    return { error: `muse.ai 取得エラー: ${err.message}` };
  }
}

async function fetchMuseQuota(serviceConfig = {}, electronCtx = {}) {
  const updatedAt = Date.now();
  const cliAuthPath = serviceConfig.cliAuthPath || path.join(os.homedir(), '.config', 'muse', 'auth.json');

  // 1. Try Muse Code CLI auth if available
  const cliResult = await fetchMuseFromCliAuth(cliAuthPath);
  if (cliResult) {
    return {
      id: 'muse',
      name: serviceConfig.label || 'Muse',
      status: 'ok',
      headerLabel: '',
      primaryPercent: cliResult.weeklyRemaining,
      secondaryLabel: null,
      secondaryPercent: null,
      weeklyPercent: cliResult.weeklyRemaining,
      hideSecondary: true,
      detail: cliResult.detail,
      updatedAt
    };
  }

  // 2. Fetch via muse.ai Next.js Server Action using Electron's persistent session cookies
  const webResult = await fetchMuseFromWebSession(electronCtx.session);

  if (!webResult || webResult.unauthenticated) {
    return {
      id: 'muse',
      name: serviceConfig.label || 'Muse',
      status: 'unconfigured',
      headerLabel: '',
      primaryPercent: null,
      secondaryLabel: null,
      secondaryPercent: null,
      weeklyPercent: null,
      hideSecondary: true,
      detail: '未ログインまたはセッション期限切れです。設定画面の「Muse にログイン」から muse.ai にサインインしてください。',
      updatedAt
    };
  }

  if (webResult.error) {
    return {
      id: 'muse',
      name: serviceConfig.label || 'Muse',
      status: 'error',
      headerLabel: '',
      primaryPercent: null,
      secondaryLabel: null,
      secondaryPercent: null,
      weeklyPercent: null,
      hideSecondary: true,
      detail: webResult.error,
      updatedAt
    };
  }

  return {
    id: 'muse',
    name: serviceConfig.label || 'Muse',
    status: 'ok',
    headerLabel: '',
    primaryPercent: webResult.weeklyRemaining,
    primaryResetAt: null,
    secondaryLabel: null,
    secondaryPercent: null,
    weeklyPercent: webResult.weeklyRemaining,
    weeklyResetAt: webResult.weeklyResetAt || null,
    hideSecondary: true,
    detail: webResult.detail,
    updatedAt
  };
}

module.exports = { fetchMuseQuota };
