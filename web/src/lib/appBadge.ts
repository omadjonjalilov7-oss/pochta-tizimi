// PWA ilova belgisi (app icon badge) — telefon bosh ekranidagi ilova
// ikonkasida o'qilmagan xabarlar sonini ko'rsatadi (Badging API).
//   - Qo'llab-quvvatlasa: Android Chrome (o'rnatilgan PWA), desktop Chrome/Edge.
//     iOS Safari hali to'liq qo'llamaydi — jim o'tadi.
//   - Pochta (xat) va chat sonlari alohida kelgani uchun ikkalasini shu yerda
//     yig'ib, umumiy sonni bir joyda o'rnatamiz (aks holda bir-birini bosadi).

let mailCount = 0;
let chatCount = 0;

function apply() {
  const total = mailCount + chatCount;
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge === 'function') {
      if (total > 0) void nav.setAppBadge(total).catch(() => undefined);
      else void nav.clearAppBadge?.().catch(() => undefined);
    }
  } catch {
    // Qo'llab-quvvatlanmasa — e'tiborsiz qoldiramiz
  }
}

export function setMailBadge(n: number) {
  mailCount = Math.max(0, Math.trunc(n) || 0);
  apply();
}

export function setChatBadge(n: number) {
  chatCount = Math.max(0, Math.trunc(n) || 0);
  apply();
}
