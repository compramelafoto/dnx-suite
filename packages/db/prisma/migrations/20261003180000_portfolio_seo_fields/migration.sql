-- Título, descripción y miniatura propios de la ficha pública del portfolio.
--
-- Los tres son opcionales: en NULL la ficha se comporta exactamente como antes de esta
-- migración. No hay backfill a propósito — escribirle un título a 271 socios que no lo pidieron
-- sería peor que dejarlos con el automático, que ya funciona.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

ALTER TABLE "FotofficeMemberPortfolio"
  ADD COLUMN IF NOT EXISTS "seoTitle"       TEXT,
  ADD COLUMN IF NOT EXISTS "seoDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "seoImageChoice" TEXT;
