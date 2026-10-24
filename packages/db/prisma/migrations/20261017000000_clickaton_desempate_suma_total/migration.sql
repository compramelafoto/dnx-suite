-- Desempate de Clickatón desde la 2ª edición: promedio del jurado y, si empata,
-- la suma de todas las fotos del participante. Se aplica a mano en las bases
-- que tienen las tablas Fotorank* antes de publicar el código.
ALTER TYPE "FotorankResultTieBreakStrategy" ADD VALUE IF NOT EXISTS 'PARTICIPANT_TOTAL';
