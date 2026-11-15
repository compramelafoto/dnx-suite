-- Fecha de estreno de un curso: antes de esa fecha se muestra con su portada y "Se estrena el …",
-- pero no se puede tomar, comprar ni mirar. Null = sin estreno programado (como hasta ahora).
ALTER TABLE "Course" ADD COLUMN "releaseAt" TIMESTAMP(3);
