# Pochta — Backend

NestJS + Prisma + PostgreSQL + Socket.io

## Birinchi marta o'rnatish

### 1. PostgreSQL'ni o'rnating
`docs/01_PostgreSQL_o'rnatish.md` qo'llanmasiga amal qiling.

### 2. .env faylini yarating
`.env.example` ni `.env` ga nusxalang va parolni o'zgartiring:

```powershell
copy .env.example .env
```

`.env` ichida `DATABASE_URL` va `JWT_SECRET` ni o'z qiymatlariga moslang.

JWT secret generatsiya qilish uchun PowerShell'da:
```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. Paketlarni o'rnating
```powershell
cd C:\D\pochta\server
npm install
```

### 4. Bazani yarating va migratsiya qiling
```powershell
npx prisma migrate dev --name init
```

Bu buyruq:
- `pochta` bazasida barcha jadvallarni yaratadi
- Prisma Client'ni generatsiya qiladi

### 5. Boshlang'ich ma'lumotlarni qo'shing (admin akkaunt + lavozimlar + bo'limlar)
```powershell
npm run seed
```

Console'da admin login va parol ko'rinadi:
```
Login:  admin
Parol:  Admin@2026
```
**⚠️ Birinchi kirgandan keyin parolni o'zgartiring!**

### 6. Serverni ishga tushiring
```powershell
npm run start:dev
```

Server: http://localhost:3000

## API endpointlar

### Auth
- `POST /api/auth/login` — kirish (`{ login, password, rememberMe? }`)
- `GET /api/auth/me` — joriy foydalanuvchi (Bearer token kerak)

### Foydalanuvchilar
- `GET /api/users` — barcha xodimlar (lavozim bo'yicha tartiblangan)
- `GET /api/users/:id` — bitta xodim
- `POST /api/users` (admin) — yangi xodim
- `PATCH /api/users/:id` (admin) — tahrirlash
- `DELETE /api/users/:id` (admin) — o'chirish
- `POST /api/users/:id/reset-password` (admin) — parolni qayta tiklash
- `POST /api/users/:id/block` (admin) — bloklash
- `POST /api/users/:id/activate` (admin) — qayta faollashtirish

### Bo'limlar / Lavozimlar
- `GET/POST/PATCH/DELETE /api/departments` (POST/PATCH/DELETE — admin)
- `GET/POST/PATCH/DELETE /api/positions` (POST/PATCH/DELETE — admin)

### Xabarlar
- `POST /api/messages` — yangi xabar yuborish
- `GET /api/messages?folder=inbox&search=...` — pochta qutisi
- `GET /api/messages/unread-count` — o'qilmagan xabarlar soni
- `GET /api/messages/:id` — bitta xabar
- `PATCH /api/messages/:id/read` — o'qildi deb belgilash
- `PATCH /api/messages/:id/star` — yulduzcha qo'yish/olib tashlash
- `PATCH /api/messages/:id/move/:folder` — papkaga ko'chirish (`inbox`, `sent`, `trash`, `archive`)

### Fayl biriktirmalar
- `POST /api/attachments/upload` — fayl yuklash (`multipart/form-data` `file` maydoni)
- `GET /api/attachments/:id/download` — yuklab olish

### Real-time (Socket.io)
- URL: `ws://localhost:3000/realtime`
- Auth: `auth: { token: 'JWT_TOKEN' }`
- Event: `new_message` — yangi xabar kelganda

## Xabar yuborish ketma-ketligi (frontend uchun)

1. Fayllar bo'lsa, har birini `POST /api/attachments/upload` orqali yuklang → `attachmentId` oling
2. `POST /api/messages` ga `{ recipientIds, subject, body, attachmentIds }` yuboring
3. Backend Socket.io orqali qabul qiluvchilarga `new_message` event yuboradi

## Tuzilma
```
server/
├── prisma/
│   ├── schema.prisma     — DB sxemasi
│   └── seed.ts           — boshlang'ich ma'lumotlar
├── src/
│   ├── main.ts           — kirish nuqtasi
│   ├── app.module.ts     — asosiy modul
│   ├── prisma/           — Prisma servis
│   ├── auth/             — JWT autentifikatsiya
│   ├── users/            — xodimlarni boshqarish
│   ├── departments/      — bo'limlar
│   ├── positions/        — lavozimlar
│   ├── messages/         — xabarlar + Socket.io
│   └── attachments/      — fayl yuklash/yuklab olish
└── .env                  — sozlamalar (commit qilinmaydi)
```
