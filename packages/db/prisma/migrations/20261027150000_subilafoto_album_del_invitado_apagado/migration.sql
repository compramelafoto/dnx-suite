-- El álbum del invitado nace apagado.
--
-- Las fotos se miran en la pantalla del salón. Un álbum abierto a cualquiera con el QR
-- es gente de la fiesta descargando el trabajo del fotógrafo antes de que lo venda, y
-- además expone a todos los invitados a que cualquiera se lleve sus fotos.
--
-- Sólo cambia el valor por defecto para los eventos NUEVOS. Los que ya existen se dejan
-- como están: cambiarle la configuración a un evento en curso sin que el fotógrafo lo
-- pida sería peor que el problema.

ALTER TABLE "SubilafotoEvent" ALTER COLUMN "guestsCanSeeAlbum" SET DEFAULT false;
