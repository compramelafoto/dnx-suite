-- Finanzas DNX: candado de la lectura de Gmail (una sola fila). Idempotente.
CREATE TABLE IF NOT EXISTS "ExpenseMailRunLock" (
    "id" INTEGER NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    CONSTRAINT "ExpenseMailRunLock_pkey" PRIMARY KEY ("id")
);
INSERT INTO "ExpenseMailRunLock" ("id", "lockedUntil") VALUES (1, NULL) ON CONFLICT ("id") DO NOTHING;
