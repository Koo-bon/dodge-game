(() => {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const overlay = $('over');

  const BASE_W = 480;         // 이 폭을 기준으로 모든 크기를 비례해서 키운다
  const PLAYER_H0 = 78;       // 기준 폭에서의 캐릭터 높이(px)
  const HIT_R0 = 20;          // 기준 폭에서의 판정 반지름 (그림보다 작게 — 억울한 피격 방지)
  let k = 1;                  // 화면 배율
  const playerH = () => PLAYER_H0 * k;
  const hitR = () => HIT_R0 * k;
  const padY = () => playerH() / 2;   // 스프라이트가 위아래로 잘리지 않게 두는 여백
  const LIVES = 3;
  const INVULN = 0.8;         // 피격 후 무적 시간(초)
  const FEVER = 5;            // 피버타임 길이(초)
  const FEVER_EVERY = 11;     // 피버 아이템이 나오는 평균 간격(초)

  // 시크릿 모드·일부 브라우저에서 localStorage 접근 자체가 예외를 던진다
  const store = {
    get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }
  };
  const bestKey = id => `fall.best.${id}`;

  // 에셋 주소에 붙이는 판 번호. 그림을 바꿀 때 index.html의 ASSET_V와 함께 올린다.
  // (GitHub Pages가 이미지를 10분간 캐시해서, 이게 없으면 새 그림이 바로 안 보인다)
  const V = window.ASSET_V || '1';

  const imgCache = new Map();
  function loadImage(name) {
    if (imgCache.has(name)) return imgCache.get(name);
    const p = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(`이미지 로드 실패: ${name}`));
      im.src = `assets/${name}.png?v=${V}`;
    });
    imgCache.set(name, p);
    return p;
  }

  // ---------- 캐릭터 선택 (좌우로 넘기는 캐러셀) ----------
  let sel = 0;

  function buildSelect() {
    $('dots').innerHTML = CHARS.map(() => '<i></i>').join('');
    renderSelect();
  }

  function renderSelect() {
    const n = CHARS.length;
    const c = CHARS[sel];
    const prev = CHARS[(sel - 1 + n) % n];
    const next = CHARS[(sel + 1) % n];

    $('charImg').src = `assets/char-${c.id}.png?v=${V}`;
    $('charImg').alt = c.name;
    $('prevImg').src = `assets/char-${prev.id}.png?v=${V}`;
    $('nextImg').src = `assets/char-${next.id}.png?v=${V}`;
    $('frame').style.background = c.tint;

    $('cname').textContent = c.name;
    $('cteam').textContent = c.team;
    $('cplace').textContent = `가고 싶은 곳 : ${c.want}`;
    $('cconcept').textContent = `피버 아이템 : ${c.fever.name}`;
    $('cbest').textContent = `최고 ${store.get(bestKey(c.id))}점`;

    [...$('dots').children].forEach((d, i) => d.className = i === sel ? 'on' : '');
  }

  const step = d => {
    sel = (sel + d + CHARS.length) % CHARS.length;
    renderSelect();
  };

  // ---------- 상태 ----------
  let char = null;            // 선택된 캐릭터
  let art = null;             // { bg, player, hazards:[] } — 로드된 이미지
  let state = 'select';       // select | ready | playing | over
  let W = 0, H = 0;
  let px = 0, py = 0;
  let items = [], pops = [];
  let elapsed = 0, lives = LIVES, invuln = 0, spawnTimer = 0, last = 0;
  let fever = 0, feverTimer = 0;   // 남은 피버 시간, 다음 피버 아이템까지

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  let points = 0;                 // 쌓인 점수 (피버 중에는 2배로 쌓인다)
  const score = () => Math.floor(points);

  async function choose(id) {
    char = CHARS.find(c => c.id === id);
    state = 'ready';
    $('select').style.display = 'none';
    $('play').classList.add('on');
    $('who').textContent = `${char.name} · ${char.team}`;
    resize();
    showOverlay('불러오는 중…', '', '');
    $('again').style.display = 'none';
    try {
      const [bg, player, feverIm, ...rest] = await Promise.all([
        loadImage(`bg-${char.id}`),
        loadImage(`char-${char.id}`),
        loadImage(char.fever.img),
        ...HAZARDS.map(h => loadImage(h.img))
      ]);
      art = {
        bg, player,
        hazards: HAZARDS.map((h, i) => ({ ...h, im: rest[i] })),
        fever: { ...char.fever, im: feverIm, good: true }
      };
    } catch (e) {
      showOverlay('이미지를 못 불러왔습니다', e.message, '새로고침해 주세요');
      return;
    }
    $('again').style.display = '';
    $('again').textContent = '시작';
    showOverlay(char.name,
      `${HAZARDS.map(h => h.name).join('과 ')}을 피하세요`,
      `목숨 ${LIVES}개 · 버틴 1초가 1점<br>` +
      `${char.fever.name}을 먹으면 ${FEVER}초 피버타임 (무적 · 2배 점수)`);
    draw();
  }

  function showOverlay(t, s, h) {
    $('overT').textContent = t;
    $('overS').innerHTML = s;
    $('overH').innerHTML = h;
    overlay.classList.remove('hide');
  }

  function resize() {
    W = Math.min(620, window.innerWidth - 30);
    H = Math.min(830, window.innerHeight - 170);
    if (H < 320) H = 320;
    k = W / BASE_W;
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    px = state === 'playing' ? clamp(px, hitR(), W - hitR()) : W / 2;
    py = H - padY();                      // 바닥 고정. 세로로는 움직이지 않는다
    if (art) draw();
  }

  function start() {
    items = []; pops = [];
    elapsed = 0; lives = LIVES; invuln = 0; spawnTimer = 0;
    fever = 0; feverTimer = FEVER_EVERY * 0.6; points = 0;
    Bgm.setFever(false);
    px = W / 2; py = H - padY();
    state = 'playing';
    overlay.classList.add('hide');
    updateHud();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function updateHud() {
    $('score').textContent = score();
    $('hp').textContent = fever > 0
      ? `FEVER ${Math.ceil(fever)}`
      : '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(LIVES - Math.max(0, lives));
    $('hp').classList.toggle('fev', fever > 0);
  }

  function gameOver() {
    state = 'over';
    const sc = score();
    const key = bestKey(char.id);
    const prev = store.get(key);
    let head = '게임 오버';
    if (sc > prev) { store.set(key, sc); head = '최고 기록!'; }
    showOverlay(head,
      `${elapsed.toFixed(1)}초 버팀`,
      `최고 ${Math.max(sc, prev)}점 (${char.name})`);
    $('again').textContent = '다시 하기';
    updateHud();
  }

  // 시간이 지날수록 더 자주, 더 빠르게 — 35초에 최대 난이도
  const difficulty = t => Math.min(t / 22, 1);

  function push(kind, h, vy, spin) {
    const w = h * (kind.im.width / kind.im.height);
    items.push({
      kind, w, h, rot: 0, spin,
      x: Math.random() * Math.max(1, W - w),
      y: -h - 4,
      vy: vy * k,
      vx: (Math.random() - 0.5) * 90 * k    // 좌우로도 흘러서 세로만 피해서는 안 된다
    });
  }

  function spawn() {
    const d = difficulty(elapsed);
    const kind = art.hazards[Math.floor(Math.random() * art.hazards.length)];
    push(kind, (30 + Math.random() * 12) * k, 250 + Math.random() * 110 + d * 430,
         (Math.random() - 0.5) * 2.5);
  }

  function spawnFever() {
    push(art.fever, 36 * k, 190 + Math.random() * 50, 0);
  }

  function hits(it) {
    // 원(캐릭터) vs 사각형(오브제) — 사각형 판정은 조금 줄여서 관대하게
    const mx = it.w * 0.14, my = it.h * 0.14;
    const x1 = it.x + mx, x2 = it.x + it.w - mx;
    const y1 = it.y + my, y2 = it.y + it.h - my;
    const nx = clamp(px, x1, x2), ny = clamp(py, y1, y2);
    const dx = px - nx, dy = py - ny;
    return dx * dx + dy * dy < hitR() * hitR();
  }

  function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min((now - last) / 1000, 0.05);  // 탭 전환 후 순간이동 방지
    last = now;
    elapsed += dt;
    points += dt * (fever > 0 ? 2 : 1);
    if (invuln > 0) invuln -= dt;
    const wasFever = fever > 0;
    if (fever > 0) fever -= dt;
    if (wasFever !== (fever > 0)) Bgm.setFever(fever > 0);   // 곡 템포를 바꾼다

    feverTimer -= dt;
    if (feverTimer <= 0) {
      feverTimer = FEVER_EVERY * (0.7 + Math.random() * 0.6);
      spawnFever();
    }

    const interval = 0.34 - difficulty(elapsed) * 0.26;
    spawnTimer += dt;
    while (spawnTimer >= interval) { spawnTimer -= interval; spawn(); }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.x += it.vx * dt;
      if (it.x < 0) { it.x = 0; it.vx = -it.vx; }                 // 벽에서 튕긴다
      if (it.x > W - it.w) { it.x = W - it.w; it.vx = -it.vx; }
      it.rot += it.spin * dt;
      if (it.y > H + 40) { items.splice(i, 1); continue; }
      if (!hits(it)) continue;

      if (it.kind.good) {                                        // 피버 아이템
        fever = FEVER;
        Bgm.setFever(true);
        pops.push({ x: it.x + it.w / 2, y: it.y, t: 0, txt: '피버!', good: true });
        items.splice(i, 1);
      } else if (fever > 0) {
        continue;                                                // 피버 중에는 그냥 통과
      } else if (invuln <= 0) {
        lives--;
        invuln = INVULN;
        pops.push({ x: it.x + it.w / 2, y: it.y, t: 0, txt: '−1' });
        items.splice(i, 1);
        if (lives <= 0) { updateHud(); draw(); return gameOver(); }
        updateHud();
      }
    }

    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].t += dt;
      if (pops[i].t > 0.7) pops.splice(i, 1);
    }

    updateHud();
    draw();
    requestAnimationFrame(loop);
  }

  function drawCover(im) {
    const s = Math.max(W / im.width, H / im.height);
    const w = im.width * s, h = im.height * s;
    ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (!art) return;
    drawCover(art.bg);

    for (const it of items) {
      if (it.rot) {
        ctx.save();
        ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
        ctx.rotate(it.rot);
        ctx.drawImage(it.kind.im, -it.w / 2, -it.h / 2, it.w, it.h);
        ctx.restore();
      } else {
        ctx.drawImage(it.kind.im, it.x, it.y, it.w, it.h);
      }
    }

    // 무적 중에는 캐릭터가 깜빡인다
    const blink = state === 'playing' && fever <= 0 && invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    if (!blink) {
      const ph = playerH(), pw = ph * (art.player.width / art.player.height);
      ctx.globalAlpha = state === 'over' ? 0.55 : 1;
      ctx.drawImage(art.player, px - pw / 2, py - ph / 2, pw, ph);
      ctx.globalAlpha = 1;
    }

    if (fever > 0) {                       // 피버 중임을 화면 테두리로 알린다
      ctx.strokeStyle = Math.floor(fever * 8) % 2 ? '#ffe14d' : '#ff4f8b';
      ctx.lineWidth = 6 * k;
      ctx.strokeRect(3 * k, 3 * k, W - 6 * k, H - 6 * k);
    }

    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(16 * k)}px Galmuri, monospace`;
    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.7);
      ctx.fillStyle = p.good ? '#ffe14d' : '#ff5577';
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.lineWidth = 3;
      const y = p.y - p.t * 40;
      ctx.strokeText(p.txt, p.x, y);
      ctx.fillText(p.txt, p.x, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 입력 ----------
  cv.addEventListener('pointermove', e => {
    if (state !== 'playing') return;
    const r = cv.getBoundingClientRect();
    px = clamp(e.clientX - r.left, hitR(), W - hitR());   // 좌우만 따라간다
  });
  cv.addEventListener('pointerdown', e => e.preventDefault());

  // 브라우저는 사용자가 누른 직후에만 소리를 허용하므로 시작 클릭에서 함께 켠다
  let soundWanted = true;
  function syncSound() {
    $('sound').textContent = Bgm.playing ? '♪ ON' : '♪ OFF';
    $('sound').classList.toggle('off', !Bgm.playing);
  }
  $('sound').addEventListener('click', () => {
    soundWanted = !soundWanted;
    soundWanted ? Bgm.start() : Bgm.stop();
    syncSound();
  });

  const press = () => {
    if (soundWanted) Bgm.start();
    syncSound();
    if (art && state !== 'playing') start();
  };
  $('again').addEventListener('click', press);
  cv.addEventListener('pointerdown', press);
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); press(); }
  });

  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  $('go').addEventListener('click', () => choose(CHARS[sel].id));
  document.addEventListener('keydown', e => {
    if (state !== 'select') return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  const toSelect = () => {
    state = 'select';
    art = null; char = null; items = []; pops = [];
    $('play').classList.remove('on');
    $('select').style.display = '';
    buildSelect();
  };
  $('back').addEventListener('click', toSelect);
  $('quit').addEventListener('click', toSelect);

  window.addEventListener('resize', resize);
  buildSelect();
})();
