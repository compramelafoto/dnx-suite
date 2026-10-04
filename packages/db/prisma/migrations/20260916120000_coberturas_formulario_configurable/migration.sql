-- Qué le pregunta cada institución a quien pide una cobertura.
--
-- El formulario público tenía 23 campos siempre visibles para todas las organizaciones. Estas
-- dos listas dejan que cada workspace decida, campo por campo, si lo esconde, lo pregunta o lo
-- exige. Las claves son las del catálogo de `apps/fotoffice/lib/coverages/request-fields.ts`.
--
-- Los cinco campos fijos (orgName, contactEmail, eventTitle, startsAt, endsAt) ignoran las dos
-- listas: sin ellos no hay solicitud que guardar ni cobertura que generar.
--
-- `contactName` entra en la lista de obligatorios por omisión —y por eso el DEFAULT no es un
-- arreglo vacío— porque hoy ya lo es: el parseo del formulario corta el envío sin él desde el
-- primer día. Con el DEFAULT, las filas que ya existen quedan igual que hoy y no hace falta
-- rellenar nada a mano.
ALTER TABLE "CoverageSettings"
  ADD COLUMN "requestFormHidden" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "requestFormRequired" TEXT[] DEFAULT ARRAY['contactName']::TEXT[];
