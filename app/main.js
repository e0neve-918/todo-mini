// 로더: 업데이트로 받은 최신 코드(내 문서/AppData 쪽)가 있으면 그걸 쓰고,
// 없거나 고장 나 있으면 프로그램에 들어 있는 기본 코드(core)를 써요.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function ver(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version; } catch (e) { return null; }
}
function newer(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) > (y[i] || 0)) return true;
    if ((x[i] || 0) < (y[i] || 0)) return false;
  }
  return false;
}

const bundled = path.join(__dirname, 'core');
let dir = bundled;
try {
  const upd = path.join(app.getPath('userData'), 'app', 'current');
  const uv = ver(upd);
  const bv = ver(bundled);
  if (uv && bv && newer(uv, bv) && fs.existsSync(path.join(upd, 'main.js'))) dir = upd;
} catch (e) {}

try {
  require(path.join(dir, 'main.js'));
} catch (e) {
  if (dir !== bundled) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (err) {}
    require(path.join(bundled, 'main.js'));
  } else {
    throw e;
  }
}
