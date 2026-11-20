-- CLF escolar: cursos cuyas fotos el fotógrafo ya dio por subidas; el aviso a las familias sale por curso.
CREATE TABLE IF NOT EXISTS "AlbumCursoPublicado" (
    "id" SERIAL NOT NULL,
    "albumId" INTEGER NOT NULL,
    "schoolCourseId" INTEGER NOT NULL,
    "marcadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avisoAt" TIMESTAMP(3),
    "marcadoPorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlbumCursoPublicado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AlbumCursoPublicado_albumId_schoolCourseId_key" ON "AlbumCursoPublicado"("albumId", "schoolCourseId");
CREATE INDEX IF NOT EXISTS "AlbumCursoPublicado_avisoAt_idx" ON "AlbumCursoPublicado"("avisoAt");
DO $$ BEGIN
  ALTER TABLE "AlbumCursoPublicado" ADD CONSTRAINT "AlbumCursoPublicado_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AlbumCursoPublicado" ADD CONSTRAINT "AlbumCursoPublicado_schoolCourseId_fkey" FOREIGN KEY ("schoolCourseId") REFERENCES "SchoolCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
