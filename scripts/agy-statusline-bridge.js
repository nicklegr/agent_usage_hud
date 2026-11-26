#!/usr/bin/env node
// Official Antigravity CLI statusLine bridge for Agent Usage HUD.
// Configure in ~/.gemini/antigravity-cli/settings.json:
// {
//   "statusLine": {
//     "type": "command",
//     "command": "node /path/to/agent_usage_hud/scripts/agy-statusline-bridge.js",
//     "stack_with_default": true
//   }
// }

const fs = require('fs');
const os = require('os');
const path = require('path');

const CACHE_PATH = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'hud-quota-cache.json');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});

process.stdin.on('end', () => {
  try {
    if (!raw.trim()) return;
    const payload = JSON.parse(raw);
    const cache = {
      updated_at: Date.now(),
      plan_tier: payload.plan_tier || null,
      email: payload.email || null,
      model: payload.model?.display_name || payload.model?.id || null,
      quota: payload.quota || {}
    };
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    const tmp = `${CACHE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, CACHE_PATH);
  } catch {
    // Keep statusline silent and non-failing
  }
});
