-- Photos shown on the member dashboard for each resource.
ALTER TABLE "Resource" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
