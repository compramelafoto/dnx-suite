# Correo del dominio

## Qué es y qué no es

Resend **no da una casilla de correo**. No hay webmail donde entrar a leer. Lo que da es:

- **Envío:** la aplicación manda correos desde `hola@subilafoto.com` (confirmaciones,
  álbum listo, recordatorios de descarga).
- **Recepción:** cuando alguien escribe a `hola@subilafoto.com`, Resend recibe el correo y
  **avisa a la aplicación por un webhook**. No lo deja en ninguna bandeja.

Para que un correo entrante llegue a una persona hay que decidir qué hace la aplicación con
él. La opción simple y la recomendada para el lanzamiento: **reenviarlo automáticamente** a
la casilla de Gmail del titular. Son unas pocas líneas en la ruta del webhook y evita tener
que mirar un panel más.

## Estado

Dominio `subilafoto.com` creado en Resend el 2026-09-11, región `sa-east-1` (São Paulo), la
misma que usan Fotoffice, Clickatón y CompraMeLaFoto. Envío y recepción habilitados.
Estado: `not_started` hasta que los registros DNS estén cargados y verificados.

## Registros DNS a cargar en DonWeb

| Tipo | Nombre | Valor | Prioridad |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEEK9qHTsuSVP8QvH/wFRfisIOR4HaQaGtzhgx7QYeKxEk9+aUj2DsGQ46pLJnQ0F5KsNW/b2f/Z0Gm+4U/N5mXRUEYIgP2jQ9cwNniwJ6qp7E0C5bK5+9Y1o/WL+02yZRCSZM62qjy3zPvQ+fCVOAwtdLj+a468vGI7xYM1lH2QIDAQAB` | — |
| MX | `send` | `feedback-smtp.sa-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend` | `send.forge.rmta.net` | — |
| MX | *(raíz)* | `inbound-smtp.sa-east-1.amazonaws.com` | 10 |

El último es el que permite **recibir**. Tiene que ser el MX de prioridad más baja del
dominio, o el correo entrante se va a otro lado. Hoy la zona de `subilafoto.com` no tiene
ningún otro MX, así que no hay conflicto — pero si alguna vez se contrata un correo con
otro proveedor, esto se rompe en silencio.

## Después de cargarlos

1. Disparar la verificación en Resend.
2. Cuando el dominio quede `verified`, agregar `hola@subilafoto.com` a la página pública,
   que hoy no publica ninguna dirección justamente porque todavía rebotaría.
3. Crear el webhook de recepción y decidir el reenvío.

## Advertencia sobre el arranque

Un dominio nuevo no puede mandar mucho correo de golpe: el primer día el límite ronda los
**150 envíos**. Los recordatorios de descarga de los días 1, 3, 7, 15 y 30 tienen que
respetar ese calentamiento, sobre todo si el 10 de octubre entran varios eventos juntos.
