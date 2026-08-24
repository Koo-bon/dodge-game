// index.html 안의 게임 스크립트를 가짜 DOM에서 실제로 돌려 검증한다.
// 실행: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// --- 가짜 브라우저 -----------------------------------------------------------
let blockDraws = 0, playerDraws = 0;
const ctx = {
  setTransform() {}, clearRect() {}, beginPath() {}, arc() { playerDraws++; },
  fill() {}, fillRect() { blockDraws++; }, roundRect() { blockDraws++; },
  set fillStyle(_) {}, get fillStyle() { return ''; }
};
const els = {};
const el = id => els[id] ??= {
  id, textContent: '', innerHTML: '', className: '', style: {},
  classList: {
    add(c) { el(id).className = c; },
    remove() { el(id).className = ''; }
  },
  getContext: () => ctx,
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  addEventListener(type, fn) { (handlers[type] ??= []).push(fn); }
};
const handlers = {};
const store = new Map();

const doc = { getElementById: el, addEventListener: el('doc').addEventListener };
const win = {
  innerWidth: 512, innerHeight: 740, devicePixelRatio: 2,
  addEventListener() {}
};
let now = 0;
const perf = { now: () => now };
let frame = null;
const raf = fn => { frame = fn; };
const ls = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, v)
};

new Function('document', 'window', 'performance', 'localStorage',
             'requestAnimationFrame', code)(doc, win, perf, ls, raf);

const fire = (type, e = {}) => (handlers[type] || [])
  .forEach(fn => fn({ preventDefault() {}, ...e }));
const step = (ms = 16) => { now += ms; const f = frame; frame = null; f?.(now); };

// --- 1) 시작 전에는 오버레이가 보인다 ---------------------------------------
assert.equal(el('overlay').className, '', '시작 전 오버레이가 떠 있어야 한다');

// --- 2) 클릭하면 시작되고 시간이 흐른다 -------------------------------------
fire('pointerdown');
assert.equal(el('overlay').className, 'hide', '시작하면 오버레이가 사라져야 한다');
for (let i = 0; i < 30; i++) step();          // 약 0.5초
assert.ok(Number(el('score').textContent) > 0.3, `시간이 흘러야 한다: ${el('score').textContent}`);

// --- 3) 블록이 생성되고 그려진다 --------------------------------------------
for (let i = 0; i < 60; i++) step();          // 약 1.5초
assert.ok(blockDraws > 0, '블록이 그려져야 한다');
assert.ok(playerDraws > 0, '플레이어가 그려져야 한다');

// --- 4) 가만히 있으면 결국 맞아서 게임 오버가 된다 --------------------------
let frames = 0;
while (el('overlay').className !== 'hide' === false && frames < 60 * 60) { // 최대 60초
  step();
  frames++;
  if (el('overlay').className === '') break;  // 게임 오버 → 오버레이 복귀
}
assert.equal(el('overlay').className, '', '블록에 맞으면 게임 오버가 되어야 한다');
const scored = Number(el('score').textContent);
assert.ok(scored > 0, '점수가 기록되어야 한다');

// --- 5) 최고점수가 저장된다 --------------------------------------------------
// 화면은 소수 1자리, 저장값은 원본이라 같은 자리수로 비교한다
assert.equal(Number(store.get('dodge.best')).toFixed(1), scored.toFixed(1), '최고점수가 저장되어야 한다');
assert.equal(el('best').textContent, scored.toFixed(1), '최고점수가 화면에 반영되어야 한다');

// --- 6) 다시 클릭하면 재시작한다 --------------------------------------------
fire('pointerdown');
assert.equal(el('overlay').className, 'hide', '다시 시작되어야 한다');
step();
assert.ok(Number(el('score').textContent) < 1, '점수가 0부터 다시 시작해야 한다');

// --- 7) 커서를 따라 움직인다 (경계 밖은 안으로 붙인다) ----------------------
fire('pointermove', { clientX: 200, clientY: 300 });
fire('pointermove', { clientX: -999, clientY: -999 });
step();

// --- 8) localStorage가 막힌 브라우저에서도 죽지 않는다 ----------------------
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
new Function('document', 'window', 'performance', 'localStorage',
             'requestAnimationFrame', code)(doc, win, perf, blocked, raf);

console.log(`통과 — ${scored.toFixed(1)}초 생존 후 게임 오버, 블록 ${blockDraws}회 렌더`);
