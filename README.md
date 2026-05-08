# Pochta — Korporativ pochta tizimi

100 nafar xodim uchun ichki tarmoq pochtasi (Windows Server).

## Hujjatlar
- [`docs/TZ.md`](docs/TZ.md) — Texnik topshiriq (rahbariyatga ko'rsatish uchun)
- [`docs/01_PostgreSQL_o'rnatish.md`](docs/01_PostgreSQL_o'rnatish.md) — PostgreSQL'ni o'rnatish qo'llanmasi

## Texnologiyalar
- **Backend:** NestJS (Node.js) + Prisma + PostgreSQL + Socket.io
- **Frontend:** React + TypeScript + Vite + TailwindCSS *(keyingi bosqichda)*
- **Desktop:** Electron *(keyingi bosqichda)*

## Tuzilma
```
pochta/
├── docs/        — texnik topshiriq va qo'llanmalar
├── server/      — backend (NestJS)
├── web/         — frontend (React) — keyingi bosqichda
└── README.md    — bu fayl
```

## Ishga tushirish ketma-ketligi (birinchi marta)

### 1-bosqich: PostgreSQL
`docs/01_PostgreSQL_o'rnatish.md` qo'llanmasiga amal qiling.

### 2-bosqich: Backend
`server/README.md` qo'llanmasiga amal qiling. Qisqacha:
```powershell
cd C:\D\pochta\server
copy .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

### 3-bosqich: Frontend (keyingi bosqichda)
*Hozircha yo'q. Backend ishga tushgandan keyin yaratamiz.*

## Joriy holat (2026-05-08)

✅ TZ tayyor
✅ Backend skeletoni to'liq yozildi:
   - Autentifikatsiya (JWT)
   - Xodimlar boshqaruvi
   - Bo'limlar va lavozimlar
   - Xabar yuborish + qabul qilish
   - Real-time bildirishnomalar (Socket.io)
   - Fayl yuklash/yuklab olish
   - Audit log
   - Admin huquqlari

⏳ PostgreSQL'ni o'rnatish — foydalanuvchi tomonidan
⏳ npm install + migratsiya
⏳ Frontend (React)
⏳ Desktop ilova (Electron)
