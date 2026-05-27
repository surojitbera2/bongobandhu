// Generate a two-tone phone-style ringtone using WebAudio. No external file.
// .start() loops until .stop() is called. Safe to call .start() multiple times.

let ctx = null;
let timer = null;
let gainNode = null;

const tone = (freq, durMs) => {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(gainNode);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.18, now + 0.02);
  g.gain.linearRampToValueAtTime(0, now + durMs / 1000);
  osc.start(now);
  osc.stop(now + durMs / 1000 + 0.05);
};

const ringPattern = () => {
  // Indian-style double-ring: two ~400ms tones, ~2s gap, repeat.
  tone(450, 400);
  setTimeout(() => tone(450, 400), 600);
};

export const ringtone = {
  start() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        gainNode = ctx.createGain();
        gainNode.gain.value = 0.5;
        gainNode.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      if (timer) return;
      ringPattern();
      timer = setInterval(ringPattern, 2200);
    } catch {}
  },
  stop() {
    if (timer) { clearInterval(timer); timer = null; }
    try { if (ctx && ctx.state !== "closed") ctx.suspend().catch(() => {}); } catch {}
  },
};
