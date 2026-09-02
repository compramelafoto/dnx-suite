-- Orden de la sección de impresión en la página pública del fotógrafo.
--
-- Hasta ahora la sección "Imprimí tus propias fotos" siempre quedaba debajo de las galerías.
-- Algunos fotógrafos venden principalmente impresión y quieren ese bloque primero.
-- false = como estaba (debajo de las galerías), así que nadie tiene que hacer nada.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "printSectionOnTop" BOOLEAN NOT NULL DEFAULT false;
