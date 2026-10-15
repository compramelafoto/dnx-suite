-- Una excepción al reparto de jurados también puede QUITAR una consigna.
--
-- Hasta ahora sólo sumaba: servía para repartir una vacante que nunca se llenó.
-- Con un jurado sentado que no avanza hace falta pasarle parte de su lote a otro
-- y sacárselo a él, para que no califique fotos que ya califica otra persona.
-- Las filas existentes quedan en falso: siguen sumando, como hasta ahora.
ALTER TABLE "FotorankJurySeatPromptOverride"
  ADD COLUMN IF NOT EXISTS "quita" BOOLEAN NOT NULL DEFAULT false;
