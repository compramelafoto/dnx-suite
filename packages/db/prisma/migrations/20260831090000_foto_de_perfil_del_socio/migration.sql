-- Foto del portal, separada de la del carnet.
--
-- La del carnet es una foto de documento: encuadre fijo, fondo plano, aprobada por la
-- Secretaría. La del perfil es cómo el socio quiere mostrarse. Nula significa "usar la del
-- carnet", así que nadie tiene que hacer nada para seguir como estaba.
ALTER TABLE "Member" ADD COLUMN "profilePhotoUrl" TEXT;
