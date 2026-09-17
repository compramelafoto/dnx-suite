-- Constancia enviada por correo.
--
-- La Resolución 424/2020 pide dar constancia de la solicitud. Mostrarla en pantalla es la
-- mitad: si la persona cierra la pestaña, pierde el número. Queda registrado si el correo
-- salió y, si no salió, por qué — es la prueba de haber cumplido.
ALTER TABLE "SubilafotoRetractionRequest" ADD COLUMN "noticeSentAt" TIMESTAMP(3);
ALTER TABLE "SubilafotoRetractionRequest" ADD COLUMN "noticeError" TEXT;
