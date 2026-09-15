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

## Registros DNS (cargados el 2026-09-11)

**DonWeb pide el nombre completo, no el relativo.** Resend muestra `resend._domainkey`,
pero el formulario rechaza eso con "El campo Nombre debe contener el nombre de su dominio":
hay que escribir `resend._domainkey.subilafoto.com`. Vale para todos los registros.

| Tipo | Nombre | Valor | Prioridad |
|---|---|---|---|
| TXT | `resend._domainkey.subilafoto.com` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEEK9qHTsuSVP8QvH/wFRfisIOR4HaQaGtzhgx7QYeKxEk9+aUj2DsGQ46pLJnQ0F5KsNW/b2f/Z0Gm+4U/N5mXRUEYIgP2jQ9cwNniwJ6qp7E0C5bK5+9Y1o/WL+02yZRCSZM62qjy3zPvQ+fCVOAwtdLj+a468vGI7xYM1lH2QIDAQAB` | — |
| MX | `send.subilafoto.com` | `feedback-smtp.sa-east-1.amazonses.com` | 10 |
| TXT | `send.subilafoto.com` | `v=spf1 include:amazonses.com ~all` | — |
| CNAME | `rsend.subilafoto.com` | `send.forge.rmta.net` | — |
| MX | `subilafoto.com` *(raíz)* | `inbound-smtp.sa-east-1.amazonaws.com` | 10 |

El último es el que permite **recibir**. Tiene que ser el MX de prioridad más baja del
dominio, o el correo entrante se va a otro lado. Hoy la zona de `subilafoto.com` no tiene
ningún otro MX, así que no hay conflicto — pero si alguna vez se contrata un correo con
otro proveedor, esto se rompe en silencio.

Los cinco quedaron publicados y verificados contra `ns1.donweb.com`. La web no se vio
afectada: los registros `A` siguen respondiendo.

## Después de cargarlos

1. ~~Disparar la verificación en Resend.~~ Hecho el 11/9; queda en `pending` unos minutos.
2. Cuando el dominio quede `verified`, agregar `hola@subilafoto.com` a la página pública,
   que hoy no publica ninguna dirección justamente porque todavía rebotaría.
3. Crear el webhook de recepción y decidir el reenvío.

## Advertencia sobre el arranque

Un dominio nuevo no puede mandar mucho correo de golpe: el primer día el límite ronda los
**150 envíos**. Los recordatorios de descarga de los días 1, 3, 7, 15 y 30 tienen que
respetar ese calentamiento, sobre todo si el 10 de octubre entran varios eventos juntos.

## Por qué no usa el runtime controlado (2026-09-15)

Los cinco avisos posteriores al evento salían por `@repo/communications`, el runtime
controlado de Resend. **No podían funcionar nunca**, y no era una variable que faltaba.

Ese runtime tiene dos compuertas que este caso no puede pasar:

1. **`RESEND_ALLOWED_RECIPIENTS` es obligatorio y no admite comodines ni dominios.** Hay
   que listar cada dirección, una por una. El destinatario de estos avisos es el cliente
   de un fotógrafo: no se puede conocer antes de que compre.
2. **`confirmLiveSend` sólo lo pasa el script de prueba por línea de comandos.** Desde un
   cron llega siempre en `false`, así que `canLiveSend` era `false` con o sin claves.

No es un defecto del paquete: está hecho para el correo interno, donde se sabe quién
recibe. El informe diario lo usa así y está bien. **CompraMeLaFoto ya le escribe a sus
compradores con el SDK de Resend directo**, por el mismo motivo.

### Lo que hace ahora

El mismo camino que CompraMeLaFoto, conservando lo que sí importaba del runtime: que nada
salga hasta que alguien lo encienda.

**Dos llaves, no una.** Hacen falta `RESEND_API_KEY` **y** `SUBILAFOTO_CORREOS_EN_VIVO`
con el valor exacto `true`. La clave sola no alcanza: alguien podría copiar las variables
de otro proyecto y empezar a escribirle a los clientes de un fotógrafo sin quererlo.
`"1"`, `"si"` y `"on"` no encienden nada — es una decisión escrita, no un descuido.

**El remitente lleva el nombre del vendedor.** La dirección tiene que ser de un dominio
verificado —el nuestro, `avisos@subilafoto.com`— pero el nombre que ve el cliente es el de
quien le vendió el servicio. Es lo máximo que permite el correo sin que cada fotógrafo
verifique su propio dominio, y es coherente con el texto, que ya firmaba con el vendedor.

Ese nombre lo escribe el vendedor, así que se limpia antes de usarlo: un `<` o unas
comillas rompen la cabecera del mensaje y en el peor caso dejan colar otra dirección.

**Clave de idempotencia en el envío.** Resend descarta el mismo envío repetido durante 24
horas. Es la segunda red después de la restricción de unicidad de la base: si algo
reintenta entre que mandamos y anotamos, el cliente no recibe dos copias.

**El SDK de Resend no lanza excepciones**, devuelve `{ data, error }`. Un `try/catch` no
vería nada.

### Para encenderlos

| Variable | Valor | Quién |
|---|---|---|
| `RESEND_API_KEY` | La clave de Resend | Titular |
| `SUBILAFOTO_CORREOS_EN_VIVO` | `true` | Titular, cuando decida |
| `SUBILAFOTO_EMAIL_FROM` | `avisos@subilafoto.com` | Ya cargada |

Y el dominio `subilafoto.com` verificado en Resend, o el envío devuelve 403.
