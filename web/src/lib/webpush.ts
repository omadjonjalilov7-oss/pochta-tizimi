import { Capacitor } from '@capacitor/core';
import { api } from './api';

// PWA web-push (VAPID) — iPhone Safari (16.4+) bosh ekranga qo'shilgach va
// brauzerlarda ishlaydi. Android Capacitor ilovasida (native) FCM ishlatiladi,
// shuning uchun bu yerda native'ni chetlab o'tamiz (ikki marta kelmasligi uchun).

let subscribing = false;
let currentEndpoint: string | null = null;

function supported(): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buf;
}

// Service worker'ni ro'yxatdan o'tkazadi (ruxsat so'ramaydi — jim).
// Ilova ochilishida chaqirsa bo'ladi.
export async function ensureServiceWorker(): Promise<void> {
  if (!supported()) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    // ignore
  }
}

// Ruxsat allaqachon berilgan bo'lsa — jim obuna bo'ladi (gesture shart emas).
// Agar ruxsat hali so'ralmagan bo'lsa (default) — iOS'da foydalanuvchi
// bosishi (tugma) kerak, shu sabab bu funksiya tugmadan ham chaqiriladi.
export async function registerWebPush(): Promise<void> {
  if (!supported()) return;
  if (subscribing) return;
  subscribing = true;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') {
      subscribing = false;
      return;
    }

    const { data } = await api.get<{ key: string }>('/push/vapid-public-key');
    if (!data?.key) {
      subscribing = false;
      return;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(data.key),
      });
    }

    const json = sub.toJSON();
    currentEndpoint = sub.endpoint;
    await api.post('/push/web/subscribe', {
      subscription: {
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      },
      platform: 'web',
    });
  } catch {
    // ignore — keyingi urinishda qayta sinaladi
  } finally {
    subscribing = false;
  }
}

export async function unregisterWebPush(): Promise<void> {
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    const endpoint = currentEndpoint || sub?.endpoint;
    if (endpoint) {
      await api.post('/push/web/unsubscribe', { endpoint });
    }
  } catch {
    // ignore
  }
  currentEndpoint = null;
}

// Hozirgi qurilmada bildirishnoma holati (ProfilePage tugmasi uchun).
export function webPushStatus(): 'unsupported' | 'granted' | 'denied' | 'default' {
  if (!supported()) return 'unsupported';
  return Notification.permission as 'granted' | 'denied' | 'default';
}
