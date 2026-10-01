-- Las tres preguntas que el formulario de papel ya hacía y el nuestro no.
--
-- Salen del formulario que FotoPositiva usa hace años: cada una está ahí porque les hizo falta.
-- Las tres son campos de elección del catálogo de
-- `apps/fotoffice/lib/coverages/request-fields.ts`, configurables por workspace como el resto
-- (oculto / opcional / obligatorio). `venueKind` ya existía como columna: sólo entró al
-- catálogo, así que acá no aparece.
--
-- Las tres columnas aceptan nulo y ninguna tiene DEFAULT: las 65 solicitudes ya cargadas no
-- tienen estos datos y no hay con qué inventarlos. Nulo significa "no se preguntó", que es
-- exactamente lo que pasó.
--
-- Qué se guarda: el valor del catálogo, validado en el servidor contra la lista de opciones. Un
-- valor que no está en la lista se rechaza y no llega acá. Cuando la respuesta es "Otros", el
-- texto libre va detrás del valor, separado por dos puntos: `OTROS: con carpa`.
--
--   otherCoverage:  SIN_OTRA_COBERTURA | NO_LO_SE | HAY_OTRA_COBERTURA | OTROS
--   showcaseScope:  TODO | CON_RESTRICCIONES | SIN_PERSONAS | NADA | OTROS
--
-- `showcaseScope` reemplaza al tilde del consentimiento USO_INSTITUCIONAL cuando la institución
-- lo pregunta: son la misma pregunta, una con cuatro niveles y la otra con un sí o un no. El
-- registro legal no cambia — se sigue guardando la fila en `CoverageConsent` con su texto, su
-- versión y su hash — pero el permiso se deduce de la respuesta en vez de pedirse dos veces.
ALTER TABLE "CoverageRequest"
  ADD COLUMN "otherCoverage" TEXT,
  ADD COLUMN "showcaseScope" TEXT;

-- El cierre del formulario público.
--
-- Va al pie, antes del botón, y otra vez en la pantalla de "listo, lo recibimos": es el momento
-- en que quien completó ya hizo su parte y está dispuesto a leer. Acompaña a `publicFormIntro`,
-- que es lo que se lee antes de empezar. Nulo = no se muestra nada, que es lo que ven hoy todas
-- las instituciones.
ALTER TABLE "CoverageSettings"
  ADD COLUMN "publicFormOutro" TEXT;
