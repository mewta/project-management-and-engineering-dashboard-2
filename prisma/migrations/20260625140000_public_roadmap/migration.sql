ALTER TABLE "Project"
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicSlug" TEXT;

CREATE UNIQUE INDEX "Project_publicSlug_key" ON "Project"("publicSlug");
