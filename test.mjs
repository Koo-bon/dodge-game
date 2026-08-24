// chars.js + game.js를 가짜 브라우저에서 실제로 돌려 검증한다.
// Math.random을 조작해 "좋은 것만 떨어지는 상황", "나쁜 것만 떨어지는 상황"을 만들어
// 점수 획득과 목숨 감소를 결정적으로 확인한다.
// 실행: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const here = p => new URL(p, import.meta.url);
const code = readFileSync(here('./chars.js'), 'utf8') + '\n' +
             readFileSync(here('./game.js'), 'utf8');

// --- 가짜 브라우저 -----------------------------------------------------------
const drawn = [];                       // 이번 프레임에 그린 이미지 이름들
const ctx = {
  setTransform() {}, clearRect() { drawn.length = 0; }, save() {}, restore() {},
  translate() {}, rotate() {}, fillText() {}, strokeText() {},
  drawImage(im) { drawn.push(im.name); },
  imageSmoothingEnabled: true, globalAlpha: 1, textAlign: '', font: '',
  fillStyle: '', strokeStyle: '', lineWidth: 0
};

const handlers = {};                    // "elementId:type" -> [fn]
const els = {};
function el(id) {
  return els[id] ??= {
    id, textContent: '', innerHTML: '', style: {},
    classList: {
      _c: new Set(),
      add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); },
      contains(c) { return this._c.has(c); }
    },
    dataset: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener(type, fn) { (handlers[`${id}:${type}`] ??= []).push(fn); },
    // 선택 화면의 카드 6개를 흉내낸다 (innerHTML 파싱은 하지 않는다)
    querySelectorAll: () => cards
  };
}
const cards = [];                       // CHARS 순서대로 채운다 (아래에서)

const doc = {
  getElementById: el,
  addEventListener(type, fn) { (handlers[`doc:${type}`] ??= []).push(fn); }
};
const win = { innerWidth: 520, innerHeight: 900, devicePixelRatio: 2, addEventListener() {} };

let now = 0;
const perf = { now: () => now };
let frame = null;
const raf = fn => { frame = fn; };

const kv = new Map();
const ls = {
  getItem: k => kv.has(k) ? kv.get(k) : null,
  setItem: (k, v) => kv.set(k, String(v))
};

const loaded = [];
class FakeImage {
  set src(v) {
    this.name = v.replace(/^assets\//, '').replace(/\.png$/, '');
    loaded.push(this.name);
    this.width = 128; this.height = 128;
    queueMicrotask(() => this.onload?.());
  }
}

// Math.random을 테스트가 조종한다 (Math의 나머지 기능은 그대로 쓴다)
// spawn() 안에서 불리는 순서대로 값을 돌려준다:
//   나쁜 것 → [풀 선택, 종류, 높이, x위치, 속도, 회전]
//   좋은 것 → [풀 선택, 종류, x위치, 속도]
let randSeq = () => 0.5;
const cycle = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const GOODIE_CENTER  = cycle([0.9, 0.0, 0.5, 0.5]);   // 0.9 >= 0.65 → 좋은 것, 가운데
const HAZARD_CENTER  = cycle([0.3, 0.0, 0.5, 0.5, 0.5, 0.5]); // 0.3 < 0.65 → 나쁜 것, 가운데
const GOODIE_FAR     = cycle([0.9, 0.0, 0.999, 0.5]); // 좋은 것, 오른쪽 끝 → 안 맞음
const fakeMath = Object.create(Math);
Object.defineProperty(fakeMath, 'random', { value: () => randSeq() });

// chars.js의 CHARS를 꺼내오기 위해 마지막 줄에 반환문을 붙인다
const run = new Function(
  'document', 'window', 'performance', 'localStorage',
  'requestAnimationFrame', 'Image', 'Math',
  code + '\nreturn { CHARS, HAZARDS };'
);

// CHARS를 먼저 알아야 카드를 만들 수 있으므로, 카드 배열은 실행 중에 채워진다.
// buildSelect()가 querySelectorAll을 부르는 시점에 이미 CHARS가 정의되어 있으니
// 여기서는 6칸을 미리 만들어 두고 id만 나중에 채운다.
for (let i = 0; i < 6; i++) {
  const idx = i;
  cards.push({
    dataset: {},
    addEventListener(type, fn) { (handlers[`card${idx}:${type}`] ??= []).push(fn); }
  });
}

const api = run(doc, win, perf, ls, raf, FakeImage, fakeMath);
const { CHARS, HAZARDS } = api;
CHARS.forEach((c, i) => { cards[i].dataset.id = c.id; });

const fire = (key, e = {}) =>
  (handlers[key] || []).forEach(fn => fn({ preventDefault() {}, ...e }));
const step = (ms = 16) => { now += ms; const f = frame; frame = null; f?.(now); };
const frames = n => { for (let i = 0; i < n; i++) step(); };
const flush = () => new Promise(r => setTimeout(r, 0));

// --- 1) 캐릭터 6명, 각자 좋은 오브제 3개 -------------------------------------
assert.equal(CHARS.length, 6, '캐릭터는 6명이어야 한다');
assert.deepEqual(CHARS.map(c => c.name), ['본혁', '승일', '유경', '현호', '연수', '수연']);
for (const c of CHARS) {
  assert.equal(c.goodies.length, 3, `${c.name}의 좋은 오브제는 3개여야 한다`);
  assert.ok(c.place && c.concept, `${c.name}의 배경/컨셉이 있어야 한다`);
}
assert.equal(HAZARDS.length, 4, '피해야 하는 것은 4개여야 한다');
assert.equal(cards.length, 6, '선택 카드가 6개 만들어져야 한다');

// --- 2) 캐릭터를 고르면 필요한 이미지 9장을 불러온다 --------------------------
// (배경 1 + 캐릭터 1 + 나쁜 것 4 + 좋은 것 3)
loaded.length = 0;
fire('card0:click');
await flush();
const want = ['bg-bonhyuk', 'char-bonhyuk',
              ...HAZARDS.map(h => h.img), ...CHARS[0].goodies.map(g => g.img)];
assert.deepEqual(loaded.slice().sort(), want.slice().sort(), '9장을 불러와야 한다');
assert.equal(el('over').classList.contains('hide'), false, '시작 전 안내가 떠 있어야 한다');

// --- 3) 시작하면 배경과 캐릭터가 그려지고 시간 점수가 오른다 -----------------
randSeq = GOODIE_FAR;                    // 화면 오른쪽 끝에만 떨어뜨려 아무것도 안 맞게 한다
fire('again:click');
assert.equal(el('over').classList.contains('hide'), true, '시작하면 안내가 사라져야 한다');
frames(130);                             // 약 2초
assert.ok(drawn.includes('bg-bonhyuk'), '배경을 그려야 한다');
assert.ok(drawn.includes('char-bonhyuk'), '캐릭터를 그려야 한다');
assert.ok(Number(el('score').textContent) >= 2, `시간 점수가 올라야 한다: ${el('score').textContent}`);
assert.equal(el('hp').textContent, '♥♥♥', '아직 목숨 3개여야 한다');

// --- 4) 좋은 것이 캐릭터 위로 떨어지면 점수가 오른다 -------------------------
const before = Number(el('score').textContent);
randSeq = GOODIE_CENTER;                 // 좋은 것을 캐릭터 머리 위로 떨어뜨린다
frames(320);                             // 약 5초 — 화면 위에서 바닥까지 내려올 시간
const after = Number(el('score').textContent);
// 5초면 시간 점수만으로는 +5 정도. 그보다 훨씬 많이 오르면 주워 먹은 것이다.
assert.ok(after > before + 8, `좋은 것을 주워 점수가 더 올라야 한다: ${before} → ${after}`);

// --- 5) 나쁜 것에 맞으면 목숨이 줄고, 다 잃으면 게임 오버 --------------------
randSeq = HAZARD_CENTER;                 // 나쁜 것만, 캐릭터가 있는 가운데로
let guard = 0;
while (el('over').classList.contains('hide') && guard++ < 60 * 90) step();
assert.equal(el('over').classList.contains('hide'), false, '목숨을 다 잃으면 게임 오버여야 한다');
assert.equal(el('hp').textContent, '♡♡♡', '목숨이 0이어야 한다');
assert.match(el('overT').textContent, /최고 기록!|게임 오버/, '결과 제목이 떠야 한다');

// --- 6) 최고점수는 캐릭터별로 따로 저장된다 ----------------------------------
const sc = Number(el('score').textContent);
assert.ok(sc > 0, '점수가 있어야 한다');
assert.equal(Number(kv.get('fall.best.bonhyuk')), sc, '본혁의 최고점수가 저장되어야 한다');
assert.equal(kv.has('fall.best.suyeon'), false, '다른 캐릭터 점수는 건드리지 않아야 한다');

// --- 7) 다시 하기 → 점수 초기화 ---------------------------------------------
fire('again:click');
step();
assert.ok(Number(el('score').textContent) < sc, '다시 하면 점수가 초기화되어야 한다');
assert.equal(el('hp').textContent, '♥♥♥', '목숨도 초기화되어야 한다');

// --- 8) 캐릭터 변경 → 선택 화면으로 돌아간다 --------------------------------
fire('quit:click');
assert.equal(el('play').classList.contains('on'), false, '게임 화면이 닫혀야 한다');

// --- 9) localStorage가 막힌 브라우저에서도 죽지 않는다 ----------------------
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
run(doc, win, perf, blocked, raf, FakeImage, fakeMath);

console.log(`통과 — 캐릭터 ${CHARS.length}명, 게임 오버까지 ${sc}점 기록, 이미지 ${want.length}장 로드`);
