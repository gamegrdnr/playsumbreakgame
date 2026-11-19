/* Sum Break shared code, loaded on every page: saved progress, daily dates and streaks,
   achievements (with unlock pop-ups), and the hub, levels, daily and achievements page widgets. */
var SBX = (function () {
  'use strict';
  var KEY = 'playsumbreakgame:v1';
  var SB = window.SB || {};
  var doc = document, store = null, DAY = 864e5;
  function $(id) { return doc.getElementById(id); }
  function pad(x) { return x < 10 ? '0' + x : '' + x; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---------- storage (one object shared with the game) ----------
  function loadStore() {
    if (store) return store;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = {};
    ['solved', 'best', 'saves', 'hints', 'daily', 'ach'].forEach(function (k) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; });
    s.cur = s.cur | 0;
    store = s;
    return s;
  }
  function saveStore() { try { localStorage.setItem(KEY, JSON.stringify(loadStore())); } catch (e) { /* storage unavailable */ } }

  // ---------- daily dates (local midnight, numbered from launch) ----------
  var WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function launchUTC() { var p = String(SB.launch || '2026-11-20').split('-'); return Date.UTC(+p[0], p[1] - 1, +p[2]); }
  function todayUTC() { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function todayNum() { return Math.round((todayUTC() - launchUTC()) / DAY) + 1; }
  function dateOfNum(num) { return new Date(launchUTC() + (num - 1) * DAY); }
  function longDate(num) { var d = dateOfNum(num); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
  function sizeOfNum(num) { return [4, 4, 5][num - 1] || [7, 4, 4, 5, 5, 6, 6][dateOfNum(num).getUTCDay()]; }
  // Today's daily, an earlier one from ?day=N, or a preview of #1 before launch.
  function pickDaily(total) {
    var t = todayNum(), q = /[?&]day=(\d+)/.exec(location.search), num = t, mode = 'today';
    if (t < 1) { num = 1; mode = 'preview'; }
    if (q && t >= 1) { var r = +q[1]; if (r >= 1 && r < t) { num = r; mode = 'archive'; } }
    if (num > total) { num = total; mode = 'archive'; }
    return { num: num, index: num - 1, mode: mode, today: t, date: longDate(num) };
  }

  // A daily counts towards a streak only when it's solved on its own day.
  function streaks() {
    var d = loadStore().daily, t = todayNum(), cur = 0;
    var n = d[t] && d[t].onDay ? t : t - 1;
    while (n >= 1 && d[n] && d[n].onDay) { cur++; n--; }
    var keys = Object.keys(d).map(Number).filter(function (k) { return k > 0; }).sort(function (a, b) { return a - b; });
    var best = 0, run = 0, perfect = 0, prun = 0, prev = -1;
    keys.forEach(function (k) {
      var e = d[k], chain = prev === k - 1 && d[prev] && d[prev].onDay;
      if (!e.onDay) { run = 0; prun = 0; prev = k; return; }
      run = chain ? run + 1 : 1;
      prun = e.hints === 0 ? (chain && d[prev].hints === 0 ? prun + 1 : 1) : 0;
      if (run > best) best = run;
      if (prun > perfect) perfect = prun;
      prev = k;
    });
    return { current: cur, best: Math.max(best, cur), perfect: perfect, solved: keys.length };
  }

  // ---------- achievements ----------
  var BANDS = SB.bands || [[3, 1, 10], [4, 11, 25], [5, 26, 45], [6, 46, 65], [7, 66, 80], [8, 81, 89], [9, 90, 100]];
  var ACH = [
    { id: 'lv10', g: 'Progress', icon: '🎯', name: 'Warming up', desc: 'Solve 10 levels', goal: 10, m: 'levels' },
    { id: 'lv25', g: 'Progress', icon: '📈', name: 'Getting the hang of it', desc: 'Solve 25 levels', goal: 25, m: 'levels' },
    { id: 'lv50', g: 'Progress', icon: '⛰️', name: 'Halfway there', desc: 'Solve 50 levels', goal: 50, m: 'levels' },
    { id: 'lv100', g: 'Progress', icon: '👑', name: 'Centurion', desc: 'Solve all 100 levels', goal: 100, m: 'levels' }
  ];
  BANDS.forEach(function (b) {
    ACH.push({ id: 'size' + b[0], g: 'Progress', icon: '🧩', name: b[0] + '×' + b[0] + ' cleared', desc: 'Solve every ' + b[0] + '×' + b[0] + ' level', goal: b[2] - b[1] + 1, m: 'size', n: b[0] });
  });
  ACH = ACH.concat([
    { id: 'd1', g: 'Daily', icon: '📅', name: 'Daily debut', desc: 'Solve your first daily puzzle', goal: 1, m: 'dailies' },
    { id: 'd7', g: 'Daily', icon: '🗓️', name: 'Regular', desc: 'Solve 7 daily puzzles', goal: 7, m: 'dailies' },
    { id: 'd30', g: 'Daily', icon: '📆', name: 'Devotee', desc: 'Solve 30 daily puzzles', goal: 30, m: 'dailies' },
    { id: 'd100', g: 'Daily', icon: '🏛️', name: 'Daily legend', desc: 'Solve 100 daily puzzles', goal: 100, m: 'dailies' },
    { id: 's3', g: 'Daily', icon: '🔥', name: 'On a roll', desc: 'Reach a 3-day streak', goal: 3, m: 'streak' },
    { id: 's7', g: 'Daily', icon: '⚡', name: 'Week strong', desc: 'Reach a 7-day streak', goal: 7, m: 'streak' },
    { id: 's30', g: 'Daily', icon: '💎', name: 'Unbreakable', desc: 'Reach a 30-day streak', goal: 30, m: 'streak' },
    { id: 'perfect', g: 'Daily', icon: '🌟', name: 'Perfect week', desc: 'Solve 7 dailies in a row on the day, with no hints', goal: 7, m: 'perfect' },
    { id: 'corner', g: 'Finishing touches', icon: '📐', name: 'Cornered', desc: 'Finish with the last circle in a corner' },
    { id: 'bull', g: 'Finishing touches', icon: '🎯', name: 'Bullseye', desc: 'Finish with the last circle in the centre of a 3×3, 5×5, 7×7 or 9×9 board' },
    { id: 'full', g: 'Finishing touches', icon: '🔄', name: 'Full circle', desc: 'Finish in the same space as your first merge' },
    { id: 'fast5', g: 'Speed', icon: '⏱️', name: 'Quick thinker', desc: 'Solve a 5×5 board in under 60 seconds' },
    { id: 'fast9', g: 'Speed', icon: '🚀', name: 'Speed solver', desc: 'Solve a 9×9 board in under 5 minutes' },
    { id: 'fastd', g: 'Speed', icon: '☕', name: 'Morning coffee', desc: 'Solve a daily puzzle in under 2 minutes' },
    { id: 'clean', g: 'Skill', icon: '🧼', name: 'Clean sheet', desc: 'Solve a board with no hints and no undos' },
    { id: 'clean9', g: 'Skill', icon: '🧠', name: 'Unaided', desc: 'Solve a 9×9 board with no hints' },
    { id: 'triple', g: 'Skill', icon: '✖️', name: 'Triple threat', desc: 'Solve a board using a ×3 wildcard' }
  ]);
  var BY = {};
  ACH.forEach(function (a) { BY[a.id] = a; });

  function levelsSolved() {
    var s = loadStore().solved, k = 0;
    for (var key in s) if (/^\d+$/.test(key) && s[key]) k++;
    return k;
  }
  function progressOf(a) {
    var s = loadStore();
    if (a.m === 'levels') return levelsSolved();
    if (a.m === 'dailies') return streaks().solved;
    if (a.m === 'streak') return streaks().best;
    if (a.m === 'perfect') return streaks().perfect;
    if (a.m === 'size') {
      var b = BANDS.filter(function (x) { return x[0] === a.n; })[0], k = 0;
      for (var i = b[1]; i <= b[2]; i++) if (s.solved[i]) k++;
      return k;
    }
    return s.ach[a.id] ? 1 : 0;
  }
  function unlock(id) {
    var s = loadStore();
    if (!BY[id] || s.ach[id]) return false;
    s.ach[id] = Date.now();
    saveStore();
    toast(BY[id]);
    return true;
  }
  function checkCounts() { ACH.forEach(function (a) { if (a.goal && progressOf(a) >= a.goal) unlock(a.id); }); }
  // Called by the game when a board is solved.
  function onWin(ctx) {
    var n = ctx.n, f = ctx.finalCell, r = (f / n) | 0, c = f % n, e = n - 1;
    if ((r === 0 || r === e) && (c === 0 || c === e)) unlock('corner');
    if (n % 2 === 1 && r === e / 2 && c === e / 2) unlock('bull');
    if (ctx.firstCell === f) unlock('full');
    if (n === 5 && ctx.time < 60000) unlock('fast5');
    if (n === 9 && ctx.time < 300000) unlock('fast9');
    if (ctx.mode === 'daily' && ctx.time < 120000) unlock('fastd');
    if (ctx.hints === 0 && ctx.undos === 0) unlock('clean');
    if (n === 9 && ctx.hints === 0) unlock('clean9');
    if (ctx.usedX3) unlock('triple');
    checkCounts();
    refresh();
  }

  var queue = [], showing = false, wrap = null;
  function toast(a) { queue.push(a); if (!showing) nextToast(); }
  function nextToast() {
    var a = queue.shift();
    if (!a) { showing = false; return; }
    showing = true;
    if (!wrap) {
      wrap = doc.createElement('div');
      wrap.className = 'toasts';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      doc.body.appendChild(wrap);
    }
    var t = doc.createElement('a');
    t.className = 'toast';
    t.href = (SB.root || '') + 'achievements.html';
    t.innerHTML = '<span class="ti" aria-hidden="true"></span><span class="tt"><small>Achievement unlocked</small><strong></strong></span>';
    t.querySelector('.ti').textContent = a.icon;
    t.querySelector('strong').textContent = a.name;
    wrap.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 3000);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); nextToast(); }, 3400);
  }

  // ---------- page widgets ----------
  function initHub() {
    if (!$('dailyCard')) return;
    var s = loadStore(), t = todayNum(), st = streaks(), num = Math.max(1, t);
    $('dailyTitle').textContent = 'Daily #' + num;
    $('dailyDate').textContent = (t < 1 ? 'Starts ' : '') + longDate(num) + ', ' + sizeOfNum(num) + '×' + sizeOfNum(num);
    $('dailyStatus').textContent = t < 1 ? 'Try the preview' : s.daily[t] ? 'Solved today ✓' : s.saves['d' + t] ? 'Continue today’s puzzle' : 'Play today’s puzzle';
    $('dailyStreak').textContent = st.current ? '🔥 ' + st.current + '-day streak' : '';
    var solved = levelsSolved();
    $('levelsStatus').textContent = solved ? solved + ' of 100 solved' : 'Every level unlocked';
    if (solved || s.cur) {
      var next = s.cur + 1;
      if (s.solved[next]) for (next = 1; next <= 100 && s.solved[next]; next++);
      if (next <= 100) {
        $('continueLink').href = 'level-' + next + '.html';
        $('continueLink').textContent = 'Continue with level ' + next + ' →';
        $('continueWrap').hidden = false;
      }
    }
  }
  function markLinks() {
    var s = loadStore();
    [].forEach.call(doc.querySelectorAll('a.dot[data-l]'), function (a) {
      var done = !!s.solved[+a.getAttribute('data-l') + 1];
      a.classList.toggle('done', done);
      if (done && !a.querySelector('i')) { var tk = doc.createElement('i'); tk.setAttribute('aria-hidden', 'true'); tk.textContent = '✓'; a.appendChild(tk); }
    });
    if ($('levelsCount')) $('levelsCount').textContent = levelsSolved() + ' of 100 solved';
  }
  function renderAchievements() {
    var box = $('achList');
    if (!box) return;
    var s = loadStore(), got = 0, html = '', group = '';
    ACH.forEach(function (a) {
      var done = !!s.ach[a.id];
      if (done) got++;
      if (a.g !== group) { html += (group ? '</ul>' : '') + '<h2>' + esc(a.g) + '</h2><ul class="ach-list">'; group = a.g; }
      var bar = '';
      if (a.goal) {
        var p = Math.min(a.goal, progressOf(a));
        bar = '<div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + a.goal + '" aria-valuenow="' + p + '"><i style="width:' + (100 * p / a.goal).toFixed(1) + '%"></i></div><small>' + p + ' / ' + a.goal + '</small>';
      }
      var when = done ? '<small class="when">Unlocked ' + new Date(s.ach[a.id]).toLocaleDateString() + '</small>' : '';
      html += '<li class="ach' + (done ? ' got' : '') + '"><span class="ai" aria-hidden="true">' + a.icon + '</span><div><h3>' + esc(a.name) + (done ? ' <span class="sr">(unlocked)</span>' : '') + '</h3><p>' + esc(a.desc) + '</p>' + bar + when + '</div></li>';
    });
    box.innerHTML = html + '</ul>';
    if ($('achCount')) $('achCount').textContent = got + ' of ' + ACH.length + ' unlocked';
  }
  var cal = null;
  function renderDailyInfo() {
    var box = $('dailyInfo');
    if (!box) return;
    var s = loadStore(), st = streaks(), t = todayNum();
    if (!cal) { var d0 = dateOfNum(Math.max(1, t)); cal = { y: d0.getUTCFullYear(), m: d0.getUTCMonth() }; }
    var stat = function (label, v) { return '<div><dt>' + label + '</dt><dd>' + v + '</dd></div>'; };
    var html = '<dl class="facts dstats">' + stat('Current streak', st.current) + stat('Best streak', st.best) + stat('Dailies solved', st.solved) + stat('No-hint run', st.perfect) + '</dl>';
    var first = Date.UTC(cal.y, cal.m, 1), days = new Date(Date.UTC(cal.y, cal.m + 1, 0)).getUTCDate();
    var lead = (new Date(first).getUTCDay() + 6) % 7;
    html += '<div class="cal"><div class="cal-head"><button type="button" class="nav" data-cal="-1" aria-label="Previous month">‹</button><strong>' + MON[cal.m] + ' ' + cal.y + '</strong><button type="button" class="nav" data-cal="1" aria-label="Next month">›</button></div><div class="cal-grid">';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (w) { html += '<span class="cal-wd">' + w + '</span>'; });
    for (var i = 0; i < lead; i++) html += '<span></span>';
    for (var day = 1; day <= days; day++) {
      var num = Math.round((Date.UTC(cal.y, cal.m, day) - launchUTC()) / DAY) + 1, e = s.daily[num];
      var cls = 'cal-day' + (num === t ? ' today' : '') + (e ? (e.onDay ? ' win' : ' late') : s.saves['d' + num] ? ' tried' : '');
      if (num >= 1 && num <= t) html += '<a class="' + cls + '" href="daily.html' + (num === t ? '' : '?day=' + num) + '" aria-label="Daily #' + num + (e ? ', solved' : '') + '">' + day + '</a>';
      else html += '<span class="' + cls + ' off">' + day + '</span>';
    }
    html += '</div><p class="fine cal-key"><span class="k win"></span>Solved on the day <span class="k late"></span>Solved later <span class="k tried"></span>Started</p></div>';
    box.innerHTML = html;
    [].forEach.call(box.querySelectorAll('[data-cal]'), function (b) {
      b.addEventListener('click', function () {
        cal.m += +b.getAttribute('data-cal');
        if (cal.m < 0) { cal.m = 11; cal.y--; }
        if (cal.m > 11) { cal.m = 0; cal.y++; }
        renderDailyInfo();
      });
    });
  }
  function refresh() { renderDailyInfo(); renderAchievements(); markLinks(); }

  // Old #learn style links from the first version of the site.
  var LEGACY = { learn: 'how-to-play.html', about: 'about.html', contact: 'contact.html', privacy: 'privacy.html' };
  if ($('dailyCard') && LEGACY[(location.hash || '').slice(1)]) location.replace(LEGACY[location.hash.slice(1)]);

  loadStore();
  initHub();
  refresh();
  checkCounts();

  return {
    loadStore: loadStore, saveStore: saveStore, todayNum: todayNum, longDate: longDate, sizeOfNum: sizeOfNum,
    pickDaily: pickDaily, streaks: streaks, unlock: unlock, onWin: onWin, refresh: refresh, ACH: ACH
  };
})();
