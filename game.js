(() => {
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const overlay = $('over');

  const PLAYER_H = 78;        // 캐릭터 그리는 높이(px)
  const HIT_R = 20;           // 캐릭터 판정 반지름(그림보다 작게 — 억울한 피격 방지)
  const PAD_Y = PLAYER_H / 2; // 스프라이트가 위아래로 잘리지 않게 두는 여백
  const LIVES = 3;
  const INVULN = 1.2;         // 피격 후 무적 시간(초)

  // 시크릿 모드·일부 브라우저에서 localStorage 접근 자체가 예외를 던진다
  const store = {
    get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch {} }
  };
  const bestKey = id => `fall.best.${id}`;

  const imgCache = new Map();
  function loadImage(name) {
    if (imgCache.has(name)) return imgCache.get(name);
    const p = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(`이미지 로드 실패: ${name}`));
      im.src = `assets/${name}.png`;
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

    $('charImg').src = `assets/char-${c.id}.png`;
    $('charImg').alt = c.name;
    $('prevImg').src = `assets/char-${prev.id}.png`;
    $('nextImg').src = `assets/char-${next.id}.png`;
    $('frame').style.background = c.tint;

    $('cname').textContent = c.name;
    $('cteam').textContent = c.team;
    $('cplace').textContent = c.place;
    $('cconcept').textContent = c.costume;
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

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const score = () => Math.floor(elapsed);

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
      const [bg, player, ...rest] = await Promise.all([
        loadImage(`bg-${char.id}`),
        loadImage(`char-${char.id}`),
        ...HAZARDS.map(h => loadImage(h.img))
      ]);
      art = { bg, player, hazards: HAZARDS.map((h, i) => ({ ...h, im: rest[i] })) };
    } catch (e) {
      showOverlay('이미지를 못 불러왔습니다', e.message, '새로고침해 주세요');
      return;
    }
    $('again').style.display = '';
    $('again').textContent = '시작';
    showOverlay(char.name,
      `${HAZARDS.map(h => h.name).join('과 ')}을 피하세요`,
      `목숨 ${LIVES}개 · 버틴 1초가 1점`);
    draw();
  }

  function showOverlay(t, s, h) {
    $('overT').textContent = t;
    $('overS').innerHTML = s;
    $('overH').innerHTML = h;
    overlay.classList.remove('hide');
  }

  function resize() {
    W = Math.min(480, window.innerWidth - 30);
    H = Math.min(640, window.innerHeight - 190);
    if (H < 320) H = 320;
    const dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (state === 'playing') {
      px = clamp(px, HIT_R, W - HIT_R);
      py = clamp(py, PAD_Y, H - PAD_Y);
    } else {
      px = W / 2;
      py = H - PAD_Y;
    }
    if (art) draw();
  }

  function start() {
    items = []; pops = [];
    elapsed = 0; lives = LIVES; invuln = 0; spawnTimer = 0;
    px = W / 2; py = H - PAD_Y;
    state = 'playing';
    overlay.classList.add('hide');
    updateHud();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function updateHud() {
    $('score').textContent = score();
    $('hp').textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(LIVES - Math.max(0, lives));
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

  // 시간이 지날수록 더 자주, 더 빠르게 — 60초에 최대 난이도
  const difficulty = t => Math.min(t / 60, 1);

  function spawn() {
    const d = difficulty(elapsed);
    const kind = art.hazards[Math.floor(Math.random() * art.hazards.length)];
    const h = 30 + Math.random() * 12;
    const w = h * (kind.im.width / kind.im.height);
    items.push({
      kind, w, h,
      x: Math.random() * Math.max(1, W - w),
      y: -h - 4,
      vy: 160 + Math.random() * 80 + d * 250,
      spin: (Math.random() - 0.5) * 2.5,
      rot: 0
    });
  }

  function hits(it) {
    // 원(캐릭터) vs 사각형(오브제) — 사각형 판정은 조금 줄여서 관대하게
    const mx = it.w * 0.14, my = it.h * 0.14;
    const x1 = it.x + mx, x2 = it.x + it.w - mx;
    const y1 = it.y + my, y2 = it.y + it.h - my;
    const nx = clamp(px, x1, x2), ny = clamp(py, y1, y2);
    const dx = px - nx, dy = py - ny;
    return dx * dx + dy * dy < HIT_R * HIT_R;
  }

  function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min((now - last) / 1000, 0.05);  // 탭 전환 후 순간이동 방지
    last = now;
    elapsed += dt;
    if (invuln > 0) invuln -= dt;

    const interval = 0.60 - difficulty(elapsed) * 0.40;
    spawnTimer += dt;
    while (spawnTimer >= interval) { spawnTimer -= interval; spawn(); }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.rot += it.spin * dt;
      if (it.y > H + 40) { items.splice(i, 1); continue; }
      if (!hits(it)) continue;

      if (invuln <= 0) {
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
    const blink = state === 'playing' && invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    if (!blink) {
      const ph = PLAYER_H, pw = ph * (art.player.width / art.player.height);
      ctx.globalAlpha = state === 'over' ? 0.55 : 1;
      ctx.drawImage(art.player, px - pw / 2, py - ph / 2, pw, ph);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = 'center';
    ctx.font = 'bold 16px Galmuri, monospace';
    for (const p of pops) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 0.7);
      ctx.fillStyle = '#ff5577';
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
    px = clamp(e.clientX - r.left, HIT_R, W - HIT_R);
    py = clamp(e.clientY - r.top, PAD_Y, H - PAD_Y);
  });
  cv.addEventListener('pointerdown', e => e.preventDefault());

  const press = () => { if (art && state !== 'playing') start(); };
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
