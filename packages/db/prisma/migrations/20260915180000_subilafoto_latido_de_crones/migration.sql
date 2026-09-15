-- Latido de cada tarea automática.
--
-- Una fila por cron, actualizada en el lugar: son cinco filas para siempre, no un registro
-- que crece. Sirve para responder la pregunta que ninguna otra tabla contesta: "¿el cron
-- está corriendo?". Es la falla más silenciosa que puede tener esto — no hay error ni
-- pantalla rota, las fotos simplemente no se moderan.
CREATE TABLE "SubilafotoCronRun" (
    "nombre" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastMs" INTEGER,
    "lastResult" JSONB,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubilafotoCronRun_pkey" PRIMARY KEY ("nombre")
);
