-- Buxgalter belgisiga tur (kind) qo'shamiz:
--   "paid"  — to'langan (o'ng oyna)
--   "other" — boshqa bo'lim hujjati, buxgalteriyaga aloqasi yo'q (chap oyna)
-- Mavjud belgilar "paid" bo'lib qoladi (standart qiymat).
ALTER TABLE "accountant_marks" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'paid';
