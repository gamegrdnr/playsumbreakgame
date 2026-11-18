#!/usr/bin/env node
/*
 * Sum Break level generator.
 *
 *   node tools/generate-levels.js            build all 100 levels and write them into index.html
 *   node tools/generate-levels.js --check    verify the levels already in index.html, change nothing
 *   node tools/generate-levels.js --seed=7   build with a different seed (default is fixed, so output is reproducible)
 *
 * The rules engine is read from index.html (between the ENGINE markers), so the generator,
 * the checker and the game always use the same code. No dependencies beyond Node itself.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const ENGINE_BEGIN = '/*ENGINE:BEGIN*/';
const ENGINE_END = '/*ENGINE:END*/';
const LEVELS_BEGIN = '/*LEVELS:BEGIN*/';
const LEVELS_END = '/*LEVELS:END*/';

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const QUIET = argv.includes('--quiet');
const seedArg = argv.find((a) => a.startsWith('--seed='));
const SEED = seedArg ? Number(seedArg.slice(7)) >>> 0 : 20261118;

// ---------------------------------------------------------------------------
// Bands. Levels inside a group are sorted from easiest to hardest.
//   n           board size
//   wild        [min, max] wildcards on the board
//   fill        share of cells that start with a circle
//   cap         largest allowed goal number (the last circle); always <= 9999
//   depth       extra halvings above the minimum, so numbers stay varied
//   minDecoys   boards with fewer decoy pairs are rejected
//   pool        candidates generated per level; the band keeps an even spread of difficulty
// ---------------------------------------------------------------------------
const BANDS = [
  { from: 1,  to: 10,  n: 3, wild: [0, 0], fill: [0.55, 1.0],  cap: 240,  depth: [1, 2], eqBias: 6, minDecoys: 1,  pool: 6 },
  { from: 11, to: 25,  n: 4, wild: [0, 0], fill: [0.70, 1.0],  cap: 960,  depth: [1, 3], eqBias: 6, minDecoys: 2,  pool: 5 },
  { from: 26, to: 29,  n: 5, wild: [0, 0], fill: [0.72, 0.96], cap: 3840, depth: [1, 3], eqBias: 6, minDecoys: 3,  pool: 6 },
  { from: 30, to: 45,  n: 5, wild: [1, 2], fill: [0.72, 0.96], cap: 3840, depth: [1, 3], eqBias: 6, minDecoys: 3,  pool: 4 },
  { from: 46, to: 65,  n: 6, wild: [1, 3], fill: [0.72, 0.94], cap: 9999, depth: [1, 3], eqBias: 6, minDecoys: 5,  pool: 4 },
  { from: 66, to: 80,  n: 7, wild: [2, 4], fill: [0.72, 0.92], cap: 9999, depth: [1, 3], eqBias: 6, minDecoys: 7,  pool: 3 },
  { from: 81, to: 89,  n: 8, wild: [2, 5], fill: [0.74, 0.92], cap: 9999, depth: [1, 3], eqBias: 6, minDecoys: 9,  pool: 3 },
  { from: 90, to: 100, n: 9, wild: [3, 6], fill: [0.80, 0.95], cap: 9999, depth: [1, 3], eqBias: 6, minDecoys: 14, pool: 3 },
];
const PLAYOUTS = 400;          // random games per board for the difficulty score
const EXHAUSTIVE_TILES = 81;   // boards up to this many circles get an exhaustive check for decoys
const EXHAUSTIVE_NODES = 50000;

// ---------------------------------------------------------------------------
function between(src, a, b) {
  const i = src.indexOf(a);
  const j = src.indexOf(b);
  if (i < 0 || j < 0 || j < i) throw new Error(`markers ${a} … ${b} not found in index.html`);
  return src.slice(i + a.length, j);
}
const html = fs.readFileSync(HTML_PATH, 'utf8');
// new Function (not vm) so the engine runs at full speed with normal globals.
const E = new Function(between(html, ENGINE_BEGIN, ENGINE_END) + '\nreturn Engine;')();

function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(weights) {
      let total = 0;
      for (const w of weights) total += w;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
      return weights.length - 1;
    },
  };
}

// Wildcard splits, run backwards: a value v becomes number u plus the wildcard that turns u into v.
const WILD_SPLITS = [
  { code: -1, from: (v) => v - 1 },
  { code: -2, from: (v) => v - 2 },
  { code: -3, from: (v) => v - 3 },
  { code: -4, from: (v) => (v % 2 === 0 ? v / 2 : 0) },
  { code: -5, from: (v) => (v % 3 === 0 ? v / 3 : 0) },
];

function pickGoal(R, band, tiles) {
  let d = Math.ceil(Math.log2(tiles)) + R.int(band.depth[0], band.depth[1]);
  for (; d >= 1; d--) {
    const ms = [1, 3, 5, 7, 9, 11, 13, 15].filter((m) => m * 2 ** d <= band.cap);
    if (ms.length) return R.pick(ms) * 2 ** d;
  }
  return 2;
}

// Start from one circle and split until the board is full enough. Every split puts half of a
// circle (or a number + wildcard pair) into an empty orthogonal neighbour, so replaying the
// splits in reverse is a guaranteed solution.
function buildBoard(R, band) {
  const n = band.n;
  const size = n * n;
  const nb = E.nbrs(n);
  const target = R.int(Math.ceil(band.fill[0] * size), Math.floor(band.fill[1] * size));
  const wildTotal = R.int(band.wild[0], band.wild[1]);
  const goal = pickGoal(R, band, target);
  const c = new Array(size).fill(0);
  const lo = Math.floor((n - 1) / 3);
  const hi = Math.ceil((2 * (n - 1)) / 3);
  c[R.int(lo, hi) * n + R.int(lo, hi)] = goal;
  let tiles = 1;
  let wildLeft = wildTotal;
  const splits = [];
  while (tiles < target) {
    const left = target - tiles;
    const eq = [], eqW = [], wi = [], wiW = [];
    for (let t = 0; t < size; t++) {
      const v = c[t];
      if (v <= 0) continue;
      for (const s of nb[t]) {
        if (c[s]) continue;
        let occ = 0;
        for (const x of nb[s]) if (c[x]) occ++;
        const w = Math.pow(v, 0.65) * occ * occ;
        if (v % 2 === 0) {
          // Favour splits that put the new halves next to other circles of the same value:
          // that is where decoy pairs come from.
          const u = v / 2;
          let same = 0;
          for (const x of nb[s]) if (x !== t && c[x] === u) same++;
          for (const x of nb[t]) if (x !== s && c[x] === u) same++;
          eq.push([t, s, 0, u]);
          eqW.push(w * (1 + (band.eqBias || 0) * same));
        }
        if (wildLeft > 0) {
          const ops = WILD_SPLITS.filter((o) => o.from(v) >= 1);
          if (ops.length) { wi.push([t, s, ops, v]); wiW.push(w); }
        }
      }
    }
    let useWild = wildLeft > 0 && (wildLeft >= left || R.next() < (wildLeft / left) * 1.5);
    if (useWild && !wi.length) useWild = false;
    if (!useWild && !eq.length) useWild = wildLeft > 0 && wi.length > 0;
    if (!useWild && !eq.length) return null;
    if (useWild) {
      const [t, s, ops, v] = wi[R.weighted(wiW)];
      const o = R.pick(ops);
      const u = o.from(v);
      if (R.next() < 0.5) { c[t] = u; c[s] = o.code; } else { c[t] = o.code; c[s] = u; }
      wildLeft--;
      splits.push([s, t]);
    } else {
      const [t, s, , u] = eq[R.weighted(eqW)];
      c[t] = u;
      c[s] = u;
      splits.push([s, t]);
    }
    tiles++;
  }
  if (wildLeft) return null;
  const sol = [];
  for (let i = splits.length - 1; i >= 0; i--) sol.push(splits[i][0], splits[i][1]);
  return { n, c, s: sol, goal, wilds: wildTotal };
}

// A decoy is an adjacent pair of equal numbers where merging it either way leaves a position
// that can never be finished (a circle gets cut off or can never find a partner).
function deadAfter(c, n, a, b, exhaustive) {
  const d = E.apply(c, a, b);
  if (E.isDead(d, n)) return true;
  if (!exhaustive) return false;
  const S = new E.Solver(d, n).run(EXHAUSTIVE_NODES);
  return S.done && !S.result;
}
function countDecoys(c, n, need = 0) {
  const nb = E.nbrs(n);
  const exhaustive = E.count(c) <= EXHAUSTIVE_TILES;
  const pairs = [];
  for (let i = 0; i < c.length; i++) {
    if (c[i] <= 0) continue;
    for (const j of nb[i]) if (j > i && c[j] === c[i]) pairs.push([i, j]);
  }
  let k = 0;
  for (let p = 0; p < pairs.length; p++) {
    if (k + (pairs.length - p) < need) return k; // cannot reach the minimum any more
    const [i, j] = pairs[p];
    if (deadAfter(c, n, i, j, exhaustive) && deadAfter(c, n, j, i, exhaustive)) k++;
  }
  return k;
}

// Difficulty: share of uniformly random games that end stuck. Ties (common on big boards,
// where nearly every random game gets stuck) are broken by how far random games get.
function difficulty(c, n, R) {
  const tiles = E.count(c);
  let stuck = 0, progress = 0;
  for (let r = 0; r < PLAYOUTS; r++) {
    const d = c.slice();
    let made = 0;
    for (;;) {
      const ms = E.moves(d, n);
      if (!ms.length) break;
      const [a, b] = ms[Math.floor(R.next() * ms.length)];
      d[b] = E.mergeValue(d[a], d[b]);
      d[a] = 0;
      made++;
    }
    if (tiles - made > 1) stuck++;
    progress += made / (tiles - 1);
  }
  const s = stuck / PLAYOUTS, p = progress / PLAYOUTS;
  return { stuck: s, progress: p, score: s + 0.25 * (1 - p) };
}

function canonical(c, n) {
  let best = null;
  for (let k = 0; k < 8; k++) {
    const out = new Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let q = 0; q < n; q++) {
        let rr = r, qq = q;
        if (k & 1) qq = n - 1 - qq;
        if (k & 2) rr = n - 1 - rr;
        if (k & 4) { const t = rr; rr = qq; qq = t; }
        out[rr * n + qq] = c[r * n + q];
      }
    }
    const s = out.join(',');
    if (best === null || s < best) best = s;
  }
  return n + ':' + best;
}

function bandLabel(b) { return `levels ${b.from}–${b.to} (${b.n}x${b.n}${b.wild[1] ? ', wildcards' : ''})`; }

function generate() {
  const levels = [];
  const seen = new Set();
  for (const band of BANDS) {
    const count = band.to - band.from + 1;
    const want = count * band.pool;
    const R = makeRng((SEED ^ Math.imul(band.from + 1, 0x9e3779b1)) >>> 0);
    const pool = [];
    let tries = 0;
    const t0 = Date.now();
    while (pool.length < want && tries < want * 3000) {
      tries++;
      const b = buildBoard(R, band);
      if (!b) continue;
      if (band.wild[0] > 0 && b.wilds < 1) continue;
      const key = canonical(b.c, b.n);
      if (seen.has(key)) continue;
      const y = countDecoys(b.c, b.n, band.minDecoys);
      if (y < band.minDecoys) continue;
      seen.add(key);
      const v = E.verify(b);
      if (!v.ok) throw new Error(`generator produced an unsolvable board: ${v.reason}`);
      pool.push({ ...b, decoys: y, diff: difficulty(b.c, b.n, R) });
    }
    if (pool.length < count) {
      throw new Error(`${bandLabel(band)}: only ${pool.length} boards passed after ${tries} tries; loosen minDecoys or fill`);
    }
    pool.sort((x, y) => x.diff.score - y.diff.score);
    const chosen = [];
    for (let j = 0; j < count; j++) chosen.push(pool[Math.round((j * (pool.length - 1)) / Math.max(1, count - 1))]);
    for (const b of chosen) {
      levels.push({ n: b.n, c: b.c, s: b.s, r: Math.round(b.diff.stuck * 1000) / 1000, y: b.decoys });
    }
    if (!QUIET) {
      const ys = chosen.map((b) => b.decoys);
      const rs = chosen.map((b) => b.diff.stuck);
      console.log(
        `${bandLabel(band).padEnd(36)} pool ${String(pool.length).padStart(3)} from ${String(tries).padStart(5)} tries` +
        `  stuck ${pct(Math.min(...rs))}–${pct(Math.max(...rs))}  decoys ${Math.min(...ys)}–${Math.max(...ys)}  ${((Date.now() - t0) / 1000).toFixed(1)}s`
      );
    }
  }
  return levels;
}
function pct(x) { return (x * 100).toFixed(0) + '%'; }

function bandOf(i) { return BANDS.find((b) => i + 1 >= b.from && i + 1 <= b.to); }

// Every stored solution is replayed move by move with the game's own rules.
function check(levels) {
  const problems = [];
  if (levels.length !== 100) problems.push(`expected 100 levels, found ${levels.length}`);
  levels.forEach((L, i) => {
    const v = E.verify(L);
    if (!v.ok) { problems.push(`level ${i + 1}: ${v.reason}`); return; }
    const band = bandOf(i);
    if (!band) return;
    if (L.n !== band.n) problems.push(`level ${i + 1}: board is ${L.n}x${L.n}, band wants ${band.n}x${band.n}`);
    const wild = L.c.filter((x) => x < 0).length;
    if (band.wild[1] === 0 && wild) problems.push(`level ${i + 1}: has wildcards before level 30`);
    if (band.wild[0] > 0 && !wild) problems.push(`level ${i + 1}: has no wildcard`);
    if (L.c.some((x) => x > 9999)) problems.push(`level ${i + 1}: a number has more than 4 digits`);
  });
  return problems;
}

function main() {
  if (CHECK_ONLY) {
    const levels = new Function(between(html, LEVELS_BEGIN, LEVELS_END) + '\nreturn LEVELS;')();
    const problems = check(levels);
    if (problems.length) {
      console.error(problems.join('\n'));
      console.error(`FAILED: ${problems.length} problem(s)`);
      process.exit(1);
    }
    const moves = levels.reduce((a, L) => a + L.s.length / 2, 0);
    console.log(`OK: all ${levels.length} stored solutions replay to a single circle (${moves} moves checked).`);
    return;
  }
  const t0 = Date.now();
  const levels = generate();
  const problems = check(levels);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error('Not writing index.html.');
    process.exit(1);
  }
  const body = '\nconst LEVELS = [\n' + levels.map((L) => JSON.stringify(L)).join(',\n') + '\n];\n';
  const i = html.indexOf(LEVELS_BEGIN) + LEVELS_BEGIN.length;
  const j = html.indexOf(LEVELS_END);
  fs.writeFileSync(HTML_PATH, html.slice(0, i) + body + html.slice(j));
  console.log(`Wrote ${levels.length} levels to index.html (seed ${SEED}, ${((Date.now() - t0) / 1000).toFixed(1)}s). All stored solutions verified.`);
}

if (require.main === module) main();
else module.exports = { E, BANDS, buildBoard, countDecoys, difficulty, makeRng, check };
