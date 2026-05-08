# Pochta tizimini Windows Server'ga o'rnatish (Deploy)

Bu qo'llanma tizimni rivojlanish (development) rejimidan haqiqiy ishlab turuvchi (production) rejimiga o'tkazib, ofisdagi 100 ta xodim foydalanishi mumkin bo'lgan holga keltiradi.

---

## Tayyorgarlik tekshiruvi

Quyidagilar **server kompyuterida** o'rnatilgan bo'lishi shart:

- ✅ Windows Server (yoki Windows 10/11 Pro)
- ✅ Node.js v20+ (`node --version` bilan tekshiring)
- ✅ PostgreSQL 18 (ishga tushgan, `pochta` bazasi yaratilgan)
- ✅ `C:\D\pochta\` papkasidagi loyiha

Yo'q bo'lsa — avval `01_PostgreSQL_o'rnatish.md` bo'yicha PostgreSQL'ni qoying.

---

## 1-bosqich: Frontend'ni "build" qilish

Frontend dev rejimida `npm run dev` orqali ishlaydi, lekin production'da statik fayllarga aylantirilishi kerak.

PowerShell oching va quyidagini bajaring:

```powershell
cd C:\D\pochta\web
npm run build
```

Buyruq tugagach `C:\D\pochta\web\dist\` papkasi paydo bo'ladi — ichida `index.html` va statik fayllar bo'ladi.

**Tekshirish:** `dist` papkasida `index.html` borligini ko'ring.

---

## 2-bosqich: Backend'ni "build" qilish

```powershell
cd C:\D\pochta\server
npm run build
```

Bu `dist\` papkasi ichida JavaScript fayllarini yaratadi (TypeScript'dan kompilyatsiya).

**Tekshirish:** `C:\D\pochta\server\dist\main.js` fayli borligini ko'ring.

---

## 3-bosqich: Production .env faylini sozlash

`C:\D\pochta\server\.env` faylini oching va quyidagi qatorlarni **qo'shing/o'zgartiring**:

```env
# Database
DATABASE_URL="postgresql://pochta_user:Pochta_DB_2026@localhost:5432/pochta?schema=public"

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Frontend statik fayllarini server o'zi xizmat qilsin
SERVE_STATIC=true
STATIC_DIR=C:\D\pochta\web\dist

# JWT — bu qatorni ALBATTA o'zgartiring (kamida 64 ta tasodifiy belgi)
JWT_SECRET="ALMASHTIRING_BU_QATORNI_uzun_va_tasodifiy_belgilar_bilan_xxxxxxxxx"
JWT_EXPIRES_IN="12h"
JWT_REMEMBER_EXPIRES_IN="30d"

# Fayllar
ATTACHMENTS_DIR="C:\D\pochta\storage\attachments"
MAX_FILE_SIZE_MB=50

# CORS — ofis kompyuterlarining IP yoki domenini qo'shing
FRONTEND_URL=http://192.168.1.10,http://pochta.korxona.local

# Bcrypt
BCRYPT_ROUNDS=12
```

**Diqqat:** `JWT_SECRET` qatorini albatta noyob, uzun, tasodifiy belgilarga almashtiring — aks holda tizim xavfsizligi buziladi. Yangi qator yaratish uchun PowerShell'da:

```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Max 256 }))
```

`192.168.1.10` o'rniga **server kompyuterining haqiqiy IP manzili**ni qo'ying. IP'ni bilish uchun:

```powershell
ipconfig | findstr IPv4
```

---

## 4-bosqich: Server kompyuterining IP manzili

Xodimlar pochtaga ulanish uchun server kompyuterining IP manzili kerak. U barqaror (statik) bo'lishi kerak — DHCP'da o'zgarib ketmasin.

1. **Boshqaruv paneli** → **Tarmoq va Internet** → **Tarmoq ulanishlari**
2. Faol tarmoq adapterini o'ng tugma → **Xususiyatlar** (Properties)
3. **Internet Protocol Version 4 (TCP/IPv4)** → **Xususiyatlar**
4. **Quyidagi IP manzilidan foydalan** ni tanlang:
   - IP: masalan `192.168.1.10`
   - Subnet: `255.255.255.0`
   - Gateway: routeringiz manzili (masalan `192.168.1.1`)
5. **OK** bosing.

Yoki tarmoq administratoringizdan server uchun statik IP so'rang.

---

## 5-bosqich: Windows Firewall'da port'ni ochish

Ofis ichidagi boshqa kompyuterlar 3000-portga ulanishi kerak.

PowerShell'ni **Administrator sifatida** oching va bajaring:

```powershell
New-NetFirewallRule -DisplayName "Pochta HTTP" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

---

## 6-bosqich: Sinov uchun qo'lda ishga tushirish

Ko'chgan o'zgarishlarni sinash uchun qo'lda ishga tushiring:

```powershell
cd C:\D\pochta\server
node dist\main.js
```

Boshqa kompyuterdan brauzerda oching:
```
http://192.168.1.10:3000
```

(IP'ni o'zingizga moslang.)

Login: `admin`, parol: `Admin@2026`

Hammasi ishlasa, terminalda **Ctrl+C** bosib to'xtating va keyingi bosqichga o'ting.

---

## 7-bosqich: Windows Service sifatida o'rnatish (NSSM bilan)

Server kompyuter qayta yuklanganda pochta ham avtomatik ishga tushishi uchun uni Windows xizmati (Service) qilamiz. Buning uchun **NSSM** (Non-Sucking Service Manager) — bepul, ishonchli vosita.

### NSSM yuklab olish

1. https://nssm.cc/download — eng oxirgi `nssm-2.24.zip` ni yuklab oling
2. Arxivni `C:\nssm\` papkasiga ochib qoying
3. Sizga kerak bo'ladigan fayl: `C:\nssm\win64\nssm.exe`

### Pochta xizmatini o'rnatish

PowerShell'ni **Administrator sifatida** oching:

```powershell
C:\nssm\win64\nssm.exe install Pochta
```

Bu oyna ochiladi. Quyidagilarni to'ldiring:

**Application** tab:
- **Path:** `C:\Program Files\nodejs\node.exe`
- **Startup directory:** `C:\D\pochta\server`
- **Arguments:** `dist\main.js`

**Details** tab:
- **Display name:** `Pochta server`
- **Description:** `Korporativ pochta tizimi`
- **Startup type:** `Automatic`

**I/O** tab (jurnal yozish uchun):
- **Output (stdout):** `C:\D\pochta\logs\stdout.log`
- **Error (stderr):** `C:\D\pochta\logs\stderr.log`

**Install service** tugmasini bosing.

`C:\D\pochta\logs\` papkasini qo'lda yarating:

```powershell
mkdir C:\D\pochta\logs
```

### Xizmatni ishga tushirish

```powershell
nssm start Pochta
```

Tekshirish:
```powershell
nssm status Pochta
```

`SERVICE_RUNNING` chiqsa — ishladi.

Brauzerda oching: `http://192.168.1.10:3000`

### Foydali NSSM buyruqlari

```powershell
nssm stop Pochta          # to'xtatish
nssm restart Pochta       # qayta ishga tushirish
nssm remove Pochta        # xizmatni o'chirish (loyiha emas)
```

---

## 8-bosqich: Domain nomini sozlash (ixtiyoriy)

Xodimlar IP manzil emas, qulay nom kiritishi uchun (masalan `pochta.korxona.local`):

### A) Local DNS (Active Directory bo'lsa)
Tarmoq administratoringiz DNS'ga A-record qo'shadi: `pochta.korxona.local → 192.168.1.10`

### B) Hosts fayli (kichik tarmoq uchun)
Har bir xodim kompyuteridagi `C:\Windows\System32\drivers\etc\hosts` ga qator qo'shing:
```
192.168.1.10  pochta.korxona.local
```

### C) Eng oddiy variant
Hech narsa qo'shmang — IP'ni ishlatishaversa: `http://192.168.1.10:3000`

---

## 9-bosqich: HTTPS (xohlasangiz)

Brauzer Notification API HTTP'da ham ishlaydi (localhost va LAN'da), shuning uchun MVP uchun HTTPS shart emas. Ammo xavfsizlik uchun keyinchalik:

- **Self-signed sertifikat** (ofis ichida) — Caddy yoki nginx-Windows orqali
- **Let's Encrypt** — agar tashqi domen bor bo'lsa

Bu bosqichni keyinroq alohida ko'rib chiqamiz.

---

## 10-bosqich: PostgreSQL bazasini muntazam zaxiralash (backup)

Ma'lumotlarni yo'qotmaslik uchun har kuni avtomatik zaxira:

`C:\D\pochta\backup_pochta.bat` faylini yarating:

```bat
@echo off
set BACKUP_DIR=C:\D\pochta\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set DATESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%
set PGPASSWORD=Postgres@2026
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h localhost -F c -f "%BACKUP_DIR%\pochta_%DATESTAMP%.backup" pochta

REM 30 kundan eski backup'larni o'chirish
forfiles /p "%BACKUP_DIR%" /m *.backup /d -30 /c "cmd /c del @path" 2>nul
```

**Task Scheduler**'da har kuni 02:00 da ishga tushadigan vazifa yarating:

1. Task Scheduler → **Create Basic Task**
2. Name: `Pochta backup`
3. Trigger: **Daily**, 02:00
4. Action: **Start a program** → `C:\D\pochta\backup_pochta.bat`
5. **Run with highest privileges** belgilang

Backup'lar `C:\D\pochta\backups\` ga tushadi.

### Tiklash (zarur paytda)

```powershell
"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h localhost -d pochta -c "C:\D\pochta\backups\pochta_2026-05-08.backup"
```

---

## 11-bosqich: Faylar (`storage`) papkasini ham backup qilish

Foydalanuvchi yuklagan biriktirma fayllar `C:\D\pochta\storage\attachments\` da. Buni alohida zaxiralang.

Oddiy variant — `robocopy` bilan boshqa diskka:

```bat
robocopy C:\D\pochta\storage D:\pochta_backup\storage /MIR /R:3 /W:5 /LOG:C:\D\pochta\logs\backup_files.log
```

Buni ham Task Scheduler bilan kuniga ishga tushiring.

---

## 12-bosqich: Dastlabki sozlash (admin)

Brauzerdan kirib, admin sifatida (login: `admin`, parol: `Admin@2026`):

1. **Profil** → parolni O'ZGARTIRING (xavfsizlik!)
2. **Lavozimlar** sahifasi — seed orqali 10 ta lavozim allaqachon yaratilgan, kerakli darajada o'zgartiring
3. **Bo'limlar** — 7 ta bo'lim seed qilingan, korxonangiz tarkibiga moslang
4. **Foydalanuvchilar** — har bir xodim uchun:
   - F.I.SH
   - Login (masalan ismi.familiyasi)
   - Parol (boshlang'ich, xodim keyin o'zgartirsin)
   - Bo'lim, lavozim
   - **Tashqi pochta huquqi** — kimga kerak bo'lsa belgilang
   - **Administrator huquqi** — faqat ishonchli odamlarga

---

## Yangilanish (update) qilish

Loyihada o'zgarish bo'lsa:

```powershell
nssm stop Pochta

# Yangi kodni nusxalash (masalan git pull yoki qo'lda)
cd C:\D\pochta\server
npm install --production
npm run build

cd C:\D\pochta\web
npm install
npm run build

# Agar baza sxemasi o'zgargan bo'lsa
cd C:\D\pochta\server
npx prisma migrate deploy

nssm start Pochta
```

---

## Muammolarni hal qilish (troubleshooting)

### Xizmat ishga tushmayapti
```powershell
type C:\D\pochta\logs\stderr.log
```
Oxirgi 50 qator xatolarni tekshiring.

### Boshqa kompyuterdan ochilmayapti
1. Server'da `http://localhost:3000` ochiladimi? — ochilsa serverda muammo yo'q
2. `ping 192.168.1.10` qilib ko'ring boshqa kompyuterdan
3. Firewall qoidasini qayta ko'rib chiqing (5-bosqich)
4. `Test-NetConnection 192.168.1.10 -Port 3000` (boshqa kompyuterdan PowerShell'da)

### "Database connection error"
PostgreSQL xizmati ishlamayapti yoki parol noto'g'ri:
```powershell
Get-Service postgresql-x64-18
Start-Service postgresql-x64-18
```

### Real-time xabar kelmayapti
1. Brauzer DevTools (F12) → **Network** → **WS** tabini ochib, `/socket.io/` ulanishi 101 kodi (Switching Protocols) bilan ulanyaptimi tekshiring
2. Firewall WebSocket'larni bloklamayotganini tekshiring

---

## Xavfsizlik bo'yicha tavsiyalar

1. **JWT_SECRET** ni hech kimga ko'rsatmang
2. **Admin parolini** birinchi kirgandan so'ng albatta o'zgartiring
3. **PostgreSQL portini** (5432) tashqi tarmoqqa **chiqarmaslik** kerak — faqat `localhost`da
4. Server kompyuterga **fizik kirishni** cheklang
5. **Backup'larni** boshqa diskka yoki tarmoq diskiga ham nusxalang
6. **Xodimlar parolini** murakkab qiling: kamida 8 belgi, harf+raqam

---

Tayyor! Tizim 100 xodim uchun ishga tushirildi. Savollar bo'lsa, `docs/TZ.md` ni o'qing yoki menga murojaat qiling.
