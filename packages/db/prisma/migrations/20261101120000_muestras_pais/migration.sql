-- Muestras: país de la sede. Hasta ahora todo era Argentina; las cargadas de otros países
-- se corrigen aparte (tenían el país en "province").
ALTER TABLE "CulturalActivity" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'Argentina';
