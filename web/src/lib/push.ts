import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

let started = false;
let lastToken: string | null = null;

export async function registerPush() {
  if (!Capacitor.isNativePlatform()) return;
  if (started) return;
  started = true;

  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      started = false;
      return;
    }

    await PushNotifications.addListener('registration', async (token) => {
      lastToken = token.value;
      try {
        await api.post('/push/register', {
          token: token.value,
          platform: Capacitor.getPlatform(),
        });
      } catch {
        // tarmoq xatosi — keyingi ochilishda qayta yuboriladi
      }
    });

    await PushNotifications.addListener('registrationError', () => {
      started = false;
    });

    await PushNotifications.register();
  } catch {
    started = false;
  }
}

export async function unregisterPush() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (lastToken) {
      await api.post('/push/unregister', { token: lastToken });
    }
  } catch {
    // ignore
  }
  try {
    await PushNotifications.removeAllListeners();
  } catch {
    // ignore
  }
  started = false;
  lastToken = null;
}
