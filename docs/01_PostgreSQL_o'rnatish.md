# PostgreSQL 16 ni Windows'ga o'rnatish

Bu qo'llanma sizga shaxsiy kompyuteringizda (yoki serverda) PostgreSQL ni o'rnatishni ko'rsatadi. **Taxminan 10-15 daqiqa** vaqt oladi.

---

## 1-qadam: Yuklab olish

1. Brauzerda oching: **https://www.postgresql.org/download/windows/**
2. **"Download the installer"** tugmasini bosing (EDB tomonidan)
3. **PostgreSQL 16.x — Windows x86-64** versiyasini yuklab oling (taxminan 350 MB)

## 2-qadam: O'rnatish

1. Yuklangan `postgresql-16.x-windows-x64.exe` faylni **Administrator sifatida ishga tushiring** (o'ng tugma → Run as administrator)
2. **Next** bosing
3. **O'rnatish papkasi:** `C:\Program Files\PostgreSQL\16` (o'zgartirmang)
4. **Komponentlar:** hammasi belgilangan bo'lsin:
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (vizual interfeys — kerak bo'ladi)
   - ✅ Stack Builder (kerak emas, lekin qoldiring)
   - ✅ Command Line Tools
5. **Ma'lumotlar papkasi:** `C:\Program Files\PostgreSQL\16\data` (o'zgartirmang)
6. **PAROL:** `postgres` foydalanuvchisi uchun parol kiriting
   - **MUHIM:** Bu parolni eslab qoling! Misol: `Pochta2026!`
   - Bu parolni keyin loyiha sozlamalarida ishlatamiz
7. **Port:** `5432` (standart, o'zgartirmang)
8. **Locale:** `Default locale` qoldiring
9. **Next** → **Next** → **Finish**

## 3-qadam: O'rnatishni tekshirish

PowerShell ni oching va quyidagini bajaring:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost
```

Parol so'raydi — yuqorida belgilagan parolni kiriting.

Agar quyidagini ko'rsangiz — hammasi yaxshi:
```
psql (16.x)
Type "help" for help.

postgres=#
```

`\q` yozib, Enter bosing — chiqib ketasiz.

## 4-qadam: PATH ga qo'shish (ixtiyoriy, lekin tavsiya etiladi)

Bu qadam `psql` buyrug'ini istalgan joydan ishlatishga imkon beradi.

1. **Win + R** bosing → `sysdm.cpl` yozing → Enter
2. **Advanced** tab → **Environment Variables**
3. **System variables** ichidan **Path** ni tanlang → **Edit**
4. **New** bosing va qo'shing: `C:\Program Files\PostgreSQL\16\bin`
5. **OK** → **OK** → **OK**
6. Ochilgan barcha terminal/PowerShell oynalarini yoping va qaytadan oching

Tekshirish:
```powershell
psql --version
```
Ko'rinishi kerak: `psql (PostgreSQL) 16.x`

## 5-qadam: Loyiha bazasini yaratish

PowerShell'da:

```powershell
psql -U postgres -h localhost
```

Parolni kiriting. Keyin quyidagi buyruqlarni bittadan kiriting:

```sql
CREATE DATABASE pochta;
CREATE USER pochta_user WITH PASSWORD 'Pochta_DB_2026';
GRANT ALL PRIVILEGES ON DATABASE pochta TO pochta_user;
\c pochta
GRANT ALL ON SCHEMA public TO pochta_user;
\q
```

**Eslab qoling:**
- Baza nomi: `pochta`
- Foydalanuvchi: `pochta_user`
- Parol: `Pochta_DB_2026` (boshqa parol qo'ymoqchi bo'lsangiz, men loyihada ham o'zgartiraman)

---

## Tugadi!

PostgreSQL endi tayyor. Tizim Windows xizmati sifatida avtomatik ishga tushadi.

**Yana nima kerak:**
- **pgAdmin 4** — bazani ko'rish va boshqarish uchun grafik interfeys (avtomatik o'rnatildi). Start menyusidan toping.

---

## Muammolar bo'lsa

**Muammo:** "Port 5432 already in use"
**Yechim:** Boshqa PostgreSQL yoki dastur shu portni egallagan. Task Manager'da `postgres.exe` ni topib o'chiring yoki o'rnatishda boshqa port (5433) tanlang.

**Muammo:** "Authentication failed"
**Yechim:** Parolni xato kiritgansiz. O'rnatishda belgilagan parolni eslang.

**Muammo:** `psql` buyrug'i topilmaydi
**Yechim:** 4-qadamni bajaring (PATH ga qo'shish) va terminalni qaytadan oching.
