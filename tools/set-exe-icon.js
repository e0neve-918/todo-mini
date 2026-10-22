// ToDo-mini.exe 에 아이콘과 이름을 심어요 (작업표시줄 고정 시 아이콘이 바뀌지 않도록)
const fs = require('fs');
const R = require('resedit');
const [exePath, pngPath] = process.argv.slice(2);
const exe = R.NtExecutable.from(fs.readFileSync(exePath));
const res = R.NtExecutableResource.from(exe);
// .ico(여러 크기)를 주면 그대로 쓰고, .png를 주면 PNG(256x256) 하나를 담은 ICO를 만들어요
function pngToIco(png) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
  head[6] = 0; head[7] = 0; head[8] = 0; head[9] = 0;
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
  head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return R.Data.IconFile.from(Buffer.concat([head, png]));
}
let ico;
if (/\.ico$/i.test(pngPath)) {
  try {
    ico = R.Data.IconFile.from(fs.readFileSync(pngPath));
    console.log('ico sizes:', ico.icons.map((i) => (i.width || 256)).join(','));
  } catch (e) {
    console.log('ico read failed, using png:', e.message);
    ico = pngToIco(fs.readFileSync(pngPath.replace(/\.ico$/i, '.png')));
  }
} else {
  ico = pngToIco(fs.readFileSync(pngPath));
}
const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
const list = groups.length ? groups : [{ id: 1, lang: 1033 }];
console.log('icon groups:', list.map((g) => g.id + '/' + g.lang).join(', '));
// 전기 아이콘이 하나라도 남지 않도록 모든 아이콘 그룹을 우리 아이콘으로 바꿔요
list.forEach((g) => {
  R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map((i) => i.data));
});
const vis = R.Resource.VersionInfo.fromEntries(res.entries);
if (vis[0]) {
  vis[0].setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'ToDo-mini', ProductName: 'ToDo-mini', InternalName: 'ToDo-mini', OriginalFilename: 'ToDo-mini.exe'
  });
  vis[0].outputToResourceEntries(res.entries);
}
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('icon set');
