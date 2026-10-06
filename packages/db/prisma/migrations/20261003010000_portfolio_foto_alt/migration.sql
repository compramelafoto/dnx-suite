-- Descripción de cada foto del portfolio, para el atributo `alt` de la imagen.
--
-- Es lo que lee Google para encontrar la foto y lo que escucha quien usa un lector de pantalla.
-- Un solo texto para las dos cosas.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

ALTER TABLE "FotofficeMemberPortfolioPhoto"
  ADD COLUMN IF NOT EXISTS "altText" TEXT;
