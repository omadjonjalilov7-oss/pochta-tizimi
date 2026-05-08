import { useSyncExternalStore } from 'react';

export type DesignId = 'classic' | 'gmail' | 'outlook' | 'yandex';

export interface DesignOption {
  id: DesignId;
  name: string;
  description: string;
}

export const DESIGNS: DesignOption[] = [
  {
    id: 'classic',
    name: 'Klassik',
    description: 'Standart Pochta ko\'rinishi (yuqorida brand panel, sidebar, ro\'yxat)',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Chap tomonda katta «Yozish» tugmasi, zich xabarlar ro\'yxati',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: '3 ustunli: menyu + xabarlar ro\'yxati + xabar yonma-yon ochiladi',
  },
  {
    id: 'yandex',
    name: 'Yandex Mail',
    description: 'Kompakt yuqori panel, juda zich ro\'yxat, minimal stil',
  },
];

const KEY = 'pochta_design';
const EVENT = 'pochta:design-change';

export function getStoredDesign(): DesignId {
  const v = localStorage.getItem(KEY) as DesignId | null;
  return v && DESIGNS.some((d) => d.id === v) ? v : 'classic';
}

export function setStoredDesign(id: DesignId) {
  localStorage.setItem(KEY, id);
  applyDesign(id);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

export function applyDesign(id: DesignId) {
  const root = document.documentElement;
  if (id === 'classic') {
    root.removeAttribute('data-design');
  } else {
    root.setAttribute('data-design', id);
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useDesign(): DesignId {
  return useSyncExternalStore(subscribe, getStoredDesign, getStoredDesign);
}
