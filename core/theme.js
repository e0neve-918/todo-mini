/* 위젯과 설정 창이 같이 쓰는 테마 계산 (색은 모두 [R,G,B] 0~255) */
(function (g) {
  'use strict';
  var D = {
    c1: [150, 168, 190], c2: [86, 124, 184], seed: 7,
    tmode: 'auto', tl: [255, 255, 255], td: [31, 41, 51], tf: [31, 41, 51],
    acc: [47, 111, 191]
  };

  function clamp(n) { n = Math.round(Number(n)); return isNaN(n) ? 0 : Math.max(0, Math.min(255, n)); }
  function col(v, d) {
    if (!Array.isArray(v) || v.length !== 3) return d.slice();
    return [clamp(v[0]), clamp(v[1]), clamp(v[2])];
  }
  function get(s, k) { return col(s && s[k], D[k]); }
  function rgb(c, a) { return a == null ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
  function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

  /* 부드러운 그라데이션: 색1 바탕에 색2가 번져 들어오는 모양. seed로 번지는 위치가 바뀜 */
  function marbleURL(c1, c2, seed) {
    var n = Math.abs((Number(seed) || 1) | 0);
    var ang = 130 + (n * 37) % 80;
    var x1 = 5 + (n * 53) % 30, y1 = 70 + (n * 29) % 28;
    var x2 = 70 + (n * 41) % 28, y2 = 5 + (n * 17) % 25;
    var hi = [Math.min(255, c1[0] + 60), Math.min(255, c1[1] + 60), Math.min(255, c1[2] + 60)];
    return 'radial-gradient(circle at ' + x1 + '% ' + y1 + '%,' + rgb(c2, 0.95) + ',' + rgb(c2, 0) + ' 62%),' +
      'radial-gradient(circle at ' + x2 + '% ' + y2 + '%,' + rgb(hi, 0.75) + ',' + rgb(hi, 0) + ' 55%),' +
      'linear-gradient(' + ang + 'deg,' + rgb(c1) + ',' + rgb(mid(c1, c2)) + ')';
  }

  /* 무광 유리의 고운 알갱이 */
  var GRAIN = (function () {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">' +
      '<filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .16 0"/></filter>' +
      '<rect width="160" height="160" filter="url(#g)"/></svg>';
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
  })();

  /* 설정 → 화면에서 쓰는 값들 */
  function compute(s) {
    var c1 = get(s, 'c1'), c2 = get(s, 'c2');
    var dark = lum(mid(c1, c2)) < 0.5;       // 배경이 진하면 true → 밝은 글자
    var tx;
    if (s && s.tmode === 'fixed') tx = get(s, 'tf');
    else tx = dark ? get(s, 'tl') : get(s, 'td');
    var lightText = lum(tx) > 0.5;
    var acc = get(s, 'acc');
    return {
      marble: marbleURL(c1, c2, s && s.seed),
      grain: GRAIN,
      tx: rgb(tx), tx2: rgb(tx, 0.72), tx3: rgb(tx, 0.5),
      ln: rgb(tx, 0.16), ln2: rgb(tx, 0.1), ln3: rgb(tx, 0.28),
      sel: lightText ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.72)',
      selFg: rgb(tx),
      acc: rgb(acc),
      accFg: lum(acc) > 0.6 ? '#1F2933' : '#FFFFFF'
    };
  }

  g.Theme = { D: D, get: get, rgb: rgb, lum: lum, compute: compute, marbleURL: marbleURL, GRAIN: GRAIN, clamp: clamp };
})(window);
