-- Quién vendió cada participación.
--
-- Null significa que la vendió DNX directo. Cuando un workspace o un organizador
-- lleva una marca a la red, acá queda registrado quién fue: es lo que permite
-- facturarle el fee y saber de quién es esa marca antes de que otro se la ofrezca.
--
-- Aditiva: columna nullable, sin default, sin backfill. Las filas existentes
-- quedan en NULL, que es exactamente lo correcto — las vendió DNX.

ALTER TABLE "DnxPartnerParticipation"
  ADD COLUMN "soldByOrganizationId" TEXT;

CREATE INDEX "DnxPartnerParticipation_soldByOrganizationId_status_idx"
  ON "DnxPartnerParticipation" ("soldByOrganizationId", "status");
