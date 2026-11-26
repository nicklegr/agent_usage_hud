const el = (id) => document.getElementById(id);

function populateForm(cfg) {
  el('alwaysOnTop').checked = Boolean(cfg.alwaysOnTop);
  el('theme').value = cfg.theme || 'light';
  el('scale').value = cfg.scale || 'medium';
  const op = Number(cfg.opacity) || 0.96;
  el('opacity').value = op;
  el('opacity-val').textContent = `${Math.round(op * 100)}%`;
  el('refreshIntervalSec').value = Number(cfg.refreshIntervalSec) || 180;

  const svc = cfg.services || {};
  el('svc-antigravity-enabled').checked = svc.antigravity?.enabled !== false;
  el('svc-antigravity-quotaCachePath').value = svc.antigravity?.quotaCachePath || '';
  el('svc-antigravity-cliPath').value = svc.antigravity?.cliPath || 'agy';
  el('svc-antigravity-customCommand').value = svc.antigravity?.customCommand || '';

  el('svc-codex-enabled').checked = svc.codex?.enabled !== false;
  el('svc-codex-authPath').value = svc.codex?.authPath || '';

  el('svc-muse-enabled').checked = svc.muse?.enabled !== false;
  el('svc-muse-usageUrl').value = svc.muse?.usageUrl || 'https://muse.ai';
}

function updateStatuses(state) {
  const byId = {};
  for (const item of state.items || []) {
    byId[item.id] = item;
  }

  for (const id of ['antigravity', 'codex', 'muse']) {
    const box = el(`status-${id}`);
    const item = byId[id];
    if (!item) {
      box.className = 'status-box';
      box.textContent = '非表示または未取得';
      continue;
    }
    const pct = item.primaryPercent !== null && item.primaryPercent !== undefined ? `${item.primaryPercent}%` : '--%';
    const sub = item.secondaryPercent !== null && item.secondaryPercent !== undefined ? ` / 週間: ${item.secondaryPercent}%` : '';
    box.className = `status-box ${item.status === 'ok' ? 'ok' : 'warn'}`;
    box.textContent = `[${item.status}] 5時間: ${pct}${sub}\n${item.detail || ''}`;
  }
}

el('opacity').addEventListener('input', () => {
  el('opacity-val').textContent = `${Math.round(Number(el('opacity').value) * 100)}%`;
});

el('btn-save').addEventListener('click', async () => {
  const patch = {
    alwaysOnTop: el('alwaysOnTop').checked,
    theme: el('theme').value,
    scale: el('scale').value,
    opacity: Number(el('opacity').value),
    refreshIntervalSec: Math.max(30, Number(el('refreshIntervalSec').value) || 180),
    services: {
      antigravity: {
        enabled: el('svc-antigravity-enabled').checked,
        quotaCachePath: el('svc-antigravity-quotaCachePath').value.trim(),
        cliPath: el('svc-antigravity-cliPath').value.trim() || 'agy',
        customCommand: el('svc-antigravity-customCommand').value.trim()
      },
      codex: {
        enabled: el('svc-codex-enabled').checked,
        authPath: el('svc-codex-authPath').value.trim()
      },
      muse: {
        enabled: el('svc-muse-enabled').checked,
        usageUrl: el('svc-muse-usageUrl').value.trim() || 'https://muse.ai'
      }
    }
  };

  await window.hudApi.saveConfig(patch);
  el('save-toast').textContent = '保存しました';
  setTimeout(() => {
    el('save-toast').textContent = '';
  }, 2000);
});

el('btn-test-refresh').addEventListener('click', async () => {
  await window.hudApi.refreshNow();
});

el('btn-muse-login').addEventListener('click', () => {
  window.hudApi.openMuseLogin();
});

el('btn-muse-logout').addEventListener('click', async () => {
  await window.hudApi.clearMuseSession();
});

async function init() {
  const [cfg, state] = await Promise.all([
    window.hudApi.getConfig(),
    window.hudApi.getState()
  ]);
  populateForm(cfg);
  updateStatuses(state);

  window.hudApi.onStateUpdated((nextState) => {
    updateStatuses(nextState);
  });
}

init();
