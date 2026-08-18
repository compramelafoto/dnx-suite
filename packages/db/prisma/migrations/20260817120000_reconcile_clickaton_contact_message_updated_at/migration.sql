-- Reconciliación de drift: el historial de migraciones nunca creó un DEFAULT en esta
-- columna (ver 20260722030000_clickaton_contact_messages), pero la base compartida
-- tiene "updatedAt" con DEFAULT CURRENT_TIMESTAMP (aplicado fuera de Migrate).
-- schema.prisma usa `updatedAt DateTime @updatedAt` (sin DB default) — esta migración
-- alinea la base a lo que el historial siempre esperó. No aplicada todavía.
ALTER TABLE "ClickatonContactMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;
