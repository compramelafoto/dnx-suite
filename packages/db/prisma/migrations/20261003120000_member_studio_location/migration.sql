-- Domicilio del estudio del socio, con coordenadas, para su ficha pública y sus datos
-- estructurados.
--
-- NO reemplaza a `address`/`city`/`province`/`postalCode`: ésos son los datos personales del
-- socio y no se publican nunca. Éste es el local donde atiende.
--
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "studioStreet"     TEXT,
  ADD COLUMN IF NOT EXISTS "studioCity"       TEXT,
  ADD COLUMN IF NOT EXISTS "studioProvince"   TEXT,
  ADD COLUMN IF NOT EXISTS "studioPostalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "studioLat"        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "studioLng"        DOUBLE PRECISION;
