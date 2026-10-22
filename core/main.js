const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const DEF = {
  todos: [{ id: 't1', text: '할 일을 두 번 눌러서 고쳐 보세요', done: false }],
  settings: { font: 'Malgun Gothic', fsz: 14, fw: 600, tb: true, opa: 55, pin: false, auto: true, ctl: 'dbl', lock: false, boot: false },
  library: [],
  placed: [],
  pos: null
};

let data = null;
let win = null;
let setWin = null;
let tray = null;
let fgMode = 'desktop'; // 마지막으로 감지된 앞 창 상태
let uiMode = 'desktop'; // 화면에 보이는 상태
let peek = false; // 더블클릭으로 잠깐 편집 화면을 연 상태
let saveTimer = null;
let helper = null;
let watcher = null;
let fontCache = null;
let updateInfo = null;

const REPO = 'e0neve-918/todo-mini';
const curVersion = () => {
  try { return require('./package.json').version; } catch (e) { return '0.0.0'; }
};
const isNewer = (a, b) => {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) > (y[i] || 0)) return true;
    if ((x[i] || 0) < (y[i] || 0)) return false;
  }
  return false;
};

const dataFile = () => path.join(app.getPath('userData'), 'data.json');
const stickerDir = () => path.join(app.getPath('userData'), 'stickers');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    return {
      ...JSON.parse(JSON.stringify(DEF)),
      ...d,
      settings: { ...DEF.settings, ...(d.settings || {}) }
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEF));
  }
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(app.getPath('userData'), { recursive: true });
      fs.writeFileSync(dataFile(), JSON.stringify(data));
    } catch (e) {}
  }, 200);
}

function view() {
  return {
    todos: data.todos,
    settings: data.settings,
    placed: data.placed,
    library: data.library.map((l) => ({
      id: l.id,
      file: l.file,
      url: pathToFileURL(path.join(stickerDir(), l.file)).href
    })),
    mode: uiMode,
    version: curVersion(),
    update: updateInfo ? { version: updateInfo.version } : null
  };
}

function broadcast(except) {
  const v = view();
  for (const w of BrowserWindow.getAllWindows()) {
    if (except && w.webContents === except) continue;
    w.webContents.send('state', v);
  }
}

/* ---------- 윈도우 전용: 앞 창 감지, 맨 아래로 보내기 ---------- */

const CS = [
  'using System; using System.Runtime.InteropServices; using System.Text;',
  'public class W {',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);',
  '}'
].join('\n');

function psArgs(script) {
  const b64 = Buffer.from(script, 'utf16le').toString('base64');
  return ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', b64];
}

function startHelpers() {
  if (process.platform !== 'win32') return;
  const addType = 'Add-Type -TypeDefinition @"\n' + CS + '\n"@\n';

  const watchScript =
    addType +
    '$sb = New-Object System.Text.StringBuilder 256\n' +
    '$last = ""\n' +
    'while ($true) {\n' +
    '  $h = [W]::GetForegroundWindow()\n' +
    '  if ($h -ne [IntPtr]::Zero) {\n' +
    '    [void]$sb.Clear()\n' +
    '    [void][W]::GetClassName($h, $sb, 256)\n' +
    '    $p = [uint32]0\n' +
    '    [void][W]::GetWindowThreadProcessId($h, [ref]$p)\n' +
    '    $cur = $sb.ToString() + "|" + $p\n' +
    '    if ($cur -ne $last) { $last = $cur; [Console]::Out.WriteLine("FG|" + $cur); [Console]::Out.Flush() }\n' +
    '  }\n' +
    '  Start-Sleep -Milliseconds 250\n' +
    '}\n';

  const helperScript =
    addType +
    'while (($l = [Console]::In.ReadLine()) -ne $null) {\n' +
    '  $q = $l.Split(" ")\n' +
    '  if ($q[0] -eq "BOTTOM") { [void][W]::SetWindowPos([IntPtr][Int64]$q[1], [IntPtr]1, 0, 0, 0, 0, 0x13) }\n' +
    '}\n';

  watcher = spawn('powershell.exe', psArgs(watchScript), { windowsHide: true });
  let buf = '';
  watcher.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      const m = line.split('|');
      if (m[0] === 'FG') onForeground(m[1], m[2]);
    }
  });
  watcher.on('error', () => {});

  helper = spawn('powershell.exe', psArgs(helperScript), { windowsHide: true });
  helper.on('error', () => {});
  helper.stdin.on('error', () => {});
}

const IGNORE_CLASSES = new Set([
  'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'TopLevelWindowForOverflowXamlIsland',
  'NotifyIconOverflowWindow', 'XamlExplorerHostIslandWindow', 'MultitaskingViewFrame',
  'ForegroundStaging', 'Windows.UI.Core.CoreWindow', 'TaskSwitcherWnd', 'SysShadow'
]);

function onForeground(cls, pid) {
  if (Number(pid) === process.pid) return; // 위젯이나 설정 창 자신
  const prev = fgMode;
  if (cls === 'Progman' || cls === 'WorkerW') fgMode = 'desktop';
  else if (IGNORE_CLASSES.has(cls)) return;
  else fgMode = 'work';
  refresh();
}

function sendBottom() {
  if (!helper || !win || win.isDestroyed()) return;
  try {
    const h = win.getNativeWindowHandle();
    const hwnd = h.length >= 8 ? h.readBigUInt64LE(0) : BigInt(h.readUInt32LE(0));
    helper.stdin.write('BOTTOM ' + hwnd.toString() + '\n');
  } catch (e) {}
}

function layerTop() {
  const s = data.settings;
  return true; // 항상 맨 위에 떠 있어요 (편집 화면은 제목 더블클릭)
}

function applyLayer() {
  if (!win || win.isDestroyed()) return;
  if (layerTop()) {
    win.setAlwaysOnTop(true, 'floating');
  } else {
    win.setAlwaysOnTop(false);
    sendBottom();
  }
}

function refresh() {
  const m = peek ? 'desktop' : 'work';
  const changed = m !== uiMode;
  uiMode = m;
  applyLayer();
  if (changed) {
    if (uiMode === 'work' && setWin && !setWin.isDestroyed()) setWin.close();
    broadcast();
  }
}

function applyBoot() {
  try {
    app.setLoginItemSettings({ openAtLogin: !!data.settings.boot });
  } catch (e) {}
}

/* ---------- 창 만들기 ---------- */

function createMain() {
  const wa = screen.getPrimaryDisplay().workArea;
  let [x, y] = [wa.x + 60, wa.y + 60];
  if (data.pos) {
    const d = screen.getDisplayMatching({ x: data.pos[0], y: data.pos[1], width: 100, height: 100 });
    if (data.pos[0] >= d.workArea.x - 300 && data.pos[0] < d.workArea.x + d.workArea.width - 50 &&
        data.pos[1] >= d.workArea.y - 50 && data.pos[1] < d.workArea.y + d.workArea.height - 50) {
      [x, y] = data.pos;
    }
  }
  win = new BrowserWindow({
    width: 420,
    height: 620,
    x, y,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: data.settings.tb === false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    hasShadow: false,
    show: false,
    focusable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.showInactive();
    win.setIgnoreMouseEvents(true, { forward: true });
    refresh();
    applyLayer();
  });
  win.on('minimize', () => {
    setTimeout(() => {
      if (win && !win.isDestroyed()) {
        win.restore();
        applyLayer();
      }
    }, 0);
  });
  win.on('blur', () => {
    if (!layerTop()) sendBottom();
  });
  win.on('closed', () => { win = null; });
}

function openSettings() {
  if (uiMode === 'work') { peek = true; refresh(); }
  if (setWin && !setWin.isDestroyed()) {
    setWin.focus();
    return;
  }
  setWin = new BrowserWindow({
    width: 400,
    height: 700,
    title: '설정',
    autoHideMenuBar: true,
    resizable: false,
    maximizable: false,
    backgroundColor: '#C9D1DC',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  setWin.setMenu(null);
  setWin.loadFile(path.join(__dirname, 'settings', 'index.html'));
  setWin.on('closed', () => { setWin = null; });
}

function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('To-Do 위젯');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '편집 화면 열기 / 닫기', click: () => { peek = !peek; refresh(); } },
      { label: '설정 열기', click: () => openSettings() },
      { label: '위젯 위치 처음으로', click: () => {
        const wa = screen.getPrimaryDisplay().workArea;
        if (win) { win.setPosition(wa.x + 60, wa.y + 60); data.pos = [wa.x + 60, wa.y + 60]; save(); }
      } },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() }
    ]));
    tray.on('click', () => openSettings());
  } catch (e) {}
}

/* ---------- 통신 ---------- */

ipcMain.handle('state', () => view());

ipcMain.on('set-todos', (e, t) => {
  if (Array.isArray(t)) { data.todos = t.slice(0, 200); save(); }
});

ipcMain.on('patch-settings', (e, p) => {
  Object.assign(data.settings, p || {});
  save();
  applyBoot();
  if (win && !win.isDestroyed()) win.setSkipTaskbar(data.settings.tb === false);
  refresh();
  broadcast(e.sender);
});

ipcMain.on('set-placed', (e, p) => {
  if (Array.isArray(p)) { data.placed = p.slice(0, 30); save(); }
});

ipcMain.on('ignore', (e, b) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!b, { forward: true });
});

ipcMain.handle('get-pos', () => (win ? win.getPosition() : [0, 0]));

ipcMain.on('move-to', (e, x, y) => {
  if (!win || win.isDestroyed()) return;
  win.setPosition(Math.round(x), Math.round(y));
  data.pos = [Math.round(x), Math.round(y)];
  save();
});

ipcMain.on('toggle-peek', () => {
  peek = !peek;
  refresh();
});

ipcMain.on('open-settings', () => openSettings());

ipcMain.handle('add-library', async (e, place) => {
  const r = await dialog.showOpenDialog(setWin && !setWin.isDestroyed() ? setWin : win, {
    title: '스티커 이미지 고르기',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '이미지', extensions: ['png', 'webp', 'gif', 'jpg', 'jpeg'] }]
  });
  if (r.canceled) return 0;
  fs.mkdirSync(stickerDir(), { recursive: true });
  let added = 0;
  for (const src of r.filePaths) {
    if (data.library.length >= 20) break;
    try {
      const id = uid();
      const ext = path.extname(src).toLowerCase() || '.png';
      const file = id + ext;
      fs.copyFileSync(src, path.join(stickerDir(), file));
      data.library.push({ id, file });
      if (place && data.placed.length < 30) data.placed.push({ id: uid(), libId: id, x: 250, y: 6, size: 72 });
      added++;
    } catch (err) {}
  }
  save();
  broadcast();
  return added;
});

ipcMain.on('remove-library', (e, id) => {
  const item = data.library.find((l) => l.id === id);
  if (item) { try { fs.unlinkSync(path.join(stickerDir(), item.file)); } catch (err) {} }
  data.library = data.library.filter((l) => l.id !== id);
  data.placed = data.placed.filter((p) => p.libId !== id);
  save();
  broadcast();
});

ipcMain.on('place', (e, libId) => {
  if (!data.library.find((l) => l.id === libId)) return;
  if (data.placed.length >= 30) return;
  data.placed.push({ id: uid(), libId, x: 250, y: 6, size: 72 });
  save();
  broadcast();
});

ipcMain.handle('fonts', () => new Promise((resolve) => {
  if (fontCache) return resolve(fontCache);
  const fallback = ['Malgun Gothic', 'Segoe UI', 'Gulim', 'Batang', 'Arial', 'Georgia'];
  if (process.platform !== 'win32') return resolve(fallback);
  const script =
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8\n' +
    'Add-Type -AssemblyName System.Drawing\n' +
    '(New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }\n';
  execFile('powershell.exe', psArgs(script), { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, out) => {
    if (err || !out) return resolve(fallback);
    fontCache = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko'));
    resolve(fontCache.length ? fontCache : fallback);
  });
}));

/* ---------- 업데이트 (GitHub 릴리스 확인) ---------- */

async function checkUpdate() {
  try {
    const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'todo-widget' }
    });
    if (r.status === 404) { updateInfo = null; return { none: true }; }
    if (!r.ok) return { error: '확인하지 못했어요 (' + r.status + ')' };
    const j = await r.json();
    const tag = String(j.tag_name || '').replace(/^v/, '');
    const asset = (j.assets || []).find((a) => a.name === 'core.zip');
    if (asset && tag && isNewer(tag, curVersion())) {
      const had = updateInfo && updateInfo.version === tag;
      updateInfo = { version: tag, url: asset.browser_download_url };
      if (!had) broadcast();
      return { version: tag };
    }
    updateInfo = null;
    return { none: true };
  } catch (e) {
    return { error: '인터넷 연결을 확인해 주세요' };
  }
}

async function applyUpdate() {
  if (!updateInfo) return { error: '받을 업데이트가 없어요' };
  try {
    const base = path.join(app.getPath('userData'), 'app');
    fs.mkdirSync(base, { recursive: true });
    const zip = path.join(base, 'core.zip');
    const next = path.join(base, 'next');
    const cur = path.join(base, 'current');
    const r = await fetch(updateInfo.url, { headers: { 'User-Agent': 'todo-widget' } });
    if (!r.ok) return { error: '내려받지 못했어요 (' + r.status + ')' };
    fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
    fs.rmSync(next, { recursive: true, force: true });
    const script =
      '$ErrorActionPreference = "Stop"\n' +
      'Expand-Archive -LiteralPath "' + zip.replace(/"/g, '') + '" -DestinationPath "' + next.replace(/"/g, '') + '" -Force\n';
    await new Promise((resolve, reject) => {
      execFile('powershell.exe', psArgs(script), { windowsHide: true }, (err) => (err ? reject(err) : resolve()));
    });
    if (!fs.existsSync(path.join(next, 'main.js'))) return { error: '업데이트 파일이 이상해요' };
    fs.rmSync(cur, { recursive: true, force: true });
    fs.renameSync(next, cur);
    try { fs.unlinkSync(zip); } catch (e) {}
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) {
    return { error: '업데이트에 실패했어요. 다시 시도해 주세요' };
  }
}

ipcMain.handle('check-update', () => checkUpdate());
ipcMain.handle('apply-update', () => applyUpdate());

/* ---------- 시작 ---------- */

app.on('second-instance', () => openSettings());

app.setAppUserModelId('com.todomini.widget');
app.whenReady().then(() => {
  data = load();
  applyBoot();
  createMain();
  createTray();
  startHelpers();
  setTimeout(checkUpdate, 20000);
  setInterval(checkUpdate, 6 * 60 * 60 * 1000);
});

app.on('window-all-closed', (e) => {
  // 트레이에 남겨 둠
});

app.on('before-quit', () => {
  try { if (watcher) watcher.kill(); } catch (e) {}
  try { if (helper) helper.kill(); } catch (e) {}
});
