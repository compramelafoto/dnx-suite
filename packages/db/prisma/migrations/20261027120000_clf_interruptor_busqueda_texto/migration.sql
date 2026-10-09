-- Interruptor por álbum para la búsqueda por dorsal, patente o nombre.
--
-- Leer el texto de las fotos lo cobra Amazon por foto, y hasta el 2026-10-09 corría en
-- todas: era la mitad de la factura. Ahora lo decide el fotógrafo.
--
-- Nullable a propósito: `null` significa "decidí vos", y cae a la regla por tipo de
-- álbum (sólo SPORTS). Así los 121 álbumes deportivos que ya funcionan siguen andando
-- sin tocar una sola fila.
--
-- Aditiva e idempotente: la columna nace vacía y el código vieja la ignora.

ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "textSearchEnabled" BOOLEAN;
