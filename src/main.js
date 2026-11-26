const path = require('path');
const zlib = require('zlib');
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  session,
  screen
} = require('electron');
const { ConfigStore } = require('./config');
const { fetchAllQuotas } = require('./providers');

let configStore;
let hudWindow = null;
let settingsWindow = null;
let museLoginWindow = null;
let tray = null;
let refreshTimer = null;
let isRefreshing = false;

let latestState = {
  items: [],
  lastUpdated: null,
  isRefreshing: false
};

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createTrayIcon() {
  // Generate a valid 16x16 RGBA PNG buffer in memory for Windows Tray reliability
  const size = 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 4;
      const dx = Math.abs(x - 7.5);
      const dy = Math.abs(y - 7.5);
      const inBox = dx <= 6.5 && dy <= 6.5 && !(dx > 5.5 && dy > 5.5);
      const inDiamond = dx + dy <= 4.3;
      if (!inBox) {
        raw[p] = 0; raw[p + 1] = 0; raw[p + 2] = 0; raw[p + 3] = 0;
      } else if (inDiamond) {
        // #60a5fa
        raw[p] = 0x60; raw[p + 1] = 0xa5; raw[p + 2] = 0xfa; raw[p + 3] = 0xff;
      } else {
        // #1e293b
        raw[p] = 0x1e; raw[p + 1] = 0x29; raw[p + 2] = 0x3b; raw[p + 3] = 0xff;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  return nativeImage.createFromBuffer(png);
}

function getScaleDimensions(config) {
  const enabledCount = Math.max(
    1,
    ['antigravity', 'codex', 'muse'].filter((id) => config.services?.[id]?.enabled !== false).length
  );
  const map = {
    small: { tileW: 96, tileH: 108, gap: 8, pad: 12 },
    medium: { tileW: 114, tileH: 126, gap: 10, pad: 14 },
    large: { tileW: 136, tileH: 148, gap: 12, pad: 16 }
  };
  const m = map[config.scale] || map.medium;
  const width = enabledCount * m.tileW + (enabledCount - 1) * m.gap + m.pad * 2;
  const height = m.tileH + m.pad * 2;
  return { width, height };
}

function broadcastState() {
  const payload = { ...latestState, isRefreshing };
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.webContents.send('hud:state-updated', payload);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('hud:state-updated', payload);
  }
}

function broadcastConfig() {
  const cfg = configStore.get();
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.setAlwaysOnTop(Boolean(cfg.alwaysOnTop), 'screen-saver');
    const { width, height } = getScaleDimensions(cfg);
    const [curW, curH] = hudWindow.getContentSize();
    if (curW !== width || curH !== height) {
      hudWindow.setResizable(true);
      hudWindow.setMinimumSize(width, height);
      hudWindow.setMaximumSize(width, height);
      hudWindow.setContentSize(width, height);
      hudWindow.setResizable(false);
    }
    hudWindow.webContents.send('config:updated', cfg);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('config:updated', cfg);
  }
  rebuildTrayMenu();
}

async function refreshQuotas() {
  if (isRefreshing) return latestState;
  isRefreshing = true;
  broadcastState();

  try {
    const cfg = configStore.get();
    const result = await fetchAllQuotas(cfg, { BrowserWindow, session });
    latestState = {
      items: result.items,
      lastUpdated: result.lastUpdated,
      isRefreshing: false
    };
  } catch (err) {
    console.error('[refresh] failed:', err);
  } finally {
    isRefreshing = false;
    broadcastState();
  }
  return latestState;
}

function scheduleRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  const sec = Math.max(30, Number(configStore.get().refreshIntervalSec) || 180);
  refreshTimer = setInterval(() => {
    refreshQuotas();
  }, sec * 1000);
}

function buildContextMenuTemplate() {
  const cfg = configStore.get();
  return [
    {
      label: isRefreshing ? '更新中...' : '今すぐ更新',
      enabled: !isRefreshing,
      click: () => refreshQuotas()
    },
    { type: 'separator' },
    {
      label: '常に最前面に表示',
      type: 'checkbox',
      checked: Boolean(cfg.alwaysOnTop),
      click: (item) => {
        configStore.update({ alwaysOnTop: item.checked });
        broadcastConfig();
      }
    },
    {
      label: 'テーマ',
      submenu: [
        {
          label: 'ライト (Stream Deck風)',
          type: 'radio',
          checked: cfg.theme === 'light',
          click: () => {
            configStore.update({ theme: 'light' });
            broadcastConfig();
          }
        },
        {
          label: 'ダーク',
          type: 'radio',
          checked: cfg.theme === 'dark',
          click: () => {
            configStore.update({ theme: 'dark' });
            broadcastConfig();
          }
        }
      ]
    },
    {
      label: 'サイズ',
      submenu: [
        {
          label: '小 (S)',
          type: 'radio',
          checked: cfg.scale === 'small',
          click: () => {
            configStore.update({ scale: 'small' });
            broadcastConfig();
          }
        },
        {
          label: '中 (M)',
          type: 'radio',
          checked: cfg.scale === 'medium',
          click: () => {
            configStore.update({ scale: 'medium' });
            broadcastConfig();
          }
        },
        {
          label: '大 (L)',
          type: 'radio',
          checked: cfg.scale === 'large',
          click: () => {
            configStore.update({ scale: 'large' });
            broadcastConfig();
          }
        }
      ]
    },
    { type: 'separator' },
    {
      label: '設定を開く...',
      click: () => openSettingsWindow()
    },
    {
      label: 'HUDを表示 / 前面へ',
      click: () => {
        if (hudWindow && !hudWindow.isDestroyed()) {
          hudWindow.show();
          hudWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ];
}

function resetHudFrame() {
  if (!hudWindow || hudWindow.isDestroyed() || !hudWindow.isVisible()) return;
  const cfg = configStore.get();
  // Work around Windows DWM painting a phantom title bar background after closing a native menu
  setTimeout(() => {
    if (!hudWindow || hudWindow.isDestroyed() || !hudWindow.isVisible()) return;
    hudWindow.hide();
    hudWindow.showInactive();
    if (cfg.alwaysOnTop) {
      hudWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 40);
}

function buildContextMenu() {
  const menu = Menu.buildFromTemplate(buildContextMenuTemplate());
  menu.on('menu-will-close', () => {
    resetHudFrame();
  });
  return menu;
}

function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildContextMenu());
}

function createHudWindow() {
  const cfg = configStore.get();
  const { width, height } = getScaleDimensions(cfg);

  let x;
  let y;
  const primary = screen.getPrimaryDisplay().workArea;
  if (cfg.windowPosition && typeof cfg.windowPosition.x === 'number' && typeof cfg.windowPosition.y === 'number') {
    const displays = screen.getAllDisplays();
    const visible = displays.some((d) => {
      const b = d.workArea;
      return cfg.windowPosition.x >= b.x - width + 40 &&
        cfg.windowPosition.x <= b.x + b.width - 40 &&
        cfg.windowPosition.y >= b.y - height + 40 &&
        cfg.windowPosition.y <= b.y + b.height - 40;
    });
    if (visible) {
      x = cfg.windowPosition.x;
      y = cfg.windowPosition.y;
    } else {
      x = primary.x + primary.width - width - 24;
      y = primary.y + primary.height - height - 24;
    }
  } else {
    x = primary.x + primary.width - width - 24;
    y = primary.y + primary.height - height - 24;
  }

  console.log(`[hud] creating window at (${x}, ${y}) size ${width}x${height}`);

  hudWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: width,
    maxWidth: width,
    minHeight: height,
    maxHeight: height,
    title: '',
    show: true,
    frame: false,
    thickFrame: false,
    transparent: true,
    backgroundColor: '#00000000',
    roundedCorners: false,
    autoHideMenuBar: true,
    resizable: false,
    focusable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: Boolean(cfg.alwaysOnTop),
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  hudWindow.removeMenu();

  if (cfg.alwaysOnTop) {
    hudWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  hudWindow.once('ready-to-show', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.show();
      hudWindow.moveTop();
      console.log('[hud] window shown');
    }
  });

  hudWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[hud] did-fail-load:', code, desc);
  });

  hudWindow.loadFile(path.join(__dirname, 'renderer', 'hud.html'));

  let moveTimeout = null;
  hudWindow.on('moved', () => {
    if (!hudWindow || hudWindow.isDestroyed()) return;
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      if (!hudWindow || hudWindow.isDestroyed()) return;
      const [nx, ny] = hudWindow.getPosition();
      configStore.update({ windowPosition: { x: nx, y: ny } });
    }, 300);
  });

  hudWindow.on('closed', () => {
    hudWindow = null;
  });
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 640,
    title: 'Agent Usage HUD - 設定',
    autoHideMenuBar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function openMuseLoginWindow() {
  if (museLoginWindow && !museLoginWindow.isDestroyed()) {
    museLoginWindow.show();
    museLoginWindow.focus();
    return;
  }

  const cfg = configStore.get();
  const targetUrl = cfg.services?.muse?.usageUrl || 'https://muse.ai';

  museLoginWindow = new BrowserWindow({
    width: 980,
    height: 740,
    title: 'Meta Muse ログイン (ログイン後、Usage画面を表示して閉じてください)',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:muse',
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  museLoginWindow.loadURL(targetUrl);
  museLoginWindow.on('closed', () => {
    museLoginWindow = null;
    refreshQuotas();
  });
}

function setupIpc() {
  ipcMain.handle('hud:get-state', () => ({ ...latestState, isRefreshing }));
  ipcMain.handle('hud:refresh-now', () => refreshQuotas());
  ipcMain.handle('config:get', () => configStore.get());
  ipcMain.handle('config:save', (_event, patch) => {
    const next = configStore.update(patch);
    broadcastConfig();
    scheduleRefresh();
    refreshQuotas();
    return next;
  });
  ipcMain.handle('window:open-settings', () => openSettingsWindow());
  ipcMain.handle('muse:open-login', () => openMuseLoginWindow());
  ipcMain.handle('muse:clear-session', async () => {
    const museSession = session.fromPartition('persist:muse');
    await museSession.clearStorageData();
    await refreshQuotas();
    return true;
  });
  ipcMain.handle('hud:show-context-menu', (event) => {
    const menu = buildContextMenu();
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });
  ipcMain.handle('hud:resize', (_event, { width, height }) => {
    if (hudWindow && !hudWindow.isDestroyed() && width > 40 && height > 40) {
      hudWindow.setSize(Math.ceil(width), Math.ceil(height));
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.show();
      hudWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    configStore = new ConfigStore(app.getPath('userData'));
    setupIpc();
    createHudWindow();

    tray = new Tray(createTrayIcon());
    tray.setToolTip('Agent Usage HUD');
    rebuildTrayMenu();
    tray.on('double-click', () => {
      if (hudWindow && !hudWindow.isDestroyed()) {
        hudWindow.show();
        hudWindow.focus();
      }
    });

    scheduleRefresh();
    refreshQuotas();
  });

  app.on('window-all-closed', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
    }
  });
}
