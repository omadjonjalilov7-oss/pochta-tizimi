// Chat xabari kelganda "ding-dong" eshik qo'ng'irog'i tovushi.
// Binar audio fayl ishlatilmaydi — tovush Web Audio API bilan sintez qilinadi,
// shu bois qo'shimcha resurs (mp3 va h.k.) talab qilinmaydi.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

// Bitta qo'ng'iroq notasi: tez ko'tarilish, keyin eksponensial so'nish (bell).
function ring(ac: AudioContext, freq: number, startAt: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;

  const dur = 0.9;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.35, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
}

// Ikki nota: "ding" (baland) → "dong" (past). Klassik eshik qo'ng'irog'i.
export function playChatDing(): void {
  const ac = getCtx();
  if (!ac) return;
  // Brauzer autoplay siyosati: kontekst to'xtagan bo'lsa tiklaymiz.
  if (ac.state === 'suspended') ac.resume().catch(() => undefined);
  const t = ac.currentTime;
  ring(ac, 659.25, t); // E5 — "ding"
  ring(ac, 523.25, t + 0.32); // C5 — "dong"
}
