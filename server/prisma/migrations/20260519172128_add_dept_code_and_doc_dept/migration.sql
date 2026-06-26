-- Department.code (nullable + unique)
ALTER TABLE "departments" ADD COLUMN "code" VARCHAR(16);
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- Document.numberDeptId, targetDeptId
ALTER TABLE "documents" ADD COLUMN "number_dept_id" UUID;
ALTER TABLE "documents" ADD COLUMN "target_dept_id" UUID;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_number_dept_id_fkey"
  FOREIGN KEY ("number_dept_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_target_dept_id_fkey"
  FOREIGN KEY ("target_dept_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DocumentCounter: drop old unique, replace year/category with dept_code
ALTER TABLE "document_counters" DROP CONSTRAINT IF EXISTS "document_counters_year_category_key";
DROP INDEX IF EXISTS "document_counters_year_category_key";
-- Eski hisoblagichlarni tozalaymiz (yangi formatga bog'liq)
DELETE FROM "document_counters";
ALTER TABLE "document_counters" DROP COLUMN IF EXISTS "year";
ALTER TABLE "document_counters" DROP COLUMN IF EXISTS "category";
ALTER TABLE "document_counters" ADD COLUMN "dept_code" VARCHAR(16) NOT NULL;
CREATE UNIQUE INDEX "document_counters_dept_code_key" ON "document_counters"("dept_code");

-- Mavjud bo'limlarga vaqtinchalik kod beriladi (admin keyin tahrirlasin)
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM "departments"
)
UPDATE "departments" d
SET code = LPAD(n.rn::text, 3, '0')
FROM numbered n
WHERE d.id = n.id;
