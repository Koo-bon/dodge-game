// chars.js + game.js를 가짜 브라우저에서 실제로 돌려 검증한다.
// Math.random을 조작해 "좋은 것만 떨어지는 상황", "나쁜 것만 떨어지는 상황"을 만들어
// 점수 획득과 목숨 감소를 결정적으로 확인한다.
// 실행: node test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const here = p => new URL(p, import.meta.url);
const code = readFileSync(here('./chars.js'), 'utf8') + '\n' +
             readFileSync(here('./game.js'), 'utf8');
// 브라우저 오디오는 흉내만 낸다 (소리 자체는 검사 대상이 아니다)
const Bgm = { playing: false, fever: false, start() { this.playing = true; },
              stop() { this.playing = false; }, setFever(v) { this.fever = v; } };

// --- 가짜 브라우저 -----------------------------------------------------------
const drawn = [];                       // 이번 프레임에 그린 이미지 이름들
const drawnAt = { player: null, fev: null };  // 캐릭터·피버 아이템을 그린 좌표
const ctx = {
  setTransform() {}, clearRect() { drawn.length = 0; }, save() {}, restore() {},
  translate() {}, rotate() {}, fillText() {}, strokeText() {}, strokeRect() {},
  drawImage(im, x, y, w, h) {
    drawn.push(im.name);
    if (im.name.startsWith('char-')) drawnAt.player = { x, y };
    if (im.name.startsWith('fev-')) drawnAt.fev = { x, y, w, h };
  },
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
      contains(c) { return this._c.has(c); },
      toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); }
    },
    dataset: {}, children: [],
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
const win = { innerWidth: 520, innerHeight: 900, devicePixelRatio: 2, ASSET_V: '4', addEventListener() {} };

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
    this.name = v.replace(/^assets\//, '').replace(/\.png(\?.*)?$/, '');
    loaded.push(this.name);
    this.width = 128; this.height = 128;
    queueMicrotask(() => this.onload?.());
  }
}

// Math.random을 테스트가 조종한다 (Math의 나머지 기능은 그대로 쓴다)
// spawn() 안에서 불리는 순서대로 값을 돌려준다:
//   나쁜 것 → [종류, 높이, 속도, 회전, x위치, 좌우속도]
//   피버    → [속도, x위치, 좌우속도]
let randSeq = () => 0.5;
const cycle = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const HAZARD_CENTER = cycle([0.0, 0.5, 0.5, 0.5, 0.5, 0.5]);   // 가운데로, 좌우 흐름 없음
const HAZARD_FAR    = cycle([0.0, 0.5, 0.5, 0.5, 0.999, 0.5]); // 오른쪽 끝 → 안 맞음
const fakeMath = Object.create(Math);
Object.defineProperty(fakeMath, 'random', { value: () => randSeq() });

// chars.js의 CHARS를 꺼내오기 위해 마지막 줄에 반환문을 붙인다
const run = new Function(
  'document', 'window', 'performance', 'localStorage',
  'requestAnimationFrame', 'Image', 'Math', 'Bgm',
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

const api = run(doc, win, perf, ls, raf, FakeImage, fakeMath, Bgm);
const { CHARS, HAZARDS } = api;
CHARS.forEach((c, i) => { cards[i].dataset.id = c.id; });

const fire = (key, e = {}) =>
  (handlers[key] || []).forEach(fn => fn({ preventDefault() {}, ...e }));
const step = (ms = 16) => { now += ms; const f = frame; frame = null; f?.(now); };
const frames = n => { for (let i = 0; i < n; i++) step(); };
const flush = () => new Promise(r => setTimeout(r, 0));

// --- 1) 캐릭터 6명, 각자 코스튬 -----------------------------------------------
assert.equal(CHARS.length, 6, '캐릭터는 6명이어야 한다');
assert.deepEqual(CHARS.map(c => c.name), ['본혁', '승일', '유경', '현호', '연수', '수연']);
for (const c of CHARS) {
  assert.ok(c.want, `${c.name}의 가고 싶은 곳이 있어야 한다`);
  assert.ok(c.team, `${c.name}의 팀명이 있어야 한다`);
  assert.match(c.tint, /^#[0-9a-f]{6}$/i, `${c.name}의 카드 색이 있어야 한다`);
  assert.ok(c.fever && c.fever.img && c.fever.name, `${c.name}의 피버 아이템이 있어야 한다`);
}
assert.equal(HAZARDS.length, 2, '피해야 하는 것은 은행과 낙엽 둘뿐이어야 한다');
assert.deepEqual(HAZARDS.map(h => h.name), ['은행', '낙엽']);

// --- 1b) 선택 캐러셀: 처음엔 첫 캐릭터, 화살표로 넘어간다 ------------------
assert.equal(el('cname').textContent, CHARS[0].name, '처음엔 첫 캐릭터가 보여야 한다');
assert.equal(el('cteam').textContent, CHARS[0].team, '팀명이 보여야 한다');
assert.match(el('cplace').textContent, /^가고 싶은 곳 : /, '가고 싶은 곳으로 표기되어야 한다');
assert.ok(el('charImg').src.includes(`char-${CHARS[0].id}`), '캐릭터 그림이 걸려야 한다');
fire('next:click');
assert.equal(el('cname').textContent, CHARS[1].name, '다음 화살표로 넘어가야 한다');
fire('prev:click');
fire('prev:click');
assert.equal(el('cname').textContent, CHARS[CHARS.length - 1].name, '앞으로 넘기면 마지막으로 돌아가야 한다');
fire('next:click');   // 다시 첫 캐릭터로
assert.equal(el('cname').textContent, CHARS[0].name, '한 바퀴 돌아 첫 캐릭터여야 한다');

// --- 2) START를 누르면 필요한 이미지 6장을 불러온다 --------------------------
// (배경 1 + 피버용 배경 1 + 캐릭터 1 + 피버 아이템 1 + 은행 + 낙엽)
loaded.length = 0;
fire('go:click');
await flush();
const want = ['bg-bonhyuk', 'bgf-bonhyuk', 'char-bonhyuk',
              CHARS[0].fever.img, ...HAZARDS.map(h => h.img)];
assert.deepEqual(loaded.slice().sort(), want.slice().sort(), '6장을 불러와야 한다');
assert.equal(el('over').classList.contains('hide'), false, '시작 전 안내가 떠 있어야 한다');

// --- 3) 시작하면 배경과 캐릭터가 그려지고 시간 점수가 오른다 -----------------
randSeq = HAZARD_FAR;                    // 화면 오른쪽 끝에만 떨어뜨려 아무것도 안 맞게 한다
fire('again:click');
assert.equal(el('over').classList.contains('hide'), true, '시작하면 안내가 사라져야 한다');
frames(130);                             // 약 2초
assert.ok(drawn.includes('bg-bonhyuk'), '배경을 그려야 한다');
assert.ok(drawn.includes('char-bonhyuk'), '캐릭터를 그려야 한다');
assert.ok(Number(el('score').textContent) >= 2, `시간 점수가 올라야 한다: ${el('score').textContent}`);
assert.equal(el('hp').textContent, '♥♥♥', '아직 목숨 3개여야 한다');

// --- 4) 점수는 버틴 시간뿐이다 -----------------------------------------------
const before = Number(el('score').textContent);
frames(320);                             // 약 5초
const after = Number(el('score').textContent);
assert.ok(after >= before + 4 && after <= before + 12,
  `점수는 버틴 시간만큼(피버면 2배) 올라야 한다: ${before} → ${after}`);

// --- 4b) 피버 아이템을 먹으면 배경 동물이 놀란 표정 판으로 바뀐다 -----------
// 모든 것이 화면 오른쪽 끝으로 떨어지게 하고 캐릭터도 오른쪽 끝에 세워 둔다.
// 피버가 관측될 때까지 계속 진행하고, 도중에 죽으면 다시 시작한다.
// 떨어지는 것들은 좌우로도 흘러가므로, 스폰 위치가 아니라 "지금 그려진 좌표"를
// 보고 캐릭터를 피버 아이템 밑으로 따라 보낸다.
randSeq = () => 0.99;
const moveTo = x => fire('cv:pointermove', { clientX: x });
moveTo(0);
let feverFrames = 0, feverBgFrames = 0, plainBgWhileFever = 0, guardF = 0;
while (feverFrames < 5 && guardF++ < 60 * 200) {
  if (!el('over').classList.contains('hide')) { fire('again:click'); moveTo(0); }
  // 피버 아이템이 화면에 있으면 그 밑으로 따라간다
  const f = drawnAt.fev;
  moveTo(f ? f.x + f.w / 2 : 0);
  drawnAt.fev = null;
  step();
  if (/FEVER/.test(el('hp').textContent)) {
    feverFrames++;
    if (drawn.includes('bgf-bonhyuk')) feverBgFrames++;
    if (drawn.includes('bg-bonhyuk')) plainBgWhileFever++;
  }
}
assert.ok(feverFrames >= 5, `피버 아이템을 먹어 피버타임에 들어가야 한다 (관측 ${feverFrames})`);
assert.equal(feverBgFrames, feverFrames,
  `피버 중에는 놀란 표정 배경을 그려야 한다 (${feverBgFrames}/${feverFrames})`);
assert.equal(plainBgWhileFever, 0, '피버 중에 평소 배경을 그리면 안 된다');

// 피버가 끝나면 평소 배경으로 돌아온다
for (let i = 0; i < 600 && /FEVER/.test(el('hp').textContent); i++) step();
step();
assert.ok(drawn.includes('bg-bonhyuk'), '피버가 끝나면 평소 배경으로 돌아와야 한다');
assert.ok(!drawn.includes('bgf-bonhyuk'), '피버가 아니면 놀란 표정 배경을 쓰지 않아야 한다');

// --- 5) 나쁜 것에 맞으면 목숨이 줄고, 다 잃으면 게임 오버 --------------------
randSeq = HAZARD_CENTER;                 // 캐릭터가 있는 가운데로 떨어뜨린다
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

// --- 6b) 캐릭터는 바닥에 붙어 좌우로만 움직인다 ------------------------------
fire('again:click');
step();
const bottomY = drawnAt.player.y;
fire('cv:pointermove', { clientX: 40, clientY: 30 });   // 맨 위로 올리려고 해도
step();
assert.equal(drawnAt.player.y, bottomY, '세로로는 움직이지 않아야 한다');
assert.ok(drawnAt.player.x < 80, '좌우로는 따라와야 한다');

// --- 7) 다시 하기 → 점수 초기화 ---------------------------------------------
assert.ok(Number(el('score').textContent) < sc, '다시 하면 점수가 초기화되어야 한다');
assert.equal(el('hp').textContent, '♥♥♥', '목숨도 초기화되어야 한다');

// --- 8) 캐릭터 변경 → 선택 화면으로 돌아간다 --------------------------------
fire('quit:click');
assert.equal(el('play').classList.contains('on'), false, '게임 화면이 닫혀야 한다');

// --- 9) localStorage가 막힌 브라우저에서도 죽지 않는다 ----------------------
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
run(doc, win, perf, blocked, raf, FakeImage, fakeMath, Bgm);

console.log(`통과 — 캐릭터 ${CHARS.length}명, 피할 것 ${HAZARDS.length}종, 게임 오버까지 ${sc}점, 이미지 ${want.length}장 로드`);
