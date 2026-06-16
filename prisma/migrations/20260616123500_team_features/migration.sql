BEGIN;

ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";

CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER');

ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "Membership"
ALTER COLUMN "role" TYPE "MembershipRole"
USING (
  CASE
    WHEN "role"::text = 'MEMBER' THEN 'DEVELOPER'
    ELSE "role"::text
  END
)::"MembershipRole";

ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'DEVELOPER';

DROP TYPE "MembershipRole_old";

CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

ALTER TABLE "Issue"
ADD COLUMN "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX "Invitation_organizationId_status_idx" ON "Invitation"("organizationId", "status");
CREATE INDEX "Invitation_email_status_idx" ON "Invitation"("email", "status");

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
