-- Standart ro'yxatga olish jurnallari ro'yxati (referens tizimdagidek).
-- Idempotent: nomi bo'yicha mavjud bo'lsa qayta qo'shilmaydi.
INSERT INTO "journals" ("id", "name", "prefix", "kind", "seq", "is_active", "updated_at")
SELECT v.id::uuid, v.name, NULL, v.kind, v.seq, true, CURRENT_TIMESTAMP
FROM (VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Kiruvchi korrespondensiya', 'incoming', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Chiquvchi korrespondensiya', 'outgoing', 2),
  ('a1000000-0000-4000-8000-000000000003', 'Buyruqlarni ro''yxatga olish jurnali', 'internal', 3),
  ('a1000000-0000-4000-8000-000000000004', 'Shartnomalarni ro''yxatga olish jurnali', 'internal', 4),
  ('a1000000-0000-4000-8000-000000000005', 'Shaxsiy tarkib bo''yicha buyruqlar hisobi jurnali', 'internal', 5),
  ('a1000000-0000-4000-8000-000000000006', 'Xizmat safarlari haqidagi buyruqlar hisobi jurnali', 'internal', 6),
  ('a1000000-0000-4000-8000-000000000007', 'Mehnat shartnomalari hisobi jurnali', 'internal', 7),
  ('a1000000-0000-4000-8000-000000000008', 'Fuqarolik-huquqiy shartnomalar hisobi jurnali', 'internal', 8),
  ('a1000000-0000-4000-8000-000000000009', 'Xodimlar mehnat daftarchalari hisobi jurnali', 'internal', 9),
  ('a1000000-0000-4000-8000-000000000010', 'Asosiy faoliyat bo''yicha buyruqlar hisobi jurnali', 'internal', 10)
) AS v(id, name, kind, seq)
WHERE NOT EXISTS (
  SELECT 1 FROM "journals" j WHERE j.name = v.name
);
