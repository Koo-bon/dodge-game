// 마음이 평안해지는 배경음. 음원 파일 없이 브라우저가 직접 소리를 만든다.
// 부드러운 빗소리(필터를 통과한 잡음) + 느린 파도 같은 볼륨 흐름 + 이따금 울리는 맑은 종소리.
// 파일을 안 쓰니 용량이 0이고 끊김 없이 무한히 이어진다.
const Asmr = (() => {
  let ctx = null, master = null, on = false, bellTimer = null;

  // 브라우저는 사용자가 한 번 누른 뒤에만 소리를 허용한다 → start()는 클릭 안에서 부른다
  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    // --- 빗소리: 갈색 잡음을 저역만 남기고 깎는다 ---
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      prev = (prev + 0.02 * white) / 1.02;   // 저역으로 기울인 잡음
      d[i] = prev * 3.5;
    }
    const rain = ctx.createBufferSource();
    rain.buffer = buf;
    rain.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.5;

    // --- 파도처럼 아주 느리게 커지고 작아지는 흐름 ---
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;              // 약 16초 주기
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.18;
    lfo.connect(lfoDepth).connect(rainGain.gain);
    lfo.start();

    rain.connect(lp).connect(rainGain).connect(master);
    rain.start();
    return true;
  }

  // --- 이따금 울리는 맑은 종소리 (5음 음계라 어떤 순서로 나도 어울린다) ---
  const NOTES = [523.25, 587.33, 698.46, 783.99, 880.0];
  function bell() {
    if (!on) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = NOTES[Math.floor(Math.random() * NOTES.length)];
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 3.4);
    bellTimer = setTimeout(bell, 3500 + Math.random() * 5000);
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
      if (!ctx && !build()) return false;    // 소리를 못 만드는 브라우저면 조용히 포기
      ctx.resume?.();
      on = true;
      fade(0.5, 2);
      if (!bellTimer) bell();
      return true;
    },
    stop() {
      if (!ctx) return;
      on = false;
      fade(0, 0.6);
      clearTimeout(bellTimer);
      bellTimer = null;
    },
    toggle() { return this.playing ? (this.stop(), false) : this.start(); }
  };
})();
