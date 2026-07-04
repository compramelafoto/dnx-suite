-- AlterTable: permitir plantillas del sistema sin álbum (admin crea plantillas públicas)
ALTER TABLE "Template" ALTER COLUMN "albumId" DROP NOT NULL;
