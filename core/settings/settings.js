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

  function renderAll() {
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
