const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  alwaysOnTop: true,
  theme: 'light', // 'light' | 'dark'
  scale: 'medium', // 'small' | 'medium' | 'large'
  opacity: 0.96,
  refreshIntervalSec: 180,
  windowPosition: null, // { x, y }
  services: {
    antigravity: {
      enabled: true,
      label: 'Antigravity',
      quotaCachePath: path.join(os.homedir(), '.gemini', 'antigravity-cli', 'hud-quota-cache.json'),
      cliPath: 'agy',
      customCommand: ''
    },
    codex: {
      enabled: true,
      label: 'Codex',
      authPath: path.join(os.homedir(), '.codex', 'auth.json')
    },
    muse: {
      enabled: true,
      label: 'Muse',
      usageUrl: 'https://muse.ai',
      cliAuthPath: path.join(os.homedir(), '.config', 'muse', 'auth.json')
    }
  }
};

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  const out = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      out[key] = deepMerge(tv, sv);
    } else if (sv !== undefined) {
      out[key] = sv;
    }
  }
  return out;
}

class ConfigStore {
  constructor(userDataDir) {
    this.filePath = path.join(userDataDir, 'config.json');
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return deepMerge(DEFAULT_CONFIG, parsed);
      }
    } catch (err) {
      console.error('[config] load failed:', err.message);
    }
    return deepMerge(DEFAULT_CONFIG, {});
  }

  save(nextData) {
    this.data = deepMerge(DEFAULT_CONFIG, nextData);
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[config] save failed:', err.message);
    }
    return this.data;
  }

  update(patch) {
    return this.save(deepMerge(this.data, patch));
  }

  get() {
    return this.data;
  }
}

module.exports = { ConfigStore, DEFAULT_CONFIG };
