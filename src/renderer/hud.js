const ICONS = {
  antigravity: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.5L14.8 9.2L21.5 12L14.8 14.8L12 21.5L9.2 14.8L2.5 12L9.2 9.2L12 2.5Z" fill="#2563EB"/>
  </svg>`,
  codex: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
  </svg>`,
  muse: `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24.6257 16.1214C28.2365 16.1214 30.8187 18.9408 30.8187 23.3643C30.8185 27.7868 30.1055 31.7765 28.9225 40.2466C28.0743 46.1813 26.62 55.2418 26.0132 59.0088C27.1782 56.7815 29.9074 51.5757 30.3914 50.5982C36.1081 39.061 42.0657 28.7544 43.7826 26.0254C46.0594 22.382 48.062 20.9229 51.1597 20.9229C52.7685 20.923 54.6826 21.7357 55.6315 22.819C56.9178 24.2895 57.1859 26.6602 57.1411 29.244C57.0738 33.2073 56.5599 39.5264 55.8553 46.5698C55.5416 49.7057 54.9365 56.1066 54.5288 60.4004C58.1883 53.8532 64.9609 41.8109 67.6921 37.6058C70.0727 33.9402 72.466 31.5797 75.6836 31.5796C78.4595 31.5796 81.8809 33.5416 81.6772 38.7573C81.3774 46.4556 80.2673 63.2232 79.7607 70.7479C83.1662 65.7913 87.6377 58.4543 89.3148 55.6966C91.0104 52.908 92.75 50.6542 95.3898 50.5778C98.0987 50.4995 99.913 52.341 99.9959 55.1839C100.078 58.0277 98.3835 61.2256 96.1344 64.856C93.6937 68.7957 90.9621 73.0123 87.6383 76.9491C84.3148 80.8856 81.2604 83.8782 76.5991 83.8786C72.4243 83.8786 69.4869 81.1043 69.283 76.0254C69.1768 73.364 69.6804 67.6405 70.0602 63.1673C70.5 57.9875 71.0315 52.9861 71.403 49.6786C67.7337 56.3979 60.0101 70.4676 56.5348 75.9603C53.1343 81.3339 51.4774 83.2269 47.8882 83.2275C44.2977 83.2275 42.7226 80.6416 42.6717 76.7497C42.6142 72.5285 45.7852 47.1821 46.8587 38.737C45.1183 42.4616 40.839 51.6056 38.1551 57.0435C35.5587 62.3055 31.204 71.3978 28.0436 76.6357C25.7668 80.4094 23.2092 83.2273 19.4173 83.2275C15.6252 83.2275 13.4847 80.6784 13.4847 76.5788C13.4847 72.4794 14.6716 65.6492 15.9465 57.1777C16.5839 53.0781 17.3108 48.6133 18.1315 43.8761C18.7324 40.448 19.7764 34.4169 20.4183 30.7129C17.502 35.2539 12.2536 43.4278 10.6567 45.8903C8.88113 48.6291 7.28747 50.626 4.64681 50.6266C1.7329 50.6266 0.000532901 48.3522 0 45.7113C0 43.0703 1.34323 41.0344 3.52376 37.4512C6.32403 32.8465 11.3578 26.57 14.1154 23.2747C17.3656 19.3912 20.6139 16.1219 24.6257 16.1214Z" fill="url(#muse_grad)"/>
    <defs>
      <linearGradient id="muse_grad" x1="133.245" y1="109.046" x2="24.9203" y2="-12.5565" gradientUnits="userSpaceOnUse">
        <stop offset="0.25" stop-color="#0082FB"/>
        <stop offset="0.7" stop-color="#0064E0"/>
        <stop offset="1" stop-color="#0040DC"/>
      </linearGradient>
    </defs>
  </svg>`
};

const tilesEl = document.getElementById('tiles');
const btnRefresh = document.getElementById('btn-refresh');
const btnSettings = document.getElementById('btn-settings');

let currentConfig = null;
let currentState = { items: [], lastUpdated: null, isRefreshing: false };

function levelClass(pct) {
  if (pct === null || pct === undefined) return 'level-empty';
  if (pct <= 15) return 'level-low';
  if (pct <= 40) return 'level-warn';
  return 'level-ok';
}

function formatTime(ts) {
  if (!ts) return '--:--';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function applyConfig(cfg) {
  currentConfig = cfg;
  document.body.classList.remove('theme-light', 'theme-dark', 'scale-small', 'scale-medium', 'scale-large');
  document.body.classList.add(`theme-${cfg.theme || 'light'}`);
  document.body.classList.add(`scale-${cfg.scale || 'medium'}`);
  const root = document.getElementById('hud-root');
  if (root) {
    root.style.opacity = String(Math.max(0.35, Math.min(1, Number(cfg.opacity) || 0.96)));
  }
}

function barLevelClass(pct) {
  if (pct === null || pct === undefined) return 'level-empty';
  if (pct < 30) return 'bar-low';
  return 'bar-ok';
}

function render(state) {
  currentState = state;
  btnRefresh.classList.toggle('spinning', Boolean(state.isRefreshing));

  const items = state.items && state.items.length > 0
    ? state.items
    : [
        { id: 'antigravity', name: 'Antigravity', status: 'loading', primaryPercent: null, secondaryLabel: '週間', secondaryPercent: null, weeklyPercent: null, detail: '読み込み中...' },
        { id: 'codex', name: 'Codex', status: 'loading', primaryPercent: null, secondaryLabel: '週間', secondaryPercent: null, weeklyPercent: null, detail: '読み込み中...' },
        { id: 'muse', name: 'Muse', status: 'loading', primaryPercent: null, secondaryLabel: null, secondaryPercent: null, weeklyPercent: null, hideSecondary: true, detail: '読み込み中...' }
      ];

  tilesEl.innerHTML = '';

  for (const item of items) {
    const hideSub = Boolean(item.hideSecondary) || item.id === 'muse';
    const tile = document.createElement('div');
    tile.className = `tile status-${item.status || 'ok'}${hideSub ? ' no-sub' : ''}`;

    const updatedLabel = formatTime(item.updatedAt || state.lastUpdated);
    tile.title = `${item.name}\n${item.detail || ''}\n更新: ${updatedLabel}`;

    const mainText = item.primaryPercent !== null && item.primaryPercent !== undefined
      ? `${item.primaryPercent}%`
      : '--%';

    const subText = item.secondaryPercent !== null && item.secondaryPercent !== undefined
      ? `${item.secondaryLabel || '週間'} ${item.secondaryPercent}%`
      : `${item.secondaryLabel || '週間'} --%`;

    const weeklyPct = item.weeklyPercent !== undefined
      ? item.weeklyPercent
      : (hideSub ? item.primaryPercent : item.secondaryPercent);

    const lvl = levelClass(item.primaryPercent);
    const barLvl = barLevelClass(weeklyPct);
    const barWidth = weeklyPct !== null && weeklyPct !== undefined
      ? `${weeklyPct}%`
      : '0%';

    tile.innerHTML = `
      <span class="status-dot"></span>
      <div class="tile-header">
        <span class="tile-icon">${ICONS[item.id] || ICONS.antigravity}</span>
      </div>
      <div class="tile-main ${lvl}">${mainText}</div>
      ${hideSub ? '' : `<div class="tile-sub">${subText}</div>`}
      <div class="tile-bar"><div class="tile-bar-fill ${barLvl}" style="width: ${barWidth};"></div></div>
    `;

    tilesEl.appendChild(tile);
  }
}

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.hudApi.showContextMenu();
});

btnRefresh.addEventListener('click', (e) => {
  e.stopPropagation();
  window.hudApi.refreshNow();
});

btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  window.hudApi.openSettings();
});

async function init() {
  const [cfg, state] = await Promise.all([
    window.hudApi.getConfig(),
    window.hudApi.getState()
  ]);
  applyConfig(cfg);
  render(state);

  window.hudApi.onConfigUpdated((nextCfg) => {
    applyConfig(nextCfg);
  });

  window.hudApi.onStateUpdated((nextState) => {
    render(nextState);
  });
}

init();
