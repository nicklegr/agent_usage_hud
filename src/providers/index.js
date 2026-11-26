const { fetchCodexQuota } = require('./codex');
const { fetchAntigravityQuota } = require('./antigravity');
const { fetchMuseQuota } = require('./muse');

const PROVIDER_ORDER = ['antigravity', 'codex', 'muse'];

async function fetchAllQuotas(config, electronCtx = {}) {
  const servicesCfg = config.services || {};
  const tasks = [];

  for (const id of PROVIDER_ORDER) {
    const svc = servicesCfg[id] || {};
    if (svc.enabled === false) continue;

    if (id === 'codex') {
      tasks.push(fetchCodexQuota(svc));
    } else if (id === 'antigravity') {
      tasks.push(fetchAntigravityQuota(svc));
    } else if (id === 'muse') {
      tasks.push(fetchMuseQuota(svc, electronCtx));
    }
  }

  const results = await Promise.all(tasks);
  return {
    items: results,
    lastUpdated: Date.now()
  };
}

module.exports = { fetchAllQuotas, PROVIDER_ORDER };
