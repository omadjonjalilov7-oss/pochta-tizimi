-- "awaiting_leader" — barcha tasdiqlovchilar tasdiqlagan, endi bosh direktorga
-- (avazbek) yuborilishi kutilayotgan holat. Hujjat faqat avazbek tasdiqlagach
-- "done" (bajarildi) bo'ladi.
ALTER TYPE "DocumentStatus" ADD VALUE IF NOT EXISTS 'awaiting_leader';
