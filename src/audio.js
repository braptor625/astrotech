// AstroTech — tiny chiptune SFX synth (WebAudio, no assets)
(function (AT) {
  'use strict';
  const A = AT.audio = {};
  let ctx = null, master = null, last = {};
  A.enabled = () => !!(AT.E.S && AT.E.S.settings.sound);
  A.unlock = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.18; master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  };
  function tone(freq, dur, type, vol, slide, delay) {
    if (!ctx || !A.enabled()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    if (!ctx || !A.enabled()) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = ctx.createGain(); g.gain.value = vol || 0.4;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function throttle(name, ms) {
    const now = performance.now();
    if (last[name] && now - last[name] < ms) return true;
    last[name] = now; return false;
  }
  A.play = function (name) {
    if (!ctx || !A.enabled()) return;
    switch (name) {
      case 'mine': if (throttle('mine', 40)) return; noise(0.06, 0.35, 1200); tone(180 + Math.random() * 60, 0.05, 'square', 0.2, 0.5); break;
      case 'break': noise(0.25, 0.5, 300); tone(110, 0.2, 'triangle', 0.4, 0.4); break;
      case 'buy': if (throttle('buy', 50)) return; tone(520, 0.06, 'square', 0.3); tone(780, 0.08, 'square', 0.3, 1, 0.05); break;
      case 'sell': if (throttle('sell', 60)) return; tone(988, 0.06, 'square', 0.3); tone(1319, 0.12, 'square', 0.3, 1, 0.06); break;
      case 'research': tone(440, 0.1, 'triangle', 0.4); tone(660, 0.1, 'triangle', 0.4, 1, 0.08); tone(880, 0.18, 'triangle', 0.4, 1, 0.16); break;
      case 'deny': if (throttle('deny', 120)) return; tone(140, 0.12, 'square', 0.3, 0.8); break;
      case 'tab': if (throttle('tab', 40)) return; tone(660, 0.03, 'square', 0.15); break;
      case 'ach': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.25, 1, i * 0.08)); break;
      case 'prestige': [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.4, 1, i * 0.07)); noise(0.8, 0.2, 200); break;
      case 'launch': if (throttle('launch', 400)) return; noise(1.4, 0.35, 120); tone(70, 1.2, 'sawtooth', 0.25, 0.6); break;
      case 'return': if (throttle('return', 200)) return; tone(392, 0.08, 'square', 0.25); tone(523, 0.12, 'square', 0.25, 1, 0.08); break;
      case 'lost': tone(220, 0.3, 'sawtooth', 0.3, 0.4); tone(110, 0.5, 'sawtooth', 0.3, 0.5, 0.25); noise(0.6, 0.3, 300); break;
      case 'card': tone(660, 0.07, 'triangle', 0.3); tone(880, 0.07, 'triangle', 0.3, 1, 0.09); break;
      case 'select': if (throttle('select', 40)) return; tone(880, 0.03, 'square', 0.12); break;
      case 'alarm': tone(330, 0.15, 'sawtooth', 0.2, 0.7); tone(330, 0.15, 'sawtooth', 0.2, 0.7, 0.2); break;
    }
  };
})(window.AT = window.AT || {});
