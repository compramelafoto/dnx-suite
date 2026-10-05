-- El grupo de WhatsApp de los socios: va en el correo de bienvenida y en el inicio del portal.
--
-- Columna opcional y sin valor por defecto: una institución sin grupo no muestra nada.
-- Escrita a mano: `prisma migrate dev` no se corre contra ninguna base compartida.

ALTER TABLE "MembershipDuesSettings"
  ADD COLUMN IF NOT EXISTS "communityWhatsappUrl" TEXT;
