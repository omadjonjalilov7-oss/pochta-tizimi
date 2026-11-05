// Brauzer ichidagi (ilova ochiq — "foreground") bildirishnomani ko'rsatish.
//
// MUHIM (Android muammosi): Android Chrome'da `new Notification()` konstruktori
// TAQIQLANGAN — u "Illegal constructor" xatosini beradi va umuman bildirishnoma
// chiqmaydi. Android bildirishnomani FAQAT service worker registratsiyasi orqali
// (`registration.showNotification()`) ko'rsata oladi. iPhone (iOS)'da esa har
// ikkisi ham ishlaydi.
//
// Shuning uchun bu yerda avval service worker orqali ko'rsatamiz (Android + iOS +
// desktop'da birdek ishlaydi). Agar service worker topilmasa (eski desktop
// brauzer) — eski `new Notification()` usuliga qaytamiz. Bu o'zgarish iOS uchun
// qilingan push tizimiga (VAPID/sw.js) umuman tegmaydi.

async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    // `ready` faqat faol service worker bo'lgandagina hal bo'ladi — ilova
    // osilib qolmasligi uchun eng ko'pi 2 soniya kutamiz.
    const reg = await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    return reg ?? (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export async function showLocalNotification(
  title: string,
  options?: NotificationOptions,
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const opts: NotificationOptions = {
    icon: '/asaka-logo.png',
    badge: '/asaka-logo.png',
    ...options,
  };

  // 1) Avval service worker orqali — Android shuni talab qiladi.
  const reg = await swRegistration();
  if (reg && typeof reg.showNotification === 'function') {
    try {
      await reg.showNotification(title, opts);
      return;
    } catch {
      // SW orqali chiqmasa — pastda konstruktor bilan sinaymiz (desktop uchun)
    }
  }

  // 2) Service worker bo'lmasa (eski desktop brauzer) — klassik usul.
  try {
    new Notification(title, opts);
  } catch {
    // Android'da bu xato beradi — jim o'tamiz (SW allaqachon sinab bo'lingan).
  }
}
