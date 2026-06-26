-- CreateTable
CREATE TABLE "contact_groups" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_group_members" (
    "group_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,

    CONSTRAINT "contact_group_members_pkey" PRIMARY KEY ("group_id","member_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_groups_owner_id_name_key" ON "contact_groups"("owner_id", "name");

-- AddForeignKey
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "contact_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
