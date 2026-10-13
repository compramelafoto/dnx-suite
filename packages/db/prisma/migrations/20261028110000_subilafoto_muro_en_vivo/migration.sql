-- El muro en vivo: lo que está llegando ahora, en el teléfono del invitado.
--
-- No es el álbum. El álbum es todo lo del evento, para siempre y con la foto entera: por
-- eso `guestsCanSeeAlbum` nace apagado. El muro es lo que llega mientras la fiesta pasa,
-- en chico, y se apaga solo cuando el evento cierra.
--
-- Nace ENCENDIDO, al revés que el álbum: sin pantalla en el salón, el invitado escanea,
-- sube una foto y no recibe nada. La fiesta del 10/10/2026 no se hizo por eso.
ALTER TABLE "SubilafotoEvent"
  ADD COLUMN IF NOT EXISTS "guestsCanSeeLive" BOOLEAN NOT NULL DEFAULT true;
