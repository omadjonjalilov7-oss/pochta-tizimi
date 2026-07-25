// "ichki" avtomat shablon diagnostikasi. Serverda ishga tushiring:
//   cd /var/www/pochta/server && node scripts/diag-ichki.js
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1) auto_filled ustuni bormi?
  let colOk = false;
  try {
    await p.$queryRawUnsafe('SELECT auto_filled FROM documents LIMIT 1');
    colOk = true;
  } catch (e) {
    colOk = false;
  }
  console.log('1) documents.auto_filled ustuni:', colOk ? 'BOR ✓' : 'YO\'Q ✗ (migration qo\'llanmagan)');

  // 2) "ichki" shablon
  const tpl = await p.documentTemplate.findFirst({
    where: { name: { equals: 'ichki', mode: 'insensitive' } },
    select: { id: true, name: true, category: true, bodyTemplate: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!tpl) {
    const all = await p.documentTemplate.findMany({ select: { name: true } });
    console.log('2) "ichki" shablon: YO\'Q ✗. Mavjud shablonlar:', all.map((t) => t.name));
  } else {
    const hasBare = /_(?:asaka|sana)_\d+/.test(tpl.bodyTemplate);
    console.log('2) "ichki" shablon: BOR ✓  (_asaka/_sana joylari:', hasBare ? 'BOR ✓' : 'YO\'Q ✗', ')');
  }

  // 3) Tasdiqlash zanjiri
  const logins = ['aziza', 'raxmatjon', 'abduxalil', 'mirzaxid'];
  const users = await p.user.findMany({
    where: { login: { in: logins } },
    select: { login: true, fullName: true, isActive: true },
  });
  const found = new Set(users.map((u) => u.login));
  const missing = logins.filter((l) => !found.has(l));
  const inactive = users.filter((u) => !u.isActive).map((u) => u.login);
  console.log('3) Zanjir loginlari topildi:', users.map((u) => `${u.login}(${u.isActive ? 'faol' : 'FAOL EMAS'})`));
  if (missing.length) console.log('   YETISHMAYDI ✗:', missing);
  if (inactive.length) console.log('   FAOL EMAS ✗:', inactive);

  // 4) So'nggi 5 hujjat: autoFilled holati
  if (colOk) {
    const docs = await p.document.findMany({
      select: { number: true, type: true, status: true, autoFilled: true, templateId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('4) So\'nggi 5 hujjat:');
    for (const d of docs) {
      console.log(`   ${d.number} [${d.type}/${d.status}] autoFilled=${d.autoFilled} templateId=${d.templateId ? 'bor' : 'yo\'q'}`);
    }
  }
})()
  .catch((e) => console.error('XATO:', e.message))
  .finally(() => p.$disconnect());
