import i18n from '../i18n';
import { latinToCyrillic } from '../i18n/translit';

// Ichki foydalanuvchi FISH (familiya-ism-otasining ismi) — til tanlovidan
// qat'iy nazar DOIM krill alifbosida ko'rsatiladi (foydalanuvchi talabiga ko'ra).
export function cyrName(s?: string | null): string {
  return latinToCyrillic(s ?? '');
}

// Dinamik DB matni (jurnal / bo'lim / lavozim nomi): lotin tanlansa asl holida,
// krill yoki rus tanlansa krill alifbosiga o'giriladi.
export function trDyn(s?: string | null): string {
  const text = s ?? '';
  if (!text) return text;
  const lang = (i18n.language || 'uz').split('-')[0];
  return lang === 'uz' ? text : latinToCyrillic(text);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}:${sec}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function formatBytes(bytes: number): string {
  const t = i18n.t.bind(i18n);
  if (bytes < 1024) return `${bytes} ${t('common.bytes')}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t('common.kb')}`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} ${t('common.mb')}`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ${t('common.gb')}`;
}

export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Xabar yuboruvchisining ko'rsatiluvchi nomi (ichki yoki tashqi).
 * - Ichki user bo'lsa: u.fullName
 * - Tashqi pochta bo'lsa: externalFromName yoki externalFromEmail
 */
export function senderDisplayName(message: {
  fromUser?: { fullName?: string | null } | null;
  externalFromName?: string | null;
  externalFromEmail?: string | null;
  isExternal?: boolean;
}): string {
  if (message.fromUser?.fullName) return cyrName(message.fromUser.fullName);
  if (message.externalFromName) return message.externalFromName;
  if (message.externalFromEmail) return message.externalFromEmail;
  return i18n.t('common.unknown');
}

export function senderSubLine(message: {
  fromUser?: { position?: { name?: string | null } | null; department?: { name?: string | null } | null } | null;
  externalFromEmail?: string | null;
  isExternal?: boolean;
}): string {
  if (message.fromUser) {
    const pos = trDyn(message.fromUser.position?.name);
    const dep = trDyn(message.fromUser.department?.name);
    return [pos, dep].filter(Boolean).join(' • ');
  }
  if (message.isExternal && message.externalFromEmail) return message.externalFromEmail;
  return '';
}

/**
 * HTML tags'ni olib, xabar preview'ni tozalash
 * HTML o'rniga plain text ko'rsatadi
 */
export function stripHtmlForPreview(html: string | undefined | null, maxLength: number = 80): string {
  if (!html) return '';

  // HTML tags va entities'ni olib tashlash
  let text = html
    .replace(/<[^>]*>/g, ' ') // HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .trim();

  return text.slice(0, maxLength);
}
