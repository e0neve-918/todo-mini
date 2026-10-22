(function () {
  'use strict';
  var S = null;
  var ui = 'desktop';
  var filter = 'all';
  var lastIgnore = null;
  var dragWin = null;
  var dragStk = null;
  var dragRow = null;
  var editingId = null;

  var $ = function (id) { return document.getElementById(id); };
  var CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function saveTodos() { window.api.setTodos(S.todos); }

  function setIgnore(b) {
    if (lastIgnore === b) return;
    lastIgnore = b;
    window.api.ignore(b);
  }

  /* ---------- 그리기 ---------- */

  function applyLook() {
    var s = S.settings;
    var root = document.documentElement.style;
    root.setProperty('--ff', "'" + s.font + "','Malgun Gothic','Segoe UI',sans-serif");
    root.setProperty('--fs', s.fsz + 'px');
    root.setProperty('--fw', String(s.fw || 600));
    root.setProperty('--a', (0.12 + (s.opa / 100) * 0.78).toFixed(2));
    var t = window.Theme.compute(s);
    root.setProperty('--marble', t.marble);
    root.setProperty('--grain', t.grain);
    root.setProperty('--tx', t.tx); root.setProperty('--tx2', t.tx2); root.setProperty('--tx3', t.tx3);
    root.setProperty('--ln', t.ln); root.setProperty('--ln2', t.ln2); root.setProperty('--ln3', t.ln3);
    root.setProperty('--sel', t.sel); root.setProperty('--selfg', t.selFg);
    root.setProperty('--acc', t.acc); root.setProperty('--accfg', t.accFg);
    document.body.className = 'mode-' + ui;
    $('bLock').classList.toggle('on', !!s.lock);
    $('bLock').setAttribute('aria-pressed', s.lock ? 'true' : 'false');
    $('bLock').title = s.lock ? '위치 잠금 켜짐 (눌러서 풀기)' : '위치 잠금 꺼짐 (눌러서 잠그기)';
    $('lockArc').setAttribute('d', s.lock ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-1.9');
    $('opa').value = s.opa;
  }

  function sortedTodos() {
    var list = S.todos.filter(function (t) {
      if (ui === 'work') return true;
      if (filter === 'todo') return !t.done;
      if (filter === 'done') return t.done;
      return true;
    });
    var open = list.filter(function (t) { return !t.done; });
    var done = list.filter(function (t) { return t.done; });
    return open.concat(done);
  }

  function renderSeg() {
    var seg = $('seg');
    seg.innerHTML = '';
    [['all', '전체'], ['todo', '남은 일'], ['done', '완료']].forEach(function (p) {
      var b = document.createElement('button');
      b.textContent = p[1];
      b.className = filter === p[0] ? 'sel' : '';
      b.setAttribute('aria-pressed', filter === p[0] ? 'true' : 'false');
      b.addEventListener('click', function () { filter = p[0]; render(); });
      seg.appendChild(b);
    });
  }

  function renderList() {
    var list = $('list');
    list.innerHTML = '';
    var items = sortedTodos();
    if (!items.length) {
      var e = document.createElement('div');
      e.className = 'empty';
      e.textContent = ui === 'desktop' ? '할 일이 없어요' : '';
      if (e.textContent) list.appendChild(e);
    }
    items.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'row' + (t.done ? ' done' : '');
      row.setAttribute('data-id', t.id);
      if (ui === 'desktop') bindRowDrag(row, t);

      var ck = document.createElement('button');
      ck.className = 'ck' + (t.done ? ' on' : '');
      ck.setAttribute('aria-label', '완료 표시');
      ck.setAttribute('aria-pressed', t.done ? 'true' : 'false');
      ck.setAttribute('data-whit', '');
      ck.innerHTML = CHECK;
      ck.addEventListener('click', function () {
        t.done = !t.done;
        saveTodos();
        render();
      });
      row.appendChild(ck);

      if (editingId === t.id && ui === 'desktop') {
        var inp = document.createElement('input');
        inp.className = 'edit';
        inp.value = t.text;
        inp.maxLength = 80;
        inp.spellcheck = false;
        var finish = function (commit) {
          if (editingId !== t.id) return;
          editingId = null;
          if (commit) {
            var v = inp.value.trim();
            if (v) t.text = v;
            saveTodos();
          }
          render();
        };
        inp.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') finish(true);
          else if (ev.key === 'Escape') finish(false);
        });
        inp.addEventListener('blur', function () { finish(true); });
        row.appendChild(inp);
        setTimeout(function () { inp.focus(); inp.select(); }, 0);
      } else {
        var tx = document.createElement('span');
        tx.className = 'tx';
        tx.textContent = t.text;
        if (ui === 'desktop') {
          tx.title = '두 번 눌러서 고치기';
          tx.addEventListener('dblclick', function () { editingId = t.id; render(); });
        }
        row.appendChild(tx);
      }

      var del = document.createElement('button');
      del.className = 'del';
      del.setAttribute('aria-label', '삭제');
      del.title = '삭제';
      del.innerHTML = XICON;
      del.addEventListener('click', function () {
        S.todos = S.todos.filter(function (x) { return x.id !== t.id; });
        saveTodos();
        render();
      });
      row.appendChild(del);
      list.appendChild(row);
    });
  }

  /* ---------- 할 일 순서 바꾸기 (편집 화면에서 위아래로 끌기) ---------- */

  function bindRowDrag(row, t) {
    row.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || editingId) return;
      if (e.target.closest('.ck, .del, input')) return;
      dragRow = { row: row, t: t, id: e.pointerId, sy: e.clientY, on: false };
    });
  }

  // 줄을 옮기면 줄이 마우스를 놓쳐서, 움직임은 화면 전체에서 받아요
  document.addEventListener('pointermove', function (e) {
    if (!dragRow) return;
    var row = dragRow.row, t = dragRow.t;
    if (!dragRow.on) {
      if (Math.abs(e.clientY - dragRow.sy) < 5) return;
      dragRow.on = true;
      row.classList.add('dragging');
      document.body.classList.add('row-drag');
      setIgnore(false);
    }
    // 같은 묶음(남은 일끼리 / 완료끼리) 안에서만 자리를 바꿔요
    var list = $('list');
    var rows = Array.prototype.filter.call(list.children, function (r) {
      return r !== row && r.classList.contains('row') && r.classList.contains('done') === !!t.done;
    });
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i].getBoundingClientRect();
      if (e.clientY < b.top + b.height / 2) {
        if (row.nextSibling !== rows[i]) list.insertBefore(row, rows[i]);
        return;
      }
    }
    var last = rows[rows.length - 1];
    if (last && last.nextSibling !== row) list.insertBefore(row, last.nextSibling);
  });

  function endRowDrag() {
    if (!dragRow) return;
    var row = dragRow.row, was = dragRow.on;
    dragRow = null;
    row.classList.remove('dragging');
    document.body.classList.remove('row-drag');
    if (!was) return;
    // 화면에 보이는 순서대로, 원래 그 항목들이 있던 자리에 다시 채워 넣어요
    var ids = Array.prototype.map.call($('list').querySelectorAll('.row'), function (r) { return r.getAttribute('data-id'); });
    var byId = {};
    S.todos.forEach(function (x) { byId[x.id] = x; });
    var k = 0;
    S.todos = S.todos.map(function (x) { return ids.indexOf(x.id) >= 0 ? byId[ids[k++]] : x; });
    saveTodos();
    render();
  }
  document.addEventListener('pointerup', endRowDrag);
  document.addEventListener('pointercancel', endRowDrag);

  function renderStickers() {
    var layer = $('stk');
    layer.innerHTML = '';
    S.placed.forEach(function (p) {
      var lib = S.library.filter(function (l) { return l.id === p.libId; })[0];
      if (!lib) return;
      var img = document.createElement('img');
      img.className = 'stk';
      img.src = lib.url;
      img.alt = '';
      img.draggable = false;
      img.style.left = p.x + 'px';
      img.style.top = p.y + 'px';
      img.style.width = p.size + 'px';
      if (ui === 'desktop') img.setAttribute('data-hit', '');
      img.addEventListener('pointerdown', function (e) {
        if (ui !== 'desktop' || S.settings.lock || e.button !== 0) return;
        e.preventDefault();
        img.setPointerCapture(e.pointerId);
        dragStk = { p: p, img: img, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
      });
      img.addEventListener('pointermove', function (e) {
        if (!dragStk || dragStk.p !== p) return;
        p.x = Math.round(dragStk.ox + e.clientX - dragStk.sx);
        p.y = Math.round(dragStk.oy + e.clientY - dragStk.sy);
        img.style.left = p.x + 'px';
        img.style.top = p.y + 'px';
      });
      img.addEventListener('pointerup', function () {
        if (dragStk && dragStk.p === p) { dragStk = null; window.api.setPlaced(S.placed); }
      });
      img.addEventListener('wheel', function (e) {
        if (ui !== 'desktop' || S.settings.lock) return;
        e.preventDefault();
        p.size = Math.max(24, Math.min(200, Math.round(p.size * (e.deltaY < 0 ? 1.08 : 0.93))));
        img.style.width = p.size + 'px';
        window.api.setPlaced(S.placed);
      }, { passive: false });
      img.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (ui !== 'desktop' || S.settings.lock) return;
        S.placed = S.placed.filter(function (x) { return x !== p; });
        window.api.setPlaced(S.placed);
        renderStickers();
      });
      layer.appendChild(img);
    });
  }

  function render() {
    if (!S) return;
    applyLook();
    var n = S.todos.filter(function (t) { return t.done; }).length;
    $('summary').textContent = ui === 'work' ? n + ' / ' + S.todos.length : n + ' / ' + S.todos.length + ' 완료';
    var u = $('upd');
    if (S.update) {
      if (!u.getAttribute('data-busy')) u.textContent = '새 버전 ' + S.update.version + ' · 눌러서 업데이트';
      u.className = 'upd show';
    } else {
      u.className = 'upd';
    }
    renderSeg();
    renderList();
    renderStickers();
    lastIgnore = null;
    setIgnore(true);
  }

  /* ---------- 마우스: 투명한 곳은 뒤로 통과 ---------- */

  document.addEventListener('mousemove', function (e) {
    if (dragWin || dragStk || (dragRow && dragRow.on)) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var hit = false;
    if (el) hit = ui === 'desktop' ? !!el.closest('[data-hit]') : !!el.closest('[data-whit]');
    setIgnore(!hit);
  });

  /* ---------- 위젯 옮기기 ---------- */

  $('hd').addEventListener('pointerdown', function (e) {
    if (ui !== 'desktop' || S.settings.lock || e.button !== 0) return;
    var sx = e.screenX, sy = e.screenY;
    var hd = $('hd');
    var pid = e.pointerId;
    window.api.getPos().then(function (pos) {
      hd.setPointerCapture(pid);
      dragWin = { sx: sx, sy: sy, wx: pos[0], wy: pos[1] };
    });
  });
  $('hd').addEventListener('pointermove', function (e) {
    if (!dragWin) return;
    window.api.moveTo(dragWin.wx + e.screenX - dragWin.sx, dragWin.wy + e.screenY - dragWin.sy);
  });
  $('hd').addEventListener('dblclick', function () { window.api.togglePeek(); });
  $('hd').addEventListener('pointerup', function () { dragWin = null; });

  /* ---------- 아래 바, 새 할 일 ---------- */

  $('newTodo').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var v = this.value.trim();
    if (!v || S.todos.length >= 200) return;
    S.todos.push({ id: uid(), text: v, done: false });
    this.value = '';
    saveTodos();
    render();
  });
  $('opa').addEventListener('input', function () {
    S.settings.opa = Number(this.value);
    window.api.patch({ opa: S.settings.opa });
    applyLook();
  });
  $('bLock').addEventListener('click', function () {
    S.settings.lock = !S.settings.lock;
    window.api.patch({ lock: S.settings.lock });
    applyLook();
  });
  $('bOpa').addEventListener('click', function () { $('opaPop').classList.toggle('show'); });
  $('bOpa').addEventListener('wheel', function (e) {
    e.preventDefault();
    S.settings.opa = Math.max(0, Math.min(100, S.settings.opa + (e.deltaY < 0 ? 5 : -5)));
    window.api.patch({ opa: S.settings.opa });
    applyLook();
  }, { passive: false });
  $('bSet').addEventListener('click', function () { window.api.openSettings(); });
  $('bSticker').addEventListener('click', function () { window.api.addLibrary(true); });
  $('upd').addEventListener('click', function () {
    var u = $('upd');
    u.setAttribute('data-busy', '1');
    u.textContent = '받는 중… 잠시만요';
    window.api.applyUpdate().then(function (r) {
      if (r && r.error) {
        u.textContent = r.error;
        setTimeout(function () { u.removeAttribute('data-busy'); render(); }, 4000);
      }
    });
  });

  /* ---------- 시작 ---------- */

  window.api.onState(function (s) {
    if (dragStk || dragWin || dragRow) return;
    S = s;
    ui = s.mode;
    if (ui === 'work') editingId = null;
    render();
  });
  window.api.getState().then(function (s) {
    S = s;
    ui = s.mode;
    render();
  });
})();
