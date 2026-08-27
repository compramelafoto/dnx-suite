-- Protección visual "ventana de escaneo" configurable por álbum.
-- Activada por defecto: los álbumes existentes quedan protegidos.
ALTER TABLE "Album" ADD COLUMN IF NOT EXISTS "scanProtectionEnabled" BOOLEAN NOT NULL DEFAULT true;
