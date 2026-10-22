/* 위젯과 설정 창이 같이 쓰는 테마 계산 (색은 모두 [R,G,B] 0~255) */
(function (g) {
  'use strict';
  var D = {
    c1: [150, 168, 190], c2: [92, 124, 172], seed: 7,
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

  /* 대리석 무늬: 색1 바탕 위에 색2의 구름결과 줄무늬를 얹은 SVG */
  function marbleURL(c1, c2, seed) {
    var n = (Number(seed) || 1) | 0;
    var r = c2[0] / 255, gg = c2[1] / 255, b = c2[2] / 255;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="700" viewBox="0 0 420 700">' +
      '<defs>' +
      '<filter id="a" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.0035 0.007" numOctaves="3" seed="' + n + '"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 ' + r + ' 0 0 0 0 ' + gg + ' 0 0 0 0 ' + b + ' 2.6 0 0 0 -1.05"/></filter>' +
      '<filter id="b" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="turbulence" baseFrequency="0.004 0.009" numOctaves="4" seed="' + (n + 11) + '"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 ' + r + ' 0 0 0 0 ' + gg + ' 0 0 0 0 ' + b + ' -9 0 0 0 2.1"/></filter>' +
      '</defs>' +
      '<rect width="420" height="700" fill="' + rgb(c1) + '"/>' +
      '<rect width="420" height="700" filter="url(#a)"/>' +
      '<rect width="420" height="700" filter="url(#b)" opacity=".55"/>' +
      '</svg>';
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
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
