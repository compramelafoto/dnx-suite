-- La franja de Instagram en la ficha pública del portfolio.
--
-- No es el feed: leer el feed de una cuenta exige OAuth y una app aprobada por Meta desde que
-- cerró la Basic Display API (diciembre de 2024). Son posteos que el socio elige y pega.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

-- Apagado por omisión a propósito: la franja trae un script de Meta al sitio de la institución,
-- y eso se decide, no se hereda.
ALTER TABLE "FotofficeMemberPortfolio"
  ADD COLUMN IF NOT EXISTS "instagramEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "FotofficeMemberPortfolio"
  ADD COLUMN IF NOT EXISTS "instagramPostUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
