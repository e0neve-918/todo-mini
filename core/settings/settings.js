(function () {
  'use strict';
  var S = null;
  var fonts = [];
  var $ = function (id) { return document.getElementById(id); };

  var OPTS = [
    ['auto', '자동 층 전환', '바탕화면이면 맨 아래, 작업 중이면 맨 위'],
    ['lock', '위치 잠금', '위젯과 스티커가 실수로 움직이지 않게'],
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
  var openKeys = {};
  var T = window.Theme;
  var PICKS = [
    ['c1', '색 1 (바탕)'],
    ['c2', '색 2 (무늬)'],
    ['tl', '글자색 · 배경이 진할 때'],
    ['td', '글자색 · 배경이 밝을 때'],
    ['tf', '글자색 (직접 지정)'],
    ['acc', '강조색 (체크 · 버튼)']
  ];
  var pending = {}, raf = 0;

  function sendColor(k, c) {
    S.settings[k] = c;
    pending[k] = c;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      var p = pending; pending = {};
      window.api.patch(p);
    });
  }

  function renderPreview() {
    var t = T.compute(S.settings);
    var pv = $('pv');
    pv.style.backgroundImage = t.grain + ',' + t.marble;
    pv.style.backgroundSize = '160px 160px,420px 700px';
    pv.style.color = t.tx;
  }

  function renderPickers() {
    var box = $('pk');
    box.innerHTML = '';
    var fixed = S.settings.tmode === 'fixed';
    PICKS.forEach(function (p) {
      var k = p[0];
      if (k === 'tf' && !fixed) return;
      if ((k === 'tl' || k === 'td') && fixed) return;
      if (k === 'tl') box.appendChild(modeRow());
      if (k === 'tf') box.appendChild(modeRow());
      var c = T.get(S.settings, k);
      var w = document.createElement('div');
      w.className = 'cp' + (openKeys[k] ? ' open' : '');
      var h = document.createElement('button');
      h.type = 'button';
      h.className = 'cph';
      h.innerHTML = '<span class="nm"></span><span class="rv"></span><span class="sw2"></span>';
      h.querySelector('.nm').textContent = p[1];
      h.querySelector('.rv').textContent = c.join(' · ');
      h.querySelector('.sw2').style.background = T.rgb(c);
      h.addEventListener('click', function () { openKeys[k] = !openKeys[k]; w.classList.toggle('open'); });
      var b = document.createElement('div');
      b.className = 'cpb';
      ['R', 'G', 'B'].forEach(function (ch, i) {
        var row = document.createElement('div');
        row.className = 'ch ' + ch.toLowerCase();
        var lb = document.createElement('label'); lb.textContent = ch;
        var rg = document.createElement('input'); rg.type = 'range'; rg.min = 0; rg.max = 255; rg.value = c[i];
        rg.setAttribute('aria-label', p[1] + ' ' + ch);
        var nm = document.createElement('input'); nm.type = 'number'; nm.min = 0; nm.max = 255; nm.value = c[i];
        nm.setAttribute('aria-label', p[1] + ' ' + ch + ' 값');
        function upd(v) {
          var cur = T.get(S.settings, k);
          cur[i] = T.clamp(v);
          rg.value = cur[i]; nm.value = cur[i];
          h.querySelector('.rv').textContent = cur.join(' · ');
          h.querySelector('.sw2').style.background = T.rgb(cur);
          sendColor(k, cur);
          renderPreview();
        }
        rg.addEventListener('input', function () { upd(rg.value); });
        nm.addEventListener('input', function () { if (nm.value !== '') upd(nm.value); });
        row.appendChild(lb); row.appendChild(rg); row.appendChild(nm);
        b.appendChild(row);
      });
      w.appendChild(h); w.appendChild(b);
      box.appendChild(w);
    });
  }

  function modeRow() {
    var fixed = S.settings.tmode === 'fixed';
    var row = document.createElement('div');
    row.className = 'opt';
    var label = document.createElement('span');
    label.appendChild(document.createTextNode('글자색 자동 전환'));
    var small = document.createElement('small');
    small.textContent = '배경이 진하면 밝은 글자, 밝으면 진한 글자';
    label.appendChild(small);
    var sw = document.createElement('button');
    sw.className = 'sw' + (!fixed ? ' on' : '');
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', !fixed ? 'true' : 'false');
    sw.setAttribute('aria-label', '글자색 자동 전환');
    sw.innerHTML = '<span class="kn"></span>';
    sw.addEventListener('click', function () {
      S.settings.tmode = fixed ? 'auto' : 'fixed';
      window.api.patch({ tmode: S.settings.tmode });
      renderPickers(); renderPreview();
    });
    row.appendChild(label); row.appendChild(sw);
    return row;
  }

  $('reseed').addEventListener('click', function () {
    S.settings.seed = Math.floor(Math.random() * 9000) + 1;
    window.api.patch({ seed: S.settings.seed });
    renderPreview();
  });

  function renderAll() {
    if (!document.activeElement || !document.activeElement.closest || !document.activeElement.closest('#pk')) renderPickers();
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
