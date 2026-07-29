import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import uz from './uz.json';
import ru from './ru.json';
import { transliterateBundle } from './translit';

// O'zbek krill varianti alohida fayl emas — lotin (uz.json) manbasidan ish
// vaqtida hosil qilinadi. `{{...}}` kod o'zgaruvchilariga tegilmaydi.
const uzc = transliterateBundle(uz);

export const SUPPORTED_LANGUAGES = [
  { code: 'uz', label: "O'zbek", labelNative: "O'zbek (lotin)" },
  { code: 'uzc', label: 'Ўзбек', labelNative: 'Ўзбек (крилл)' },
  { code: 'ru', label: 'Русский', labelNative: 'Русский язык' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uz },
      uzc: { translation: uzc },
      ru: { translation: ru },
    },
    fallbackLng: 'uz',
    supportedLngs: ['uz', 'uzc', 'ru'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pochta:lang',
    },
  });

export default i18n;

export function setLanguage(code: LanguageCode) {
  void i18n.changeLanguage(code);
  try {
    localStorage.setItem('pochta:lang', code);
  } catch {
    // ignore
  }
}

export function getLanguage(): LanguageCode {
  return (i18n.language?.split('-')[0] as LanguageCode) || 'uz';
}
