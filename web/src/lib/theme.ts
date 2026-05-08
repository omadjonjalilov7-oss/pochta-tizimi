export type ThemeId = 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'dark';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  preview: string; // ko'rinish uchun asosiy rang
}

export const THEMES: ThemeOption[] = [
  {
    id: 'blue',
    name: 'Korparativ ko\'k',
    description: 'Asosiy korporativ tema',
    preview: '#2563eb',
  },
  {
    id: 'green',
    name: 'Yashil',
    description: 'Yumshoq, tinch tema',
    preview: '#16a34a',
  },
  {
    id: 'amber',
    name: 'Sariq',
    description: 'Yandex uslubidagi yorqin tema',
    preview: '#d97706',
  },
  {
    id: 'rose',
    name: 'Pushti',
    description: 'Iliq, dramatik tema',
    preview: '#e11d48',
  },
  {
    id: 'violet',
    name: 'Binafsha',
    description: 'Zamonaviy, sof tema',
    preview: '#7c3aed',
  },
  {
    id: 'dark',
    name: 'To\'q rejim',
    description: 'Ko\'z uchun yumshoq qora fon',
    preview: '#1e293b',
  },
];

const THEME_KEY = 'pochta_theme';

export function getStoredTheme(): ThemeId {
  const v = localStorage.getItem(THEME_KEY) as ThemeId | null;
  return v && THEMES.some((t) => t.id === v) ? v : 'blue';
}

export function setStoredTheme(id: ThemeId) {
  localStorage.setItem(THEME_KEY, id);
  applyTheme(id);
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === 'blue') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', id);
  }
}
