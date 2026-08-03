// Multer (busboy) yuklangan fayl nomini `latin1` sifatida o'qiydi. Shu sababli
// kirill, xitoy va boshqa UTF-8 belgilar buzilib ("mojibake") saqlanadi
// (masalan "Просовал" -> "ÐÑ€Ð¾ÑÐ¾Ð²Ð°Ð»"). Bu funksiya nomni to'g'ri
// UTF-8 ga qaytaradi, faylni o'z holicha (kirill/lotin/xitoycha) saqlaydi.
export function decodeMulterFilename(name: string | undefined | null): string {
  if (!name) return '';
  try {
    // latin1 baytlarni UTF-8 sifatida qayta o'qish.
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    // Agar qayta o'qishda almashtirish belgisi (U+FFFD) paydo bo'lsa —
    // nom aslida to'g'ri UTF-8 bo'lgan, o'zgartirmaymiz.
    if (decoded.includes('\uFFFD')) return name;
    return decoded;
  } catch {
    return name;
  }
}
