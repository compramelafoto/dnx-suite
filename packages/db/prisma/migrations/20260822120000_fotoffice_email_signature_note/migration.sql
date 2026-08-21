-- Nota institucional para el pie de los emails del workspace.
-- Puramente ADITIVA: una columna nullable. No altera ni borra nada existente, así que el
-- código anterior sigue funcionando con esta migración ya aplicada.

-- AlterTable
ALTER TABLE "FotofficeWorkspaceBranding" ADD COLUMN     "emailSignatureNote" TEXT;
