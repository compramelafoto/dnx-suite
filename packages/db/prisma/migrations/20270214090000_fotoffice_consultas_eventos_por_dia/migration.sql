-- Semáforo de fechas de las consultas: cuántos eventos puede cubrir el estudio el mismo día.
ALTER TABLE "FotofficeConsultaAjustes" ADD COLUMN "eventsPerDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FotofficeConsultaAjustes" ADD CONSTRAINT "FotofficeConsultaAjustes_eventsPerDay_check" CHECK ("eventsPerDay" BETWEEN 1 AND 20);
