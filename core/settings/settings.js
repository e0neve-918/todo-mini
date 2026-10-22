(function () {
  'use strict';
  var S = null;
  var fonts = [];
  var $ = function (id) { return document.getElementById(id); };

  var OPTS = [
    ['lock', '위치 잠금', '위젯과 스티커가 실수로 움직이지 않게'],
    ['tb', '작업표시줄에 표시', '아래 작업표시줄에서 앱을 찾을 수 있어요'],
    ['boot', '윈도우 시작 시 실행', '컴퓨터를 켜면 자동으로 켜져요']
  ];

  function renderFonts() {
    var q = $('fq').value.trim().toLowerCase();
    var box = $('fl');
    box.innerHTML = '';
    var list = fonts.filter(function (f) { return !q || f.toLowerCase().indexOf(q) >= 0; }).slice(0, 300);
    list.forEach(function (f) {
      var b = document.createElement('button');
      b.className = 'fo' + (S && S.settings.font === f ? ' sel' : '');
      b.textContent = f;
      b.style.fontFamily = "'" + f + "', sans-serif";
      b.setAttribute('role', 'option');
      b.addEventListener('click', function () {
        S.settings.font = f;
        window.api.patch({ font: f });
        renderFonts();
      });
      box.appendChild(b);
    });
    if (!list.length) box.textContent = '찾는 글꼴이 없어요';
  }

  function renderTiles() {
    var t = $('tiles');
    t.innerHTML = '';
    S.library.forEach(function (l) {
      var b = document.createElement('button');
      b.className = 'tile';
      b.setAttribute('aria-label', '스티커 붙이기');
      b.title = '누르면 붙이고, 오른쪽 클릭하면 지워요';
      var img = document.createElement('img');
      img.src = l.url;
      img.alt = '';
      b.appendChild(img);
      b.addEventListener('click', function () { window.api.place(l.id); });
      b.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (confirm('이 스티커를 목록에서 지울까요?')) window.api.removeLibrary(l.id);
      });
      t.appendChild(b);
    });
    if (S.library.length < 20) {
      var add = document.createElement('button');
      add.className = 'tile add';
      add.setAttribute('aria-label', 'PNG 이미지 추가');
      add.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
      add.addEventListener('click', function () { window.api.addLibrary(false); });
      t.appendChild(add);
    }
  }

  function renderOpts() {
    var box = $('opts');
    box.innerHTML = '';
    var cur = S.settings.ctl === 'auto' ? 'auto' : 'dbl';
    var cr = document.createElement('div');
    cr.className = 'ctl';
    var ct = document.createElement('div');
    ct.className = 'opt-t';
    ct.innerHTML = '위젯 방식<small></small>';
    ct.querySelector('small').textContent = cur === 'dbl' ? '항상 위에 떠 있고, 제목(To-Do)을 두 번 클릭하면 편집 화면이 열리고 닫혀요' : '바탕화면이면 맨 아래 + 편집 화면, 다른 프로그램을 쓰면 맨 위 + 체크만 (제목을 두 번 클릭해도 편집 가능)';
    var sg = document.createElement('div');
    sg.className = 'seg2';
    [['dbl', '더블클릭'], ['auto', '자동 전환']].forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = m[1];
      b.className = cur === m[0] ? 'sel' : '';
      b.addEventListener('click', function () {
        S.settings.ctl = m[0];
        window.api.patch({ ctl: m[0] });
        renderOpts();
      });
      sg.appendChild(b);
    });
    cr.appendChild(ct); cr.appendChild(sg);
    box.appendChild(cr);
    OPTS.forEach(function (o) {
      var on = !!S.settings[o[0]];
      var row = document.createElement('div');
      row.className = 'opt';
      var label = document.createElement('span');
      label.innerHTML = '';
      label.appendChild(document.createTextNode(o[1]));
      var small = document.createElement('small');
      small.textContent = o[2];
      label.appendChild(small);
      var sw = document.createElement('button');
      sw.className = 'sw' + (on ? ' on' : '');
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      sw.setAttribute('aria-label', o[1]);
      sw.innerHTML = '<span class="kn"></span>';
      sw.addEventListener('click', function () {
        var patch = {};
        patch[o[0]] = !S.settings[o[0]];
        S.settings[o[0]] = patch[o[0]];
        window.api.patch(patch);
        renderOpts();
      });
      row.appendChild(label);
      row.appendChild(sw);
      box.appendChild(row);
    });
  }

  function renderSize() {
    $('fsz').value = S.settings.fsz;
    $('fszv').textContent = S.settings.fsz + 'px';
    $('fw').value = S.settings.fw || 600;
    $('fwv').textContent = S.settings.fw || 600;
  }

  function renderInfo() {
    $('ver').textContent = 'v' + S.version;
    if (S.update) {
      $('updmsg').textContent = '새 버전 v' + S.update.version + '이 있어요';
      $('updgo').hidden = false;
    } else {
      $('updgo').hidden = true;
    }
  }

  /* ---------- 테마 색상 ---------- */
  var T = window.Theme;
  var openKey = null, busy = false, hsvCache = {};
  var pending = {}, raf = 0;
  var GROUPS = [
    ['pkBg', [['c1', '색 1 (바탕)'], ['c2', '색 2 (번지는 색)']]],
    ['pkTx', null],
    ['pkAcc', [['acc', '강조색 (체크 · 버튼)']]]
  ];

  function sendColor(k, c) {
    S.settings[k] = c;
    pending[k] = c;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      var p = pending; pending = {};
      window.api.patch(p);
    });
  }

  function rgb2hsv(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [T.clamp((r + m) * 255), T.clamp((g + m) * 255), T.clamp((b + m) * 255)];
  }

  function renderPreview() {
    var t = T.compute(S.settings);
    var pv = $('pv');
    pv.style.backgroundImage = t.grain + ',' + t.marble;
    pv.style.backgroundSize = '160px 160px,100% 100%,100% 100%,100% 100%';
    pv.style.color = t.tx;
    pv.style.fontWeight = S.settings.fw || 600;
  }

  /* 색 고르는 판: 색 네모 + 색조 막대 + RGB 숫자 + 스포이드 */
  function buildPicker(k, onChange) {
    var c = T.get(S.settings, k);
    var hsv = hsvCache[k];
    if (!hsv || T.rgb(hsv2rgb(hsv[0], hsv[1], hsv[2])) !== T.rgb(c)) hsv = rgb2hsv(c);
    hsvCache[k] = hsv;

    var box = document.createElement('div');
    box.className = 'pkr';
    var sv = document.createElement('div');
    sv.className = 'sv';
    sv.setAttribute('aria-label', '색 고르기 (좌우: 진하기, 상하: 밝기)');
    sv.tabIndex = 0;
    var knob = document.createElement('i');
    sv.appendChild(knob);
    var hue = document.createElement('input');
    hue.type = 'range'; hue.min = 0; hue.max = 360; hue.className = 'hue';
    hue.setAttribute('aria-label', '색조');
    var row = document.createElement('div');
    row.className = 'nums';
    var nums = [];
    ['R', 'G', 'B'].forEach(function (ch) {
      var l = document.createElement('label');
      l.textContent = ch;
      var n = document.createElement('input');
      n.type = 'number'; n.min = 0; n.max = 255;
      n.setAttribute('aria-label', ch + ' 값');
      l.appendChild(n); row.appendChild(l); nums.push(n);
    });
    var eye = document.createElement('button');
    eye.type = 'button'; eye.className = 'eye'; eye.title = '화면에서 색 뽑기'; eye.setAttribute('aria-label', '화면에서 색 뽑기');
    eye.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6-3 1-7 7-4 1 1-4 7-7 1-3-1-1zM13 7l4 4"/></svg>';
    if (!window.EyeDropper) eye.style.display = 'none';
    row.appendChild(eye);
    box.appendChild(sv); box.appendChild(hue); box.appendChild(row);

    function paint() {
      var cur = hsv2rgb(hsv[0], hsv[1], hsv[2]);
      sv.style.background = 'linear-gradient(to top,#000,rgba(0,0,0,0)),linear-gradient(to right,#fff,' + T.rgb(hsv2rgb(hsv[0], 1, 1)) + ')';
      knob.style.left = (hsv[1] * 100) + '%';
      knob.style.top = ((1 - hsv[2]) * 100) + '%';
      knob.style.background = T.rgb(cur);
      hue.value = Math.round(hsv[0]);
      nums.forEach(function (n, i) { if (document.activeElement !== n) n.value = cur[i]; });
      return cur;
    }
    function commit() { var cur = paint(); hsvCache[k] = hsv; onChange(cur); }
    function pt(e) {
      var r = sv.getBoundingClientRect();
      hsv[1] = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      hsv[2] = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      commit();
    }
    sv.addEventListener('pointerdown', function (e) { busy = true; sv.setPointerCapture(e.pointerId); pt(e); });
    sv.addEventListener('pointermove', function (e) { if (sv.hasPointerCapture(e.pointerId)) pt(e); });
    sv.addEventListener('pointerup', function () { busy = false; });
    sv.addEventListener('keydown', function (e) {
      var d = e.shiftKey ? 0.1 : 0.02, used = true;
      if (e.key === 'ArrowLeft') hsv[1] = Math.max(0, hsv[1] - d);
      else if (e.key === 'ArrowRight') hsv[1] = Math.min(1, hsv[1] + d);
      else if (e.key === 'ArrowUp') hsv[2] = Math.min(1, hsv[2] + d);
      else if (e.key === 'ArrowDown') hsv[2] = Math.max(0, hsv[2] - d);
      else used = false;
      if (used) { e.preventDefault(); commit(); }
    });
    hue.addEventListener('pointerdown', function () { busy = true; });
    hue.addEventListener('pointerup', function () { busy = false; });
    hue.addEventListener('input', function () { hsv[0] = Number(hue.value); if (hsv[1] === 0) hsv[1] = 0.01; commit(); });
    nums.forEach(function (n) {
      n.addEventListener('input', function () {
        if (nums.some(function (m) { return m.value === ''; })) return;
        var v = nums.map(function (m) { return T.clamp(m.value); });
        var h = rgb2hsv(v);
        if (h[1] === 0 || h[2] === 0) h[0] = hsv[0];
        hsv = h; commit();
      });
    });
    eye.addEventListener('click', function () {
      try {
        new window.EyeDropper().open().then(function (r) {
          var hex = r.sRGBHex;
          var v = [parseInt(hex.substr(1, 2), 16), parseInt(hex.substr(3, 2), 16), parseInt(hex.substr(5, 2), 16)];
          hsv = rgb2hsv(v); commit();
        }).catch(function () {});
      } catch (e) {}
    });
    paint();
    return box;
  }

  function colorRow(k, label, host) {
    var c = T.get(S.settings, k);
    var w = document.createElement('div');
    w.className = 'cp' + (openKey === k ? ' open' : '');
    var h = document.createElement('button');
    h.type = 'button'; h.className = 'cph';
    h.setAttribute('aria-expanded', openKey === k ? 'true' : 'false');
    h.innerHTML = '<span class="nm"></span><span class="rv"></span><span class="sw2"></span>';
    h.querySelector('.nm').textContent = label;
    h.querySelector('.rv').textContent = c.join(' · ');
    h.querySelector('.sw2').style.background = T.rgb(c);
    h.addEventListener('click', function () { openKey = openKey === k ? null : k; renderPickers(); });
    w.appendChild(h);
    if (openKey === k) {
      var b = document.createElement('div');
      b.className = 'cpb';
      b.appendChild(buildPicker(k, function (cur) {
        h.querySelector('.rv').textContent = cur.join(' · ');
        h.querySelector('.sw2').style.background = T.rgb(cur);
        sendColor(k, cur);
        renderPreview();
      }));
      w.appendChild(b);
    }
    host.appendChild(w);
  }

  function renderPickers() {
    var fixed = S.settings.tmode === 'fixed';
    GROUPS.forEach(function (g) {
      var host = $(g[0]);
      host.innerHTML = '';
      if (g[1]) { g[1].forEach(function (p) { colorRow(p[0], p[1], host); }); return; }
      var seg = document.createElement('div');
      seg.className = 'seg2';
      [['auto', '자동'], ['fixed', '직접 지정']].forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = m[1];
        b.className = (fixed ? 'fixed' : 'auto') === m[0] ? 'sel' : '';
        b.addEventListener('click', function () {
          S.settings.tmode = m[0];
          window.api.patch({ tmode: m[0] });
          openKey = null;
          renderPickers(); renderPreview();
        });
        seg.appendChild(b);
      });
      host.appendChild(seg);
      var tip = document.createElement('p');
      tip.className = 'hint';
      tip.textContent = fixed ? '배경과 상관없이 항상 이 색으로 보여요.' : '배경이 진하면 아래 첫 번째 색, 밝으면 두 번째 색으로 바뀌어요.';
      host.appendChild(tip);
      if (fixed) colorRow('tf', '글자색', host);
      else { colorRow('tl', '배경이 진할 때 글자색', host); colorRow('td', '배경이 밝을 때 글자색', host); }
    });
  }

  $('fw').addEventListener('input', function () {
    S.settings.fw = Number(this.value);
    window.api.patch({ fw: S.settings.fw });
    $('fwv').textContent = this.value;
    renderPreview();
  });
  $('reseed').addEventListener('click', function () {
    S.settings.seed = Math.floor(Math.random() * 9000) + 1;
    window.api.patch({ seed: S.settings.seed });
    renderPreview();
  });

  function renderAll() {
    if (!busy && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('.pkr'))) renderPickers();
    renderPreview();
    renderTiles();
    renderOpts();
    renderSize();
    renderInfo();
  }

  $('chk').addEventListener('click', function () {
    $('updmsg').textContent = '확인하는 중…';
    window.api.checkUpdate().then(function (r) {
      if (r && r.error) $('updmsg').textContent = r.error;
      else if (r && r.version) $('updmsg').textContent = '새 버전 v' + r.version + '이 있어요';
      else $('updmsg').textContent = '지금이 최신 버전이에요';
    });
  });
  $('updgo').addEventListener('click', function () {
    $('updmsg').textContent = '받는 중… 끝나면 자동으로 다시 시작돼요';
    window.api.applyUpdate().then(function (r) {
      if (r && r.error) $('updmsg').textContent = r.error;
    });
  });

  $('fq').addEventListener('input', renderFonts);
  $('fsz').addEventListener('input', function () {
    S.settings.fsz = Number(this.value);
    $('fszv').textContent = S.settings.fsz + 'px';
    window.api.patch({ fsz: S.settings.fsz });
  });

  window.api.onState(function (s) {
    S = s;
    renderAll();
  });
  window.api.getState().then(function (s) {
    S = s;
    renderAll();
    window.api.fonts().then(function (f) {
      fonts = f;
      renderFonts();
      var sel = document.querySelector('.fo.sel');
      if (sel) sel.scrollIntoView({ block: 'center' });
    });
  });
})();
