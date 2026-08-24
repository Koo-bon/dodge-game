// 귀여운 8비트 배경음. 음원 파일 없이 브라우저가 직접 연주한다.
// 5음 음계라 어떤 음이 겹쳐도 안 부딪히고, 피버타임에는 템포가 1.6배로 빨라진다.
// 파일을 안 쓰니 용량이 0이고 끊김 없이 무한히 이어진다.
const Bgm = (() => {
  const P = [0, 2, 4, 7, 9, 12, 14, 16];          // 도레미솔라 (5음 음계)
  const MELODY = [0, 2, 3, 4, 3, 2, 0, null,      // 16칸 한 마디
                  1, 2, 3, 4, 5, 4, 2, null];
  const BASS = [0, null, null, null, 3, null, null, null,
                4, null, null, null, 2, null, null, null];
  const BPM = 112, FEVER_RATE = 1.6;

  const hz = semi => 261.63 * Math.pow(2, semi / 12);   // C4 기준

  let ctx = null, master = null, on = false, fever = false;
  let step = 0, nextTime = 0, timer = null;

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    return true;
  }

  // 8비트 느낌의 짧은 음 하나
  function note(type, freq, at, dur, vol) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // 통통 튀는 타악기 (짧은 잡음)
  function tick(at, vol) {
    const n = 0.03 * ctx.sampleRate | 0;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(hp).connect(g).connect(master);
    src.start(at);
  }

  function stepDur() { return 60 / (BPM * (fever ? FEVER_RATE : 1)) / 4; }

  // 조금 앞서서 미리 예약해 둬야 소리가 끊기지 않는다
  function schedule() {
    if (!on) return;
    const dur = stepDur();
    while (nextTime < ctx.currentTime + 0.15) {
      const i = step % 16;
      const m = MELODY[i];
      if (m !== null) note('square', hz(P[m] + 12), nextTime, dur * 1.6, fever ? 0.10 : 0.075);
      const b = BASS[i];
      if (b !== null) note('triangle', hz(P[b] - 12), nextTime, dur * 3.2, 0.13);
      if (i % 4 === 2) tick(nextTime, fever ? 0.06 : 0.035);
      if (fever && i % 2 === 1) note('square', hz(P[(m ?? 0)] + 24), nextTime, dur * 0.8, 0.04);
      nextTime += dur;
      step++;
    }
    timer = setTimeout(schedule, 25);
  }

  function fade(to, sec) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(to, t + sec);
  }

  return {
    get playing() { return on; },
    start() {
      if (!ctx && !build()) return false;    // 소리를 못 내는 브라우저면 조용히 포기
      ctx.resume?.();
      if (!on) {
        on = true;
        nextTime = ctx.currentTime + 0.05;
        schedule();
      }
      fade(0.5, 1.2);
      return true;
    },
    stop() {
      if (!ctx) return;
      on = false;
      fade(0, 0.4);
      clearTimeout(timer);
      timer = null;
    },
    // 피버타임에는 같은 곡이 더 빠르고 화려하게 흐른다
    setFever(v) { fever = !!v; }
  };
})();
