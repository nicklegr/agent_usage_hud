const fs = require('fs');
const os = require('os');
const path = require('path');

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

function pickWindows(rateLimit) {
  if (!rateLimit) return { weekly: null, short: null };
  const windows = [rateLimit.primary_window, rateLimit.secondary_window].filter(Boolean);
  if (windows.length === 0) return { weekly: null, short: null };
  if (windows.length === 1) {
    const w = windows[0];
    if ((w.limit_window_seconds || 0) >= 86400) {
      return { weekly: w, short: null };
    }
    return { weekly: null, short: w };
  }
  windows.sort((a, b) => (a.limit_window_seconds || 0) - (b.limit_window_seconds || 0));
  return { short: windows[0], weekly: windows[windows.length - 1] };
}

async function fetchCodexQuota(serviceConfig = {}) {
  const authPath = serviceConfig.authPath || path.join(os.homedir(), '.codex', 'auth.json');
  const updatedAt = Date.now();

  if (!fs.existsSync(authPath)) {
    return {
      id: 'codex',
      name: serviceConfig.label || 'Codex',
      status: 'unconfigured',
      headerLabel: '5時間',
      primaryPercent: null,
      secondaryLabel: '週間',
      secondaryPercent: null,
      detail: `認証ファイルが見つかりません: ${authPath}`,
      updatedAt
    };
  }

  let auth;
  try {
    auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
  } catch (err) {
    return {
      id: 'codex',
      name: serviceConfig.label || 'Codex',
      status: 'error',
      headerLabel: '5時間',
      primaryPercent: null,
      secondaryLabel: '週間',
      secondaryPercent: null,
      detail: `auth.json の読み込み失敗: ${err.message}`,
      updatedAt
    };
  }

  const accessToken = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  if (!accessToken) {
    return {
      id: 'codex',
      name: serviceConfig.label || 'Codex',
      status: 'unconfigured',
      headerLabel: '5時間',
      primaryPercent: null,
      secondaryLabel: '週間',
      secondaryPercent: null,
      detail: 'auth.json に tokens.access_token がありません (codex login を実行してください)',
      updatedAt
    };
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'OpenAI-Beta': 'codex-1',
    originator: 'Codex Desktop',
    'User-Agent': 'CodexDesktop/1.0'
  };
  if (accountId) {
    headers['ChatGPT-Account-ID'] = accountId;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    if (res.status === 401 || res.status === 403) {
      return {
        id: 'codex',
        name: serviceConfig.label || 'Codex',
        status: 'auth_expired',
        headerLabel: '5時間',
        primaryPercent: null,
        secondaryLabel: '週間',
        secondaryPercent: null,
        detail: `認証期限切れ (HTTP ${res.status})。Codex を再起動または再ログインしてください。`,
        updatedAt
      };
    }

    if (!res.ok) {
      return {
        id: 'codex',
        name: serviceConfig.label || 'Codex',
        status: 'error',
        headerLabel: '5時間',
        primaryPercent: null,
        secondaryLabel: '週間',
        secondaryPercent: null,
        detail: `APIエラー (HTTP ${res.status})`,
        updatedAt
      };
    }

    const data = await res.json();
    const { weekly, short } = pickWindows(data.rate_limit);

    const weeklyRemaining = weekly ? clampPercent(100 - weekly.used_percent) : null;
    const shortRemaining = short ? clampPercent(100 - short.used_percent) : null;

    const detailLines = [];
    if (data.plan_type) detailLines.push(`プラン: ${data.plan_type}`);
    if (short) {
      const resetTxt = formatResetDuration(short.reset_after_seconds);
      detailLines.push(`5時間残量: ${shortRemaining}%${resetTxt ? ` (リセット: ${resetTxt})` : ''}`);
    }
    if (weekly) {
      const resetTxt = formatResetDuration(weekly.reset_after_seconds);
      detailLines.push(`週間残量: ${weeklyRemaining}%${resetTxt ? ` (リセット: ${resetTxt})` : ''}`);
    }
    if (data.credits && data.credits.has_credits) {
      detailLines.push(`クレジット残高: ${data.credits.balance}`);
    }

    return {
      id: 'codex',
      name: serviceConfig.label || 'Codex',
      status: 'ok',
      headerLabel: '',
      primaryPercent: shortRemaining,
      secondaryLabel: '週間',
      secondaryPercent: weeklyRemaining,
      weeklyPercent: weeklyRemaining,
      detail: detailLines.join('\n') || '取得成功',
      updatedAt
    };
  } catch (err) {
    return {
      id: 'codex',
      name: serviceConfig.label || 'Codex',
      status: 'error',
      headerLabel: '5時間',
      primaryPercent: null,
      secondaryLabel: '週間',
      secondaryPercent: null,
      detail: `通信エラー: ${err.message}`,
      updatedAt
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchCodexQuota };
