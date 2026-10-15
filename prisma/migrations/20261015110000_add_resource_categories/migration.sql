-- Replace the free-text resource type with a category and subcategory.
ALTER TABLE "Resource" ADD COLUMN "category" TEXT;
ALTER TABLE "Resource" ADD COLUMN "subcategory" TEXT;

UPDATE "Resource"
SET
  "category" = CASE
    WHEN "type" IN ('MEETING_ROOM', 'CONFERENCE_ROOM') THEN 'MEETING_ROOMS'
    WHEN "type" = 'PROJECTOR' THEN 'SHARED_EQUIPMENT'
    WHEN "type" = 'DESK' THEN 'SHARED_WORKSPACES'
    WHEN "type" = 'VEHICLE' THEN 'COMPANY_VEHICLES'
    ELSE 'OTHER_FACILITIES'
  END,
  "subcategory" = CASE
    WHEN "type" = 'MEETING_ROOM' THEN 'SMALL_MEETING_ROOM'
    WHEN "type" = 'CONFERENCE_ROOM' THEN 'LARGE_BOARDROOM'
    WHEN "type" = 'PROJECTOR' THEN 'PROJECTOR'
    WHEN "type" = 'DESK' THEN 'HOT_DESK'
    WHEN "type" = 'VEHICLE' THEN 'COMPANY_CAR'
    ELSE 'LOCKER'
  END;

ALTER TABLE "Resource" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Resource" ALTER COLUMN "subcategory" SET NOT NULL;
ALTER TABLE "Resource" DROP COLUMN "type";

CREATE INDEX "Resource_category_idx" ON "Resource"("category");
