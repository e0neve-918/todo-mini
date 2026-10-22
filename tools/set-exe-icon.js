// ToDo-mini.exe 에 아이콘과 이름을 심어요 (작업표시줄 고정 시 아이콘이 바뀌지 않도록)
const fs = require('fs');
const R = require('resedit');
const [exePath, icoPath] = process.argv.slice(2);
const exe = R.NtExecutable.from(fs.readFileSync(exePath));
const res = R.NtExecutableResource.from(exe);
const ico = R.Data.IconFile.from(fs.readFileSync(icoPath));
const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
const g = groups[0];
R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g ? g.id : 1, g ? g.lang : 1033, ico.icons.map((i) => i.data));
const vis = R.Resource.VersionInfo.fromEntries(res.entries);
if (vis[0]) {
  vis[0].setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'ToDo-mini', ProductName: 'ToDo-mini', InternalName: 'ToDo-mini', OriginalFilename: 'ToDo-mini.exe'
  });
  vis[0].outputToResourceEntries(res.entries);
}
res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generateExecutable()));
console.log('icon set');
