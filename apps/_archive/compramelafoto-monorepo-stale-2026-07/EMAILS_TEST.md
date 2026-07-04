# Checklist de pruebas - Emails (Resend)

## Variables requeridas
- `RESEND_API_KEY`
- `EMAIL_FROM=info@compramelafoto.com`
- `EMAIL_REPLY_TO` (email real de soporte/admin)
- `APP_URL=https://compramelafoto.com`

## Pruebas de auth
1. Registro (cliente/fotógrafo/lab):
   - Debe crear `EmailVerificationToken`.
   - Debe enviar `AUTH01_VERIFY_EMAIL`.
2. Verificación:
   - Abrir `/verify-email?token=...` y ver respuesta ok.
3. Forgot password:
   - POST `/api/auth/forgot-password` con email existente.
   - Debe crear `PasswordResetToken` (expires 1h) y enviar `AUTH02_RESET_PASSWORD`.
4. Reset password:
   - POST `/api/auth/reset-password` con token y contraseña.
   - Debe enviar `AUTH03_PASSWORD_CHANGED`.
5. Login alert:
   - Primer login desde un dispositivo nuevo debe disparar `AUTH04_LOGIN_ALERT`.

## Pruebas de interés de álbum
1. Suscripción:
   - POST `/api/a/[id]/notifications` con email válido.
   - Debe crear/actualizar `AlbumInterest` con `nextEmailAt=now`.
2. Cron:
   - Ejecutar GET `/api/cron/album-interest-emails` (con `CRON_SECRET` si aplica).
   - Debe enviar el email correspondiente (E01..E08) y marcar flags `sentE0X`.

## Reactivación de álbum
1. Reactivar (admin o extensión):
   - PATCH `/api/admin/albums/[id]/reactivate` o POST `/api/album-extensions/request`.
   - Debe resetear `sentE01..sentE08` y setear `nextEmailAt=now`.

## Panel admin
1. /admin/emails -> “Enviados”
2. /admin/emails -> “Redactar” (envío manual)
3. /admin/emails -> “Contactos” (Users + AlbumInterest)
4. /admin/emails -> “Alertas” (errores de emails)
5. Header admin muestra badge rojo con no leídos
