/*ENGINE:BEGIN*/
var Engine = (function () {
  'use strict';
  // Cell codes: 0 = empty, >0 = number, <0 = wildcard.
  var MAX = 9999;
  var WILD_LABEL = { '-1': '+1', '-2': '+2', '-3': '+3', '-4': '\u00d72', '-5': '\u00d73' };
  var NB = {};

  function nbrs(n) {
    if (NB[n]) return NB[n];
    var out = [];
    for (var i = 0; i < n * n; i++) {
      var r = (i / n) | 0, c = i % n, l = [];
      if (r > 0) l.push(i - n);
      if (c < n - 1) l.push(i + 1);
      if (r < n - 1) l.push(i + n);
      if (c > 0) l.push(i - 1);
      out.push(l);
    }
    NB[n] = out;
    return out;
  }
  function op(w, x) {
    switch (w) {
      case -1: return x + 1;
      case -2: return x + 2;
      case -3: return x + 3;
      case -4: return x * 2;
      case -5: return x * 3;
    }
    return NaN;
  }
  function canMerge(a, b) {
    if (!a || !b) return false;
    if (a > 0 && b > 0) return a === b;
    return (a > 0) !== (b > 0); // a wildcard merges with any number, never with another wildcard
  }
  function mergeValue(a, b) {
    if (a > 0 && b > 0) return a + b;
    return a < 0 ? op(a, b) : op(b, a);
  }
  function adjacent(n, a, b) {
    var d = a > b ? a - b : b - a;
    if (d === n) return true;
    return d === 1 && ((a / n) | 0) === ((b / n) | 0);
  }
  function legal(c, n, a, b) {
    var s = n * n;
    return a >= 0 && b >= 0 && a < s && b < s && a !== b && adjacent(n, a, b) && canMerge(c[a], c[b]);
  }
  // Drag a onto b: the result lands in b, a becomes empty, nothing slides in.
  function apply(c, a, b) {
    var d = c.slice();
    d[b] = mergeValue(c[a], c[b]);
    d[a] = 0;
    return d;
  }
  function count(c) {
    var k = 0;
    for (var i = 0; i < c.length; i++) if (c[i]) k++;
    return k;
  }
  function moves(c, n) {
    var nb = nbrs(n), out = [];
    for (var i = 0; i < c.length; i++) {
      if (!c[i]) continue;
      var l = nb[i];
      for (var k = 0; k < l.length; k++) if (canMerge(c[i], c[l[k]])) out.push([i, l[k]]);
    }
    return out;
  }
  function hasMove(c, n) {
    var nb = nbrs(n);
    for (var i = 0; i < c.length; i++) {
      if (c[i] <= 0) continue;
      var l = nb[i];
      for (var k = 0; k < l.length; k++) if (canMerge(c[i], c[l[k]])) return true;
    }
    return false;
  }
  // Values only ever grow and emptied cells never refill. That gives cheap proofs that a
  // position is dead:
  //  - the circles have split into two groups that can never meet again;
  //  - a number whose neighbours are all bigger numbers can never find a partner;
  //  - a smallest number can only pair with an adjacent equal number or an adjacent wildcard,
  //    and two smallest numbers cannot share one partner, so they need a matching;
  //  - with no wildcards left, every value has to pair up evenly (like binary carries).
  var B = null;
  function scratch(size) {
    if (!B || B.size < size || B.vs > 1e9 || B.os > 1e9 || B.ss > 1e9) {
      var z = Math.max(size, B ? B.size : 0);
      B = {
        size: z, seen: new Int32Array(z), ss: 0, stack: new Int32Array(z),
        owner: new Int32Array(z), own: new Int32Array(z), os: 0, vis: new Int32Array(z), vs: 0,
        cand: new Int32Array(z * 4), cn: new Int32Array(z), mins: new Int32Array(z)
      };
    }
    return B;
  }
  function augment(x) {
    var base = x * 4, cnt = B.cn[x];
    for (var q = 0; q < cnt; q++) {
      var y = B.cand[base + q];
      if (B.vis[y] === B.vs) continue;
      B.vis[y] = B.vs;
      if (B.own[y] !== B.os || augment(B.owner[y])) { B.own[y] = B.os; B.owner[y] = x; return true; }
    }
    return false;
  }
  function isDead(c, n) {
    var nb = nbrs(n), size = c.length, tiles = 0, nums = 0, wild = 0, first = -1, m = Infinity, i, k, l, v, w;
    for (i = 0; i < size; i++) {
      v = c[i];
      if (!v) continue;
      tiles++;
      if (v > 0) { nums++; if (v < m) m = v; } else wild++;
      if (first < 0) first = i;
    }
    if (tiles <= 1) return false;
    if (!nums) return true;
    scratch(size);
    var ss = ++B.ss, seen = B.seen, stack = B.stack, sp = 0, reached = 0;
    seen[first] = ss;
    stack[sp++] = first;
    while (sp) {
      i = stack[--sp];
      reached++;
      l = nb[i];
      for (k = 0; k < l.length; k++) {
        var j = l[k];
        if (c[j] && seen[j] !== ss) { seen[j] = ss; stack[sp++] = j; }
      }
    }
    if (reached < tiles) return true;
    var nm = 0;
    for (i = 0; i < size; i++) {
      v = c[i];
      if (v <= 0) continue;
      var hope = false;
      l = nb[i];
      for (k = 0; k < l.length; k++) {
        w = c[l[k]];
        if (w && (w < 0 || w <= v)) { hope = true; break; }
      }
      if (!hope) return true;
      if (v === m) {
        var cnt = 0;
        for (k = 0; k < l.length; k++) { w = c[l[k]]; if (w === m || w < 0) B.cand[i * 4 + cnt++] = l[k]; }
        if (!cnt) return true;
        B.cn[i] = cnt;
        B.mins[nm++] = i;
      }
    }
    // Smallest numbers need distinct partners: bipartite matching on the checkerboard,
    // one colour at a time (Mendelsohn-Dulmage gives a matching covering both).
    if (nm > 1 || wild) {
      for (var side = 0; side < 2; side++) {
        B.os++;
        for (var a = 0; a < nm; a++) {
          var x = B.mins[a];
          if (((((x / n) | 0) + (x % n)) & 1) !== side) continue;
          B.vs++;
          if (!augment(x)) return true;
        }
      }
    }
    if (!wild) {
      var vals = [];
      for (i = 0; i < size; i++) if (c[i] > 0) vals.push(c[i]);
      vals.sort(function (a2, b2) { return a2 - b2; });
      var prod = [], p = 0, q = 0;
      for (;;) {
        var x1 = q < vals.length ? vals[q] : Infinity, y1 = p < prod.length ? prod[p] : Infinity;
        var mm = x1 < y1 ? x1 : y1;
        if (mm === Infinity) break;
        var ct = 0;
        while (q < vals.length && vals[q] === mm) { q++; ct++; }
        while (p < prod.length && prod[p] === mm) { p++; ct++; }
        if (ct === 1 && q === vals.length && p === prod.length) break;
        if (ct & 1) return true;
        for (k = 0; k < ct / 2; k++) prod.push(mm * 2);
      }
    }
    return false;
  }
  // 53-bit position hash for the search's visited set.
  function hash(c) {
    var h1 = 0x811c9dc5, h2 = 0x2545f491;
    for (var i = 0; i < c.length; i++) {
      var v = c[i] | 0;
      h1 = Math.imul(h1 ^ v, 0x01000193);
      h2 = Math.imul(h2 ^ (v + i * 0x9e37), 0x85ebca6b);
      h2 ^= h2 >>> 13;
    }
    return (h1 >>> 0) * 2097152 + (h2 >>> 11);
  }
  // A smallest number's first merge is always with a neighbour that is equal or a wildcard,
  // and that merge can be moved to the front of any solution. So a complete search only has
  // to branch on the partners of one smallest circle: the one with the fewest options.
  function branch(c, n) {
    var nb = nbrs(n), m = Infinity, i, k;
    for (i = 0; i < c.length; i++) if (c[i] > 0 && c[i] < m) m = c[i];
    if (m === Infinity) return [];
    var best = -1, list = null;
    for (i = 0; i < c.length; i++) {
      if (c[i] !== m) continue;
      var l = nb[i], cl = [];
      for (k = 0; k < l.length; k++) { var w = c[l[k]]; if (w === m || w < 0) cl.push(l[k]); }
      if (best < 0 || cl.length < list.length) { best = i; list = cl; if (cl.length <= 1) break; }
    }
    var out = [];
    for (k = 0; k < list.length; k++) {
      var p = list[k], pen = c[p] < 0 ? 8 : 0;
      out.push([best, p, pen + degree(c, nb, best)], [p, best, pen + degree(c, nb, p)]);
    }
    out.sort(function (x, y) { return x[2] - y[2]; });
    return out;
  }
  function degree(c, nb, i) {
    var d = 0, l = nb[i];
    for (var k = 0; k < l.length; k++) if (c[l[k]]) d++;
    return d;
  }
  // Depth-first search with dead-end pruning. Call run(nodes) repeatedly until done;
  // result is the move list ([from, to] pairs) or null when the search was exhausted.
  function Solver(c, n) {
    this.n = n;
    this.nodes = 0;
    this.done = false;
    this.result = null;
    this.seen = new Set();
    this.path = [];
    this.stack = [];
    this.tiles = count(c);
    if (this.tiles <= 1) { this.done = true; this.result = []; return; }
    if (isDead(c, n)) { this.done = true; return; }
    this.stack.push({ c: c.slice(), m: branch(c, n), i: 0 });
  }
  Solver.prototype.run = function (limit) {
    var n = this.n, st = this.stack, stop = this.nodes + (limit || Infinity);
    while (!this.done && this.nodes < stop) {
      if (!st.length) { this.done = true; break; }
      var top = st[st.length - 1];
      if (top.i >= top.m.length) {
        st.pop();
        this.path.length = st.length > 0 ? st.length - 1 : 0;
        continue;
      }
      var mv = top.m[top.i++];
      this.nodes++;
      var d = apply(top.c, mv[0], mv[1]);
      if (this.tiles - st.length === 1) {
        this.path.push([mv[0], mv[1]]);
        this.result = this.path.slice();
        this.done = true;
        break;
      }
      var key = hash(d);
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      if (isDead(d, n)) continue;
      this.path.push([mv[0], mv[1]]);
      st.push({ c: d, m: branch(d, n), i: 0 });
    }
    return this;
  };
  // Replays a level's stored solution with the same rules the game uses.
  function verify(L) {
    function fail(msg) { return { ok: false, reason: msg }; }
    if (!L || !L.n || !L.c || L.c.length !== L.n * L.n) return fail('bad board size');
    var n = L.n, c = L.c.slice(), s = L.s || [], t = count(c), i;
    if (t < 2) return fail('fewer than two circles');
    for (i = 0; i < c.length; i++) {
      var v = c[i];
      if (v !== (v | 0)) return fail('non-integer cell');
      if (v > MAX) return fail('number over ' + MAX);
      if (v < 0 && !WILD_LABEL[v]) return fail('unknown wildcard');
    }
    if (s.length !== 2 * (t - 1)) return fail('solution length ' + s.length / 2 + ', expected ' + (t - 1));
    for (i = 0; i < s.length; i += 2) {
      if (!legal(c, n, s[i], s[i + 1])) return fail('illegal move ' + (i / 2 + 1));
      c = apply(c, s[i], s[i + 1]);
      if (c[s[i + 1]] > MAX) return fail('value over ' + MAX + ' at move ' + (i / 2 + 1));
    }
    if (count(c) !== 1) return fail('more than one circle left');
    for (i = 0; i < c.length; i++) if (c[i]) return { ok: true, final: c[i], moves: t - 1 };
    return fail('empty board');
  }
  function label(v) { return v > 0 ? String(v) : (WILD_LABEL[v] || '?'); }
  return {
    MAX: MAX, WILD_LABEL: WILD_LABEL, nbrs: nbrs, op: op, canMerge: canMerge, mergeValue: mergeValue,
    adjacent: adjacent, legal: legal, apply: apply, count: count, moves: moves, hasMove: hasMove,
    isDead: isDead, hash: hash, branch: branch, Solver: Solver, verify: verify, label: label
  };
})();
/*ENGINE:END*/

(function () {
  'use strict';
  var E = Engine;
  var KEY = 'playsumbreakgame:v1';
  // Set by each page: root = relative path to the site root, level = fixed level on level-N.html pages.
  var SB = window.SB || { root: '' };
  var SITE = SB.site || 'https://playsumbreakgame.xyz/';
  var FIXED = typeof SB.level === 'number';
  var DAILY = SB.daily ? SB.dailyInfo : null;
  function SID() { return DAILY ? 'd' + DAILY.num : String(L + 1); }
  var HINT_MS = 1500;
  var doc = document, root = doc.documentElement;
  function $(id) { return doc.getElementById(id); }
  var gridEl = $('grid'), trayEl = $('tray'), stageEl = $('stage'), statusEl = $('status');
  var timerEl = $('timer'), movesEl = $('moves'), lvlEl = $('lvl'), sizeEl = $('size'), tickEl = $('tick');
  var undoBtn = $('undo'), restartBtn = $('restart'), hintBtn = $('hint');
  var prevBtn = $('prev'), nextBtn = $('next'), levelsBtn = $('levels');
  var sheet = $('sheet'), sheetList = $('sheetList'), sheetCount = $('sheetCount'), sheetClose = $('sheetClose');
  var winEl = $('win'), winTitle = $('winTitle'), winTime = $('winTime'), winBest = $('winBest');
  var winNext = $('winNext'), winAgain = $('winAgain'), winShare = $('winShare'), lastResult = null, gameEl = $('game'), homeEl = $('home'), hintCountEl = $('hintCount');
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var store = load();
  var L = 0, lv = null, n = 3, init = [], cells = [], hist = [], states = [];
  var sel = -1, won = false, busy = false, drag = null, hint = null, hintCache = null, solKeys = null, search = null;
  var tiles = [], cellPx = 40, lastFocus = null, fxEl = null, arrowEl = null, viewPause = false;
  var HINT_MAX = SB.daily ? 1 : 3;
  var undos = 0;
  var clock = { acc: 0, since: 0, on: false }, hiddenPause = false;

  // ---------- storage ----------
  function load() { return SBX.loadStore(); }
  function persist() {
    if (!DAILY) store.cur = L;
    if (lv) {
      if (!won && hist.length) {
        var m = [];
        for (var i = 0; i < hist.length; i++) m.push(hist[i][0], hist[i][1]);
        store.saves[SID()] = { m: m, t: Math.round(elapsed()) };
      } else {
        delete store.saves[SID()];
      }
    }
    SBX.saveStore();
  }

  // ---------- clock ----------
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function elapsed() { return clock.acc + (clock.on ? now() - clock.since : 0); }
  function clockStart() { if (!clock.on) { clock.on = true; clock.since = now(); } }
  function clockStop() { if (clock.on) { clock.acc += now() - clock.since; clock.on = false; } }
  function pad(x) { return x < 10 ? '0' + x : '' + x; }
  function fmt(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
  }
  function tickClock() { timerEl.textContent = fmt(elapsed()); }

  // ---------- colour ----------
  var tintCache = {};
  function hsl2rgb(h, s, l) {
    s /= 100; l /= 100;
    var k = function (x) { return (x + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (x) { return l - a * Math.max(-1, Math.min(k(x) - 3, Math.min(9 - k(x), 1))); };
    return [f(0), f(8), f(4)];
  }
  function lum(rgb) {
    var ch = function (v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
  }
  function tint(v, dark) {
    var key = (dark ? 'd' : 'l') + v;
    if (tintCache[key]) return tintCache[key];
    // v = odd * 2^k: the power of two and the odd part each move the hue, so doubling
    // a number always changes its colour clearly.
    var k = 0, odd = v;
    while (odd % 2 === 0) { odd /= 2; k++; }
    var h = (k * 67 + ((Math.imul(odd, 0x9e3779b1) >>> 0) % 360) + 200) % 360;
    var step = k % 3;
    var s = dark ? 64 : 74;
    var l = dark ? [46, 37, 55][step] : [55, 45, 64][step];
    var Y = lum(hsl2rgb(h, s, l));
    var fg = (1.05 / (Y + 0.05)) >= ((Y + 0.05) / 0.0603) ? '#FFFFFF' : '#141A24';
    return (tintCache[key] = { bg: 'hsl(' + h.toFixed(1) + ',' + s + '%,' + l + '%)', fg: fg });
  }
  function isDark() { return getComputedStyle(root).getPropertyValue('--mode').trim() === 'dark'; }

  // ---------- board ----------
  function buildGrid() {
    gridEl.textContent = '';
    gridEl.style.setProperty('--n', n);
    tiles = [];
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < n * n; i++) {
      var cell = doc.createElement('div');
      cell.className = 'cell';
      var t = doc.createElement('div');
      t.className = 'tile empty';
      cell.appendChild(t);
      frag.appendChild(cell);
      tiles.push(t);
    }
    gridEl.appendChild(frag);
    fxEl = doc.createElement('div');
    fxEl.className = 'fx';
    arrowEl = doc.createElement('div');
    arrowEl.className = 'arrow';
    arrowEl.hidden = true;
    arrowEl.innerHTML = '<svg viewBox="0 0 120 48" aria-hidden="true"><path d="M8 14h58V3l48 21-48 21V34H8z"/></svg>';
    fxEl.appendChild(arrowEl);
    gridEl.appendChild(fxEl);
    fit();
  }
  function fit() {
    var side = Math.floor(Math.min(stageEl.clientWidth, stageEl.clientHeight));
    if (side < 120) side = 120;
    trayEl.style.width = side + 'px';
    trayEl.style.height = side + 'px';
    cellPx = gridEl.clientWidth / n;
    gridEl.style.setProperty('--cell', cellPx + 'px');
  }
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function render() {
    var dark = isDark(), hasSel = sel >= 0;
    for (var i = 0; i < tiles.length; i++) {
      var el = tiles[i], v = cells[i], cls = 'tile';
      if (!v) {
        cls += ' empty';
        setText(el, '');
      } else if (v < 0) {
        cls += ' wild';
        setText(el, E.label(v));
        el.removeAttribute('data-d');
      } else {
        var t = tint(v, dark), s = String(v);
        cls += ' num';
        el.style.setProperty('--c', t.bg);
        el.style.setProperty('--fg', t.fg);
        setText(el, s);
        el.setAttribute('data-d', String(s.length));
      }
      if (v) {
        if (i === sel) cls += ' sel';
        else if (hasSel && E.legal(cells, n, sel, i)) cls += ' target';
        if (hint && i === hint[0]) cls += ' hint-from';
        if (hint && i === hint[1]) cls += ' hint-to';
        if (drag && drag.moved && i === drag.i) cls += ' dragging';
        if (drag && drag.moved && i === drag.over) cls += ' over';
      }
      if (el.className !== cls) el.className = cls;
    }
    undoBtn.disabled = !hist.length || won;
    restartBtn.disabled = !hist.length && !won;
    updateHintBtn();
    if (hint) placeArrow(hint); else if (arrowEl) arrowEl.hidden = true;
  }
  function placeArrow(mv) {
    if (!arrowEl) return;
    var a = mv[0], b = mv[1];
    var ax = (a % n + 0.5) * cellPx, ay = (((a / n) | 0) + 0.5) * cellPx;
    var bx = (b % n + 0.5) * cellPx, by = (((b / n) | 0) + 0.5) * cellPx;
    var h = Math.max(22, cellPx * 0.62), w = Math.max(cellPx * 1.12, h * 2.3), deg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    arrowEl.style.width = w + 'px';
    arrowEl.style.height = h + 'px';
    arrowEl.style.transform = 'translate(' + ((ax + bx) / 2 - w / 2) + 'px,' + ((ay + by) / 2 - h / 2) + 'px) rotate(' + deg + 'deg)';
    arrowEl.hidden = false;
  }
  // A ring and sparks in the new circle's colour, drawn on the effects layer over the board.
  function burst(i, v, big) {
    if (reduceMotion || !fxEl) return;
    var col = v > 0 ? tint(v, isDark()).bg : 'var(--hint)', scale = big ? 1.8 : 1;
    var cx = (i % n + 0.5) * cellPx, cy = (((i / n) | 0) + 0.5) * cellPx, d = cellPx * 0.9 * scale, made = [];
    var ring = doc.createElement('span');
    ring.className = 'ring';
    ring.style.cssText = 'left:' + (cx - d / 2) + 'px;top:' + (cy - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px;--b:' + col;
    fxEl.appendChild(ring);
    made.push(ring);
    var count = big ? 16 : 8, sz = Math.max(4, cellPx * 0.12);
    for (var k = 0; k < count; k++) {
      var ang = (k / count) * Math.PI * 2 + Math.random() * 0.5, dist = cellPx * (0.5 + Math.random() * 0.3) * scale;
      var sp = doc.createElement('span');
      sp.className = 'spark';
      sp.style.cssText = 'left:' + (cx - sz / 2) + 'px;top:' + (cy - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;--b:' + col +
        ';--dx:' + (Math.cos(ang) * dist).toFixed(1) + 'px;--dy:' + (Math.sin(ang) * dist).toFixed(1) + 'px';
      fxEl.appendChild(sp);
      made.push(sp);
    }
    setTimeout(function () { made.forEach(function (m) { if (m.parentNode) m.parentNode.removeChild(m); }); }, 700);
  }
  function pop(i) {
    if (reduceMotion) return;
    var el = tiles[i];
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
  function cellAt(x, y) {
    var r = gridEl.getBoundingClientRect();
    var cx = Math.floor((x - r.left) / (r.width / n)), cy = Math.floor((y - r.top) / (r.height / n));
    if (cx < 0 || cy < 0 || cx >= n || cy >= n) return -1;
    return cy * n + cx;
  }

  // ---------- status / HUD ----------
  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }
  function updateHud() {
    lvlEl.textContent = DAILY ? 'Daily #' + DAILY.num : 'Level ' + (L + 1);
    sizeEl.textContent = n + '×' + n;
    tickEl.hidden = !store.solved[SID()];
    movesEl.textContent = hist.length + (hist.length === 1 ? ' move' : ' moves');
    prevBtn.disabled = L <= 0;
    nextBtn.disabled = L >= LEVELS.length - 1;
    tickClock();
  }

  // ---------- level flow ----------
  function loadLevel(i) {
    cancelSearch();
    hideWin();
    L = Math.max(0, Math.min(LEVELS.length - 1, i | 0));
    lv = LEVELS[L];
    n = lv.n;
    init = lv.c.slice();
    cells = init;
    hist = [];
    states = [init];
    sel = -1; won = false; busy = false; drag = null; hint = null; hintCache = null; undos = 0;
    solKeys = new Map();
    var c = init, k;
    for (k = 0; k < lv.s.length; k += 2) {
      solKeys.set(c.join(','), k / 2);
      c = E.apply(c, lv.s[k], lv.s[k + 1]);
    }
    clock = { acc: 0, since: 0, on: false };
    var save = store.saves[SID()];
    if (save && Array.isArray(save.m)) {
      for (k = 0; k + 1 < save.m.length; k += 2) {
        if (!E.legal(cells, n, save.m[k], save.m[k + 1])) break;
        cells = E.apply(cells, save.m[k], save.m[k + 1]);
        hist.push([save.m[k], save.m[k + 1]]);
        states.push(cells);
      }
      clock.acc = +save.t || 0;
      if (hist.length && E.count(cells) > 1) clockStart();
    }
    buildGrid();
    render();
    updateHud();
    setStatus(hist.length ? 'Picked up where you left off.' : DAILY ? (DAILY.mode === 'preview' ? 'Preview: Daily #1 goes live on ' + DAILY.date + '.' : DAILY.mode === 'archive' ? 'Daily #' + DAILY.num + ' from ' + DAILY.date + '. Past dailies don’t count towards your streak.' : 'Today’s daily: one hint, so make it count.') : (L === 0 ? 'Drag a circle onto a matching neighbour, or tap one then the other.' : ''));
    if (hist.length && !E.hasMove(cells, n) && E.count(cells) > 1) setStatus('No moves left. Undo or restart.', 'warn');
    persist();
  }
  function commit(a, b, fromDrag) {
    if (busy || won || !E.legal(cells, n, a, b)) return;
    cancelSearch();
    var next = E.apply(cells, a, b);
    hint = null;
    sel = -1;
    var el = tiles[a];
    var finish = function () {
      el.classList.remove('moving');
      el.style.transition = 'none';
      el.style.transform = '';
      void el.offsetWidth;
      el.style.transition = '';
      cells = next;
      hist.push([a, b]);
      states.push(next);
      clockStart();
      busy = false;
      render();
      pop(b);
      burst(b, next[b], false);
      afterMove();
    };
    if (fromDrag || reduceMotion) { finish(); return; }
    busy = true;
    render();
    var dx = ((b % n) - (a % n)) * cellPx, dy = (((b / n) | 0) - ((a / n) | 0)) * cellPx;
    el.classList.add('moving');
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.84)';
    setTimeout(finish, 135);
  }
  function afterMove() {
    updateHud();
    if (E.count(cells) === 1) { win(); return; }
    if (!E.hasMove(cells, n)) setStatus('No moves left. Undo or restart.', 'warn');
    else setStatus('');
    persist();
  }
  function undo() {
    if (busy || won || !hist.length) return;
    cancelSearch();
    hist.pop();
    states.pop();
    undos++;
    cells = states[states.length - 1];
    sel = -1; hint = null;
    render();
    afterMove();
  }
  function restart() {
    if (busy) return;
    cancelSearch();
    hideWin();
    cells = init; hist = []; states = [init];
    sel = -1; hint = null; won = false; undos = 0;
    clock = { acc: 0, since: 0, on: false };
    render();
    updateHud();
    setStatus('');
    persist();
  }
  function win() {
    won = true;
    clockStop();
    var t = Math.round(elapsed());
    var first = !store.solved[SID()];
    var prev = store.best[SID()];
    lastResult = { level: L + 1, daily: DAILY ? DAILY.num : 0, n: n, time: t, moves: hist.length, hints: hintsUsed(), undos: undos };
    store.solved[SID()] = 1;
    delete store.hints[SID()];
    if (!prev || t < prev) store.best[SID()] = t;
    if (DAILY && !store.daily[DAILY.num]) store.daily[DAILY.num] = { t: t, hints: lastResult.hints, moves: hist.length, onDay: DAILY.mode === 'today' };
    persist();
    render();
    updateHud();
    setStatus('Solved!', 'good');
    winTitle.textContent = DAILY ? 'Daily #' + DAILY.num + ' solved' : 'Level ' + (L + 1) + ' solved';
    winTime.textContent = 'Time ' + fmt(t) + ' in ' + hist.length + ' moves';
    winBest.textContent = first ? 'First clear' : (t < prev ? 'New best time' : 'Best ' + fmt(prev));
    var last = L >= LEVELS.length - 1;
    winNext.textContent = DAILY ? 'Play the 100 levels' : last ? 'Choose a level' : 'Next level';
    var finalCell = 0, usedX3 = false;
    for (var fc = 0; fc < cells.length; fc++) if (cells[fc]) finalCell = fc;
    for (var hk = 0; hk < hist.length; hk++) if (states[hk][hist[hk][0]] === -5 || states[hk][hist[hk][1]] === -5) usedX3 = true;
    SBX.onWin({ mode: DAILY ? 'daily' : 'level', n: n, time: t, hints: lastResult.hints, undos: undos, finalCell: finalCell, firstCell: hist[0][1], usedX3: usedX3 });
    winShare.textContent = 'Share result';
    markLinks();
    celebrate();
    setTimeout(function () {
      if (!won) return;
      lastFocus = doc.activeElement;
      winEl.hidden = false;
      winNext.focus();
    }, reduceMotion ? 0 : 1250);
  }
  function hideWin() {
    if (!winEl.hidden) {
      winEl.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }

  // ---------- hints ----------
  function knownMove(key) {
    if (hintCache && hintCache.has(key)) return hintCache.get(key);
    if (solKeys.has(key)) { var j = solKeys.get(key); return [lv.s[2 * j], lv.s[2 * j + 1]]; }
    return null;
  }
  function remember(from, path) {
    hintCache = new Map();
    var c = from;
    for (var i = 0; i < path.length; i++) {
      hintCache.set(c.join(','), path[i]);
      c = E.apply(c, path[i][0], path[i][1]);
    }
  }
  function hintsUsed() { return +(store.hints[SID()] || 0); }
  function updateHintBtn() {
    var left = Math.max(0, HINT_MAX - hintsUsed());
    hintCountEl.textContent = String(left);
    hintBtn.disabled = won || left === 0;
    hintBtn.setAttribute('aria-label', 'Hint, ' + left + ' left');
  }
  function showHint(mv) {
    hint = mv;
    var a = mv[0], b = mv[1], d = b - a, k = cellPx * 0.14;
    var dir = d === 1 ? 'right' : d === -1 ? 'left' : d > 0 ? 'down' : 'up';
    tiles[a].style.setProperty('--nx', (d === 1 ? k : d === -1 ? -k : 0) + 'px');
    tiles[a].style.setProperty('--ny', (d === n ? k : d === -n ? -k : 0) + 'px');
    render();
    var left = HINT_MAX - hintsUsed();
    setStatus('Hint: drag the ' + E.label(cells[a]) + ' ' + dir + ' onto the ' + E.label(cells[b]) + '. ' +
      (left ? left + (left === 1 ? ' hint' : ' hints') + ' left.' : 'That was your last hint for this level.'), 'hint');
  }
  function useHint(mv) {
    store.hints[SID()] = hintsUsed() + 1;
    persist();
    showHint(mv);
  }
  function cancelSearch() {
    if (!search) return;
    clearTimeout(search.timer);
    search = null;
    hintBtn.classList.remove('busy');
    hintBtn.removeAttribute('aria-busy');
  }
  // Hints never change the board. They find a move from the current position; if there is
  // none, they say how many moves to undo and don't use up a hint.
  function requestHint() {
    if (busy || won || search || !lv || E.count(cells) <= 1) return;
    if (hintsUsed() >= HINT_MAX) { setStatus('No hints left for this level. Solve it to get 3 more next time.', 'warn'); return; }
    sel = -1;
    hint = null;
    render();
    var known = knownMove(cells.join(','));
    if (known) { useHint(known); return; }
    var S = new E.Solver(cells, n), from = cells, started = now();
    search = { S: S, timer: 0 };
    hintBtn.classList.add('busy');
    hintBtn.setAttribute('aria-busy', 'true');
    setStatus('Looking for a route from here…');
    var step = function () {
      if (!search || search.S !== S) return;
      var t0 = now();
      while (!S.done && now() - t0 < 12) S.run(120);
      if (!S.done && now() - started < HINT_MS) { search.timer = setTimeout(step, 0); return; }
      cancelSearch();
      if (cells !== from) return;
      if (S.result && S.result.length) { remember(from, S.result); useHint(S.result[0]); }
      else stuckAdvice(S.done);
    };
    search.timer = setTimeout(step, 20);
  }
  function stuckAdvice(proven) {
    var back = -1, t0 = now();
    for (var h = states.length - 2; h >= 0; h--) {
      var c = states[h], key = c.join(',');
      if (solKeys.has(key) || (hintCache && hintCache.has(key))) { back = states.length - 1 - h; break; }
      if (now() - t0 > 600) continue;
      if (new E.Solver(c, n).run(15000).result) { back = states.length - 1 - h; break; }
    }
    setStatus((proven ? 'This board can’t be finished from here' : 'No route found from here') + ', so no hint was used. ' +
      (back > 0 ? 'Undo ' + back + (back === 1 ? ' move' : ' moves') + ' to get back on track.' : 'Try undoing a move or two.'), 'warn');
    if (!reduceMotion) {
      undoBtn.classList.remove('attention');
      void undoBtn.offsetWidth;
      undoBtn.classList.add('attention');
      setTimeout(function () { undoBtn.classList.remove('attention'); }, 3000);
    }
  }

  // ---------- input ----------
  function tap(i) {
    if (sel < 0) sel = i;
    else if (sel === i) sel = -1;
    else if (E.legal(cells, n, sel, i)) { var a = sel; sel = -1; commit(a, i, false); return; }
    else sel = i;
    render();
  }
  function dragTarget(d, x, y) {
    var j = cellAt(x, y);
    if (j >= 0 && j !== d.i && E.legal(cells, n, d.i, j)) return j;
    var dx = x - d.x, dy = y - d.y, m = Math.max(Math.abs(dx), Math.abs(dy));
    if (m < cellPx * 0.35 || m > cellPx * 1.6) return -1;
    var col = d.i % n, t;
    if (Math.abs(dx) > Math.abs(dy)) t = dx > 0 ? (col < n - 1 ? d.i + 1 : -1) : (col > 0 ? d.i - 1 : -1);
    else t = dy > 0 ? d.i + n : d.i - n;
    return (t >= 0 && t < n * n && E.legal(cells, n, d.i, t)) ? t : -1;
  }
  function snapBack(i) {
    var el = tiles[i];
    el.style.transform = '';
    render();
  }
  gridEl.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || won || busy || drag) return;
    var i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    if (!cells[i]) { if (sel >= 0) { sel = -1; render(); } return; }
    drag = { i: i, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, over: -1 };
    try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  gridEl.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (dx * dx + dy * dy < 64) return;
      drag.moved = true;
      sel = drag.i;
      hint = null;
    }
    tiles[drag.i].style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.06)';
    drag.over = dragTarget(drag, e.clientX, e.clientY);
    render();
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    try { gridEl.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!d.moved) { if (!cancelled) tap(d.i); return; }
    var t = cancelled ? -1 : dragTarget(d, e.clientX, e.clientY);
    sel = -1;
    if (t >= 0) commit(d.i, t, true);
    else snapBack(d.i);
  }
  gridEl.addEventListener('pointerup', function (e) { endDrag(e, false); });
  gridEl.addEventListener('pointercancel', function (e) { endDrag(e, true); });
  gridEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  undoBtn.addEventListener('click', undo);
  restartBtn.addEventListener('click', restart);
  hintBtn.addEventListener('click', requestHint);
  prevBtn.addEventListener('click', function () { if (L > 0) goLevel(L - 1); });
  nextBtn.addEventListener('click', function () { if (L < LEVELS.length - 1) goLevel(L + 1); });
  levelsBtn.addEventListener('click', function () { if (DAILY) location.href = SB.root + 'levels.html'; else openSheet(); });
  sheetClose.addEventListener('click', closeSheet);
  winNext.addEventListener('click', function () {
    if (DAILY) { location.href = SB.root + 'levels.html'; return; }
    if (L >= LEVELS.length - 1) { hideWin(); openSheet(); } else goLevel(L + 1);
  });
  winAgain.addEventListener('click', restart);
  winShare.addEventListener('click', shareResult);
  function goLevel(i) {
    if (FIXED && i !== SB.level) { location.href = SB.root + 'level-' + (i + 1) + '.html'; return; }
    loadLevel(i);
  }

  // ---------- sharing ----------
  // Short, Wordle-style result: no board picture, and a bare address so apps show a small link (or none)
  // rather than a big preview card.
  function shareText(r) {
    var host = SITE.replace(/^https?:\/\//, '').replace(/\/$/, '');
    var stars = r.hints ? '⭐' : r.undos ? '⭐⭐' : '⭐⭐⭐';
    var how = r.hints ? r.hints + (r.hints === 1 ? ' hint' : ' hints') : r.undos ? 'No hints' : 'No hints, no undos';
    return [
      (r.daily ? 'Sum Break Daily #' + r.daily : 'Sum Break Level ' + r.level) + ' 🧩',
      r.n + '×' + r.n + ' cleared in ' + fmt(r.time),
      stars + ' ' + how,
      host + '/' + (r.daily ? 'daily' : 'level-' + r.level)
    ].join('\n');
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    doc.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
    doc.body.removeChild(ta);
    return ok;
  }
  function shareResult() {
    if (!lastResult) return;
    var text = shareText(lastResult);
    var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.share) {
      navigator.share({ text: text }).catch(function () {});
      return;
    }
    copyText(text).then(function (ok) {
      winShare.textContent = ok ? 'Copied! Paste it anywhere' : 'Couldn’t copy, sorry';
      setTimeout(function () { winShare.textContent = 'Share result'; }, 2500);
    });
  }
  function markLinks() {
    [].forEach.call(doc.querySelectorAll('a.dot[data-l]'), function (a) {
      var done = !!store.solved[+a.getAttribute('data-l') + 1];
      a.classList.toggle('done', done);
      if (done && !a.querySelector('i')) { var tk = doc.createElement('i'); tk.setAttribute('aria-hidden', 'true'); tk.textContent = '✓'; a.appendChild(tk); }
    });
  }

  // ---------- level picker ----------
  function openSheet() {
    cancelSearch();
    sheetList.textContent = '';
    var solved = 0, groups = [], i;
    for (i = 0; i < LEVELS.length; i++) {
      var g = groups[groups.length - 1];
      if (!g || g.n !== LEVELS[i].n) groups.push({ n: LEVELS[i].n, from: i, to: i });
      else g.to = i;
    }
    groups.forEach(function (g) {
      var sec = doc.createElement('section');
      sec.className = 'band';
      var h = doc.createElement('h3');
      var b1 = doc.createElement('span');
      b1.textContent = g.n + '×' + g.n;
      var b2 = doc.createElement('small');
      b2.textContent = 'Levels ' + (g.from + 1) + '–' + (g.to + 1);
      h.appendChild(b1);
      h.appendChild(b2);
      var wrap = doc.createElement('div');
      wrap.className = 'dots';
      for (var k = g.from; k <= g.to; k++) {
        var done = !!store.solved[k + 1];
        if (done) solved++;
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'dot' + (done ? ' done' : '') + (k === L ? ' current' : '');
        b.setAttribute('data-l', String(k));
        b.setAttribute('aria-label', 'Level ' + (k + 1) + (done ? ', solved' : '') + (store.saves[k + 1] ? ', in progress' : ''));
        b.textContent = String(k + 1);
        if (done) { var tk = doc.createElement('i'); tk.setAttribute('aria-hidden', 'true'); tk.textContent = '✓'; b.appendChild(tk); }
        wrap.appendChild(b);
      }
      sec.appendChild(h);
      sec.appendChild(wrap);
      sheetList.appendChild(sec);
    });
    sheetCount.textContent = solved + ' of ' + LEVELS.length + ' solved';
    lastFocus = doc.activeElement;
    sheet.hidden = false;
    root.classList.add('lock');
    var cur = sheetList.querySelector('[data-l="' + L + '"]');
    if (cur) {
      if (cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
      cur.focus({ preventScroll: true });
    }
  }
  function closeSheet() {
    sheet.hidden = true;
    root.classList.remove('lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  sheetList.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.dot') : null;
    if (!b) return;
    closeSheet();
    goLevel(+b.getAttribute('data-l'));
  });

  // ---------- global ----------
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!sheet.hidden) closeSheet();
      else if (sel >= 0) { sel = -1; render(); }
      return;
    }
    if (!sheet.hidden || !winEl.hidden || e.altKey || gameEl.hidden) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'z' || k === 'u') { e.preventDefault(); undo(); }
    else if (k === 'h' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); requestHint(); }
  });
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) {
      if (clock.on) { clockStop(); hiddenPause = true; }
      persist();
    } else if (hiddenPause) {
      hiddenPause = false;
      if (!won && hist.length) clockStart();
    }
  });
  window.addEventListener('pagehide', persist);
  if (window.ResizeObserver) new ResizeObserver(function () { if (lv) { fit(); render(); } }).observe(stageEl);
  else window.addEventListener('resize', function () { if (lv) fit(); });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', themeChanged); else if (mq.addListener) mq.addListener(themeChanged);
  }
  if (window.MutationObserver) new MutationObserver(themeChanged).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  setInterval(tickClock, 250);

  // ---------- celebration ----------
  function celebrate() {
    if (reduceMotion) return;
    var idx = -1;
    for (var i = 0; i < cells.length; i++) if (cells[i]) { idx = i; break; }
    if (idx < 0) return;
    setTimeout(function () {
      if (!won) return;
      var el = tiles[idx];
      el.classList.add('champion');
      burst(idx, cells[idx], true);
      var r = el.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2);
    }, 260);
  }
  function confetti(x, y) {
    var cv = doc.createElement('canvas');
    cv.className = 'confetti';
    cv.setAttribute('aria-hidden', 'true');
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    var g = cv.getContext && cv.getContext('2d');
    if (!g) return;
    doc.body.appendChild(cv);
    g.scale(dpr, dpr);
    var dark = isDark(), cols = [2, 4, 8, 16, 32, 64, 128, 256].map(function (v) { return tint(v, dark).bg; }), P = [];
    for (var i = 0; i < 160; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.15, sp = 6 + Math.random() * 9;
      P.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, c: cols[i % cols.length], round: Math.random() < 0.35 });
    }
    var start = now(), last = start;
    var frame = function () {
      var t = now(), dt = Math.min(2, (t - last) / 16.7), age = t - start;
      last = t;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = age > 1700 ? Math.max(0, 1 - (age - 1700) / 600) : 1;
      for (var k = 0; k < P.length; k++) {
        var p = P[k];
        p.vy += 0.32 * dt;
        p.vx *= Math.pow(0.985, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r);
        g.fillStyle = p.c;
        if (p.round) { g.beginPath(); g.arc(0, 0, p.h / 2, 0, 6.283); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        g.restore();
      }
      if (age < 2300) requestAnimationFrame(frame); else if (cv.parentNode) cv.parentNode.removeChild(cv);
    };
    requestAnimationFrame(frame);
  }

  function themeChanged() { if (lv) render(); }
  var LEGACY = { learn: 'how-to-play.html', about: 'about.html', contact: 'contact.html', privacy: 'privacy.html' };
  var legacy = LEGACY[(location.hash || '').slice(1)];
  if (legacy && !FIXED) { location.replace(SB.root + legacy); return; }

  if (!LEVELS.length) {
    setStatus('No levels yet. Run node tools/generate-levels.js.', 'warn');
    return;
  }
  loadLevel(FIXED ? SB.level : DAILY ? 0 : store.cur);
  markLinks();
})();
