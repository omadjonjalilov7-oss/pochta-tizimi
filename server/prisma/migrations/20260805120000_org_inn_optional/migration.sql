-- Tashkilot INN/STIR raqamini ixtiyoriy qilamiz (majburiy emas).
-- Noyoblik indeksi saqlanadi; PostgreSQL'da bir nechta NULL qiymat noyoblikni buzmaydi.
ALTER TABLE "organizations" ALTER COLUMN "inn" DROP NOT NULL;
