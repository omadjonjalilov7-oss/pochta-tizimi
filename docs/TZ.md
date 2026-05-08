# TEXNIK TOPSHIRIQ
## Korporativ Pochta Tizimi

**Loyiha nomi:** Pochta — Ichki korporativ aloqa tizimi
**Sana:** 2026-05-08
**Versiya:** 1.0
**Bosqich:** MVP (Minimum Viable Product) — faqat ichki yozishmalar

---

## 1. UMUMIY MA'LUMOT

### 1.1. Loyihaning maqsadi
Korxonaning ichki tarmog'i (LAN) doirasida, taxminan **100 nafar xodim** uchun ishonchli, tezkor va xavfsiz pochta (yozishmalar) tizimini yaratish. Tizim xodimlar o'rtasidagi rasmiy aloqa, fayl almashinuvi, topshiriqlar yuborish va arxivlash uchun mo'ljallangan.

### 1.2. Loyihaning vazifalari
- Xodimlarning bir-biriga ichki xabar yuborishi
- Lavozimga qarab tartiblangan kontaktlar ro'yxati
- Hujjat va boshqa fayllarni biriktirib yuborish (50 MB gacha)
- Xabar yuborilgan vaqtni soat-minutgacha aniq saqlash
- Yangi xabar kelganda darhol bildirishnoma chiqarish
- Eski yozishmalarni arxivga ko'chirish (6 oydan keyin)
- Tashqi pochta (Gmail, Yandex va h.k.) uchun ruxsatni faqat tanlangan xodimlarga berish
- Admin panel orqali xodimlarni, lavozimlarni, bo'limlarni boshqarish

### 1.3. Foydalanuvchilar toifalari
| Toifa | Huquqlari |
|---|---|
| **Administrator** | Xodimlarni qo'shish/o'chirish, lavozim biriktirish, ruxsatlar berish |
| **Rahbar** (Direktor, o'rinbosar) | Hammaga yozish, hisobotlarni ko'rish, kontaktlar ro'yxatida birinchi |
| **Bo'lim boshlig'i** | O'z bo'limidagilar va boshqa rahbarlarga yozish |
| **Oddiy xodim (ichki)** | Faqat ichki yozishmalar |
| **Oddiy xodim (tashqi ruxsatli)** | Ichki + tashqi pochta yuborish |

---

## 2. FUNKSIONAL TALABLAR

### 2.1. Autentifikatsiya (Tizimga kirish)
- Login va parol orqali kirish
- Parol bazada **bcrypt** algoritmi bilan shifrlangan holda saqlanadi
- Sessiya **JWT** (JSON Web Token) orqali boshqariladi
- Sessiya muddati: 12 soat (sozlanadigan)
- "Meni eslab qol" funksiyasi (30 kungacha)
- Noto'g'ri parol 5 marta kiritilsa, akkaunt 15 daqiqaga bloklanadi

### 2.2. Xodimlarni boshqarish (Admin panel)
**Xodim ma'lumotlari:**
- F.I.O.
- Login (yagona, takrorlanmas)
- Parol (admin yangi xodim qo'shganda generatsiya qiladi yoki o'zi belgilaydi)
- Bo'lim
- Lavozim
- Telefon raqami
- Ichki email (avtomatik: `login@pochta.local`)
- Avatar (ixtiyoriy rasm)
- **Tashqi pochtaga ruxsat** (ha/yo'q)
- Faollik holati (aktiv / bloklangan)

**Admin amallari:**
- Yangi xodim qo'shish
- Mavjud xodimni tahrirlash
- Xodimni bloklash / qayta faollashtirish
- Parolni qayta tiklash
- Lavozim/bo'limni o'zgartirish
- Xodimga tashqi pochta ruxsatini berish/olish

### 2.3. Bo'limlar va lavozimlar
**Bo'limlar:** Direksiya, IT bo'limi, Buxgalteriya, Kadrlar bo'limi, Xizmat ko'rsatish, va h.k. (admin tomonidan qo'shiladi)

**Lavozimlar:** har bir lavozimda **`rank`** (raqam) bo'ladi — kontaktlar shu raqamlar bo'yicha tartiblanadi:
- 1 — Direktor
- 2 — Bosh direktor o'rinbosari
- 3 — Direktor o'rinbosari
- 10 — Bo'lim boshlig'i
- 20 — Bosh mutaxassis
- 30 — Mutaxassis
- 40 — Kotib
- 50 — Texnik xodim

(Raqamlar admin tomonidan kengaytiriladi)

### 2.4. Xabar yuborish
**Yangi xabar tuzish:**
- **Kimga:** bir yoki bir nechta qabul qiluvchi (avtomatik to'ldirish bilan)
- **Mavzu:** matn maydoni (256 belgigacha)
- **Matn:** boy matn muharriri (qalin, qiya, ostiga chizilgan, ro'yxatlar, havolalar)
- **Fayl biriktirish:** bir nechta fayl (har biri 50 MB gacha, jami 200 MB gacha)
- **Muhimlik darajasi:** Oddiy / Muhim / Juda muhim
- **O'qilganlik haqida xabar so'rash** (qabul qiluvchi xabarni ochganda jo'natuvchiga bildirishnoma)

**Xabar holati (status):**
- Yuborildi
- Yetkazib berildi
- O'qildi (vaqti bilan)
- O'chirildi

**Vaqt belgisi:** Har bir xabar `sent_at TIMESTAMPTZ` (millisekundgacha aniq) saqlaydi va `08.05.2026 14:32:15` formatida ko'rsatiladi.

### 2.5. Pochta qutisi (Inbox)
**Papkalar:**
- Kiruvchi
- Yuborilgan
- Qoralamalar (Drafts)
- Muhim (yulduzcha qo'yilgan)
- Savatcha
- Arxiv

**Har bir xabar uchun:**
- Yuboruvchi (ism + lavozim)
- Mavzu
- Vaqt
- Fayl belgisi (agar bor bo'lsa)
- O'qilgan/o'qilmaganlik holati

**Filterlar:**
- Sana bo'yicha
- Yuboruvchi bo'yicha
- Bo'lim bo'yicha
- Faqat fayl biriktirilganlar

**Qidiruv:** mavzu, matn, jo'natuvchi ismi bo'yicha

### 2.6. Real-time bildirishnomalar
- Yangi xabar kelganida darhol (1-2 soniya ichida) interfeysda ko'rinadi
- Brauzerda **push bildirishnoma** (foydalanuvchi ruxsat bersa)
- Desktop ilovada (Electron) **system tray** orqali bildirishnoma + ovoz
- O'qilmagan xabarlar soni ikona ustida ko'rsatiladi

### 2.7. Fayllar bilan ishlash
- Fayl yuklash: `multipart/form-data` orqali
- Maksimal hajm: bitta fayl 50 MB, bitta xabar uchun jami 200 MB
- Saqlash joyi: server diskidagi `attachments/yyyy/mm/` papkasi
- Fayllar ID bo'yicha xavfsiz havola orqali yuklab olinadi (boshqa odam URL'ni bilsa ham yuklab ola olmaydi)
- Ruxsat etilgan formatlar: hujjatlar, rasmlar, arxivlar, audio/video. Taqiqlangan: `.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`
- Antivirus tekshiruvi (ClamAV — keyingi bosqichda)

### 2.8. Arxivlash
- Avtomatik vazifa (cron) har kuni soat 02:00 da ishga tushadi
- 6 oydan eski xabarlar `messages` jadvalidan `messages_archive` jadvaliga ko'chiriladi
- Arxivdan qidirish "Arxivdan ham qidirish" tugmasi orqali bo'ladi
- Arxiv xabarlari faqat o'qish rejimida (tahrirlash mumkin emas)

### 2.9. Tashqi pochta (KEYINGI BOSQICH)
MVP'ga kirmaydi. Keyingi bosqichda:
- Yandex 360 yoki Google Workspace integratsiyasi
- SMTP orqali yuborish
- IMAP orqali qabul qilish
- Faqat `can_send_external = true` bo'lgan xodimlar

---

## 3. NOFUNKSIONAL TALABLAR

### 3.1. Ishlash unumdorligi
- 100 foydalanuvchining bir vaqtda ulanishi
- Xabar yuborish — 1 soniyadan kam
- Sahifa yuklash — 2 soniyadan kam
- Real-time xabar yetkazish — 2 soniyadan kam

### 3.2. Ishonchlilik
- 99.5% uptime (yiliga 44 soatdan ko'p emas to'xtab qolish)
- Bazani har kuni avtomatik backup (SQL dump)
- Backup'lar 30 kun saqlanadi
- Xabarlar yo'qolmasligi kafolatlanadi (transaktsiyalar bilan)

### 3.3. Xavfsizlik
- HTTPS majburiy (lokal tarmoqda ham, self-signed sertifikat bilan)
- Parollar **bcrypt (cost=12)** bilan shifrlangan
- SQL injection'dan himoya (Prisma ORM)
- XSS'dan himoya (React'ning standart eskalatsiyasi)
- CSRF himoyasi
- Rate limiting (login uchun 5 ta urinish, API uchun minutiga 100 so'rov)
- Audit log: kim qachon nima qildi (kirish, xabar yuborish, fayl yuklab olish)

### 3.4. Mobil va platformalar
- Web: Chrome, Firefox, Edge, Safari (oxirgi 2 versiya)
- Desktop: Windows 10/11 (Electron orqali)
- Mobil: keyingi bosqichda — PWA yoki React Native

---

## 4. TEXNOLOGIK STEK

| Qatlam | Texnologiya | Sabab |
|---|---|---|
| **Backend** | NestJS (Node.js, TypeScript) | Korxona darajasidagi tartibli arxitektura, modulli, oson saqlanadi |
| **Real-time** | Socket.io | Chat tizimlari uchun dunyo standarti |
| **Ma'lumotlar bazasi** | PostgreSQL 16 | Bepul, juda barqaror, million qatorni yengil ko'taradi |
| **ORM** | Prisma | Tipga xavfsiz, migratsiyalarni avtomatik boshqaradi |
| **Frontend** | React 18 + TypeScript + Vite | Tezkor, zamonaviy, juda katta hamjamiyat |
| **UI Kit** | TailwindCSS + shadcn/ui | Tez dizayn qilish |
| **Autentifikatsiya** | JWT + Passport.js | Standart, xavfsiz |
| **Fayl yuklash** | Multer | Node.js'da standart kutubxona |
| **Cron** | @nestjs/schedule | Arxivlash vazifalari uchun |
| **Logging** | Winston / Pino | Audit log uchun |
| **Desktop** | Electron | Windows .exe yasash uchun |

---

## 5. SERVER UCHUN TALABLAR

### 5.1. Apparat
- **Protsessor:** 4-8 yadro (Intel Xeon E-2300 yoki yuqori)
- **Tezkor xotira (RAM):** 16 GB (32 GB tavsiya etiladi)
- **Disk:**
  - Tizim uchun: 250 GB SSD
  - Ma'lumotlar bazasi uchun: 500 GB SSD
  - Fayllar va arxiv uchun: 2 TB HDD (yoki SSD)
- **Tarmoq:** 1 Gbit/s Ethernet
- **UPS:** kamida 30 daqiqaga elektr quvvati uzilganda ishlash uchun

### 5.2. Dasturiy ta'minot
- **OT:** Windows Server 2019 yoki 2022
- **Node.js** 20 LTS yoki yangiroq
- **PostgreSQL** 16
- **Nginx** (yoki IIS) — reverse proxy va statik fayllar uchun
- **PM2** — Node.js jarayonlarini xizmat sifatida boshqarish
- **NSSM** — agar PM2 o'rniga oddiy Windows xizmati kerak bo'lsa

---

## 6. MA'LUMOTLAR BAZASI TUZILMASI (asosiy jadvallar)

### `departments`
| Maydon | Tip | Izoh |
|---|---|---|
| id | UUID | Asosiy kalit |
| name | VARCHAR(255) | Bo'lim nomi |
| created_at | TIMESTAMPTZ | |

### `positions`
| Maydon | Tip | Izoh |
|---|---|---|
| id | UUID | |
| name | VARCHAR(255) | Lavozim nomi |
| rank | INTEGER | Tartiblash uchun (kichik = yuqori) |

### `users`
| Maydon | Tip | Izoh |
|---|---|---|
| id | UUID | |
| login | VARCHAR(64) | Yagona |
| password_hash | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(255) | |
| phone | VARCHAR(32) | |
| email | VARCHAR(255) | login@pochta.local |
| avatar_path | VARCHAR(512) | |
| department_id | UUID FK | |
| position_id | UUID FK | |
| can_send_external | BOOLEAN | Tashqi pochta ruxsati |
| is_active | BOOLEAN | Faollik |
| is_admin | BOOLEAN | Admin huquqi |
| created_at | TIMESTAMPTZ | |
| last_login_at | TIMESTAMPTZ | |

### `messages`
| Maydon | Tip | Izoh |
|---|---|---|
| id | UUID | |
| from_user_id | UUID FK | |
| subject | VARCHAR(512) | |
| body | TEXT | HTML |
| importance | ENUM | normal/important/urgent |
| is_external | BOOLEAN | Tashqi pochtami? |
| sent_at | TIMESTAMPTZ(3) | Millisekundgacha |

### `message_recipients` (ko'pdan-ko'p munosabat)
| Maydon | Tip | Izoh |
|---|---|---|
| message_id | UUID FK | |
| user_id | UUID FK | |
| folder | ENUM | inbox/sent/trash/archive |
| is_read | BOOLEAN | |
| read_at | TIMESTAMPTZ | |
| is_starred | BOOLEAN | |

### `attachments`
| Maydon | Tip | Izoh |
|---|---|---|
| id | UUID | |
| message_id | UUID FK | |
| filename | VARCHAR(512) | Asl nom |
| stored_path | VARCHAR(1024) | Diskdagi yo'l |
| size_bytes | BIGINT | |
| mime_type | VARCHAR(128) | |

### `audit_log`
| Maydon | Tip | Izoh |
|---|---|---|
| id | UUID | |
| user_id | UUID FK | |
| action | VARCHAR(64) | login/send/download/admin |
| ip_address | VARCHAR(64) | |
| details | JSONB | |
| created_at | TIMESTAMPTZ | |

### `messages_archive` (`messages` jadvalining nusxasi, 6 oydan eski)

---

## 7. BOSQICHMA-BOSQICH REJA

| Bosqich | Mazmun | Vaqt |
|---|---|---|
| 1 | Server sozlash, ma'lumotlar bazasi sxemasi, autentifikatsiya, admin panel asosi | 1-2 hafta |
| 2 | Ichki xabar yuborish, real-time, fayl biriktirish, vaqt belgilari | 1-2 hafta |
| 3 | Web frontend dizayn va UX | 1 hafta |
| 4 | Electron desktop ilova, system tray, bildirishnomalar | 1 hafta |
| 5 | Mobil ilova (PWA yoki React Native) | 1-2 hafta |
| 6 | Tashqi pochta integratsiyasi, arxiv tizimi takomil, qidiruv | 1 hafta |
| **JAMI** | | **6-9 hafta** |

---

## 8. SINOV (TEST) TALABLARI

- Backend: birlik testlari (Jest), integratsiya testlari (Supertest)
- Frontend: komponent testlari (Vitest + React Testing Library)
- Yuklama testi: 100 ta bir vaqtdagi foydalanuvchini taqlid qilish (k6)
- Xavfsizlik audit: OWASP Top 10 bo'yicha tekshiruv

---

## 9. YETKAZIB BERILADIGAN MAHSULOT

1. Backend kodi (`/server`)
2. Frontend kodi (`/web`)
3. Desktop ilova (`/desktop`) — keyingi bosqichda
4. Ma'lumotlar bazasi sxemasi va migratsiyalari (`/server/prisma`)
5. Hujjatlar:
   - Texnik topshiriq (ushbu hujjat)
   - O'rnatish qo'llanmasi (Windows Server uchun)
   - Administrator qo'llanmasi
   - Foydalanuvchi qo'llanmasi
6. Backup va tiklash skriptlari

---

**Hujjat oxiri.**
