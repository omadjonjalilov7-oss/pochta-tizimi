/*
 * BIR MARTALIK skript: bazadagi eski (buzilgan / mojibake) fayl nomlarini
 * to'g'ri UTF-8 ga qaytaradi. Kirill, xitoy va boshqa belgilar tiklanadi.
 *
 * Ishga tushirish (server papkasida):
 *   node scripts/fix-filenames.js           // faqat ko'rsatadi (o'zgartirmaydi)
 *   node scripts/fix-filenames.js --apply   // haqiqatan tuzatadi
 *
 * Xavfsiz: nomni faqat u aniq "buzilgan" bo'lsagina o'zgartiradi (barcha
 * belgilar 0..255 oralig'ida bo'lsa). Allaqachon to'g'ri (kirill) nomlar
 * tegilmaydi.
 */
const fs = require('fs');
const path = require('path');

// .env dan DATABASE_URL ni qo'lda o'qiymiz (qo'shimcha kutubxonasiz).
(function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
})();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Nom aniq buzilganmi? Barcha belgilar 0..255 (latin1) oralig'ida bo'lsa —
// bu mojibake bo'lishi mumkin. Qayta kodlab, natija farq qilsa va U+FFFD
// bo'lmasa — tuzatilgan deb hisoblaymiz.
function fixName(name) {
  if (!name) return null;
  // Agar nomda 255 dan katta belgi bor bo'lsa — u allaqachon to'g'ri UTF-8.
  for (let i = 0; i < name.length; i++) {
    if (name.charCodeAt(i) > 255) return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return null;
  }
  if (!decoded || decoded === name) return null;
  if (decoded.includes('\uFFFD')) return null;
  return decoded;
}

async function fixModel(label, model) {
  const rows = await model.findMany({ select: { id: true, filename: true } });
  let changed = 0;
  for (const r of rows) {
    const fixed = fixName(r.filename);
    if (!fixed) continue;
    changed++;
    console.log(`  [${label}] "${r.filename}"  ->  "${fixed}"`);
    if (APPLY) {
      await model.update({ where: { id: r.id }, data: { filename: fixed } });
    }
  }
  console.log(`  [${label}] jami: ${rows.length}, tuzatiladi: ${changed}`);
  return changed;
}

const APPLY = process.argv.includes('--apply');

(async () => {
  console.log(
    APPLY
      ? '=== TUZATISH REJIMI (--apply): o\'zgarishlar bazaga yoziladi ==='
      : '=== KO\'RISH REJIMI: hech narsa o\'zgartirilmaydi (tuzatish uchun --apply qo\'shing) ===',
  );
  let total = 0;
  total += await fixModel('EDO hujjat', prisma.documentAttachment);
  total += await fixModel('Umumiy fayl', prisma.attachment);
  total += await fixModel('Chat', prisma.chatAttachment);
  total += await fixModel('Guruh chat', prisma.chatGroupAttachment);
  console.log(`\nJAMI tuzatildi: ${total}`);
  if (!APPLY && total > 0) {
    console.log('Haqiqatan tuzatish uchun: node scripts/fix-filenames.js --apply');
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('Xatolik:', e);
  await prisma.$disconnect();
  process.exit(1);
});
