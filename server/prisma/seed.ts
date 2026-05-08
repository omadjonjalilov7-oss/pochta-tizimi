import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Boshlang\'ich ma\'lumotlar yaratilmoqda...');

  // Lavozimlar
  const positionsData = [
    { name: 'Direktor', rank: 1 },
    { name: 'Bosh direktor o\'rinbosari', rank: 2 },
    { name: 'Direktor o\'rinbosari', rank: 3 },
    { name: 'Bo\'lim boshlig\'i', rank: 10 },
    { name: 'Bosh mutaxassis', rank: 20 },
    { name: 'Yetakchi mutaxassis', rank: 25 },
    { name: 'Mutaxassis', rank: 30 },
    { name: 'Kotib', rank: 40 },
    { name: 'Texnik xodim', rank: 50 },
    { name: 'Administrator', rank: 100 },
  ];
  for (const p of positionsData) {
    await prisma.position.upsert({ where: { name: p.name }, create: p, update: { rank: p.rank } });
  }

  // Bo'limlar
  const departmentsData = [
    'Direksiya',
    'IT bo\'limi',
    'Buxgalteriya',
    'Kadrlar bo\'limi',
    'Yuridik bo\'lim',
    'Marketing',
    'Xizmat ko\'rsatish',
  ];
  for (const name of departmentsData) {
    await prisma.department.upsert({ where: { name }, create: { name }, update: {} });
  }

  // Administrator akkaunti
  const adminLogin = 'admin';
  const adminPassword = 'Admin@2026';
  const exists = await prisma.user.findUnique({ where: { login: adminLogin } });
  if (!exists) {
    const adminPosition = await prisma.position.findUnique({ where: { name: 'Administrator' } });
    const itDept = await prisma.department.findUnique({ where: { name: 'IT bo\'limi' } });
    await prisma.user.create({
      data: {
        login: adminLogin,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        fullName: 'Tizim administratori',
        email: 'admin@pochta.local',
        departmentId: itDept?.id,
        positionId: adminPosition?.id,
        isAdmin: true,
        canSendExternal: true,
      },
    });
    console.log('---');
    console.log(`Admin yaratildi:`);
    console.log(`  Login:  ${adminLogin}`);
    console.log(`  Parol:  ${adminPassword}`);
    console.log(`  ⚠️  Birinchi kirgandan keyin parolni o'zgartiring!`);
    console.log('---');
  } else {
    console.log('Admin allaqachon mavjud, o\'tkazib yuborildi.');
  }

  console.log('Tayyor ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
