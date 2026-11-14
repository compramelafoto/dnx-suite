-- El bot nunca atiende este número (lo marca una persona desde la Bandeja).
ALTER TABLE "FotofficeWaChat" ADD COLUMN IF NOT EXISTS "botExcluido" BOOLEAN NOT NULL DEFAULT false;
