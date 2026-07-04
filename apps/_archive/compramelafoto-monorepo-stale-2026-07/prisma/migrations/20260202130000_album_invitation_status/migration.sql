-- CREATE TYPE (ignorar si ya existe por baseline)
DO $$ BEGIN
  CREATE TYPE "AlbumInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AlbumInvitation" ADD COLUMN IF NOT EXISTS "status" "AlbumInvitationStatus" NOT NULL DEFAULT 'PENDING';
