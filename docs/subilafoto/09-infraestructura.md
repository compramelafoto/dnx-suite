# Infraestructura

Estado al 2026-09-11. Lo que está hecho, lo que falta y por qué.

## Listo

| Pieza | Estado | Detalle |
|---|---|---|
| Dominio | ✅ | `subilafoto.com`, registrado el 11/9 en **DonWeb** (no Dattatec) |
| Zona DNS | ✅ | Creada en DonWeb. `A` → `216.150.1.1` y `216.150.16.1`; `CNAME www` → `subilafoto.com` |
| Proyecto Vercel | ✅ | `subilafoto-dnxsuite` (`prj_38f4hfIb4vtvqcnSXeXY3369aOD3`), root `apps/subilafoto`, región `iad1` |
| Dominios en Vercel | ✅ | `subilafoto.com` y `www.subilafoto.com`, ambos sin conflictos |
| Bucket R2 | ✅ | `subilafoto-media`, con **borrado automático a los 30 días** |
| Rekognition | ✅ verificado | `DetectModerationLabels` responde en `us-east-1`, modelo 7.0 |

### La regla de borrado del bucket

```json
{ "id": "borrado-a-30-dias", "enabled": true,
  "conditions": { "prefix": "" },
  "deleteObjectsTransition": { "condition": { "type": "Age", "maxAge": 2592000 } } }
```

Es **borrado real y automático** de todo objeto con más de 30 días, aplicado por Cloudflare
sin que intervenga la aplicación. Cumple el capítulo 12.3, pero conviene tenerlo presente:
si un evento necesitara conservarse más tiempo, no alcanza con cambiar un campo en la base
— hay que sacar el archivo de este bucket o cambiar la regla.

<!-- El bucket es propio a propósito: un borrado masivo apuntando al de CLF no se deshace. -->

## Latencia de la moderación: un dato para tener en cuenta

Medición real del 11/9 con una imagen JPEG de 84 KB, tres llamadas seguidas:

| Llamada | Tiempo |
|---|---:|
| 1 | 4.620 ms |
| 2 | 11.308 ms |
| 3 | 2.729 ms |

Medido **desde Argentina**, así que incluye subir la imagen hasta Virginia. Desde Vercel en
`iad1`, que está en la misma región que Rekognition, debería ser bastante menor — pero hay
que medirlo ahí antes de prometer nada.

Aun en el mejor caso, esto confirma tres decisiones del plan:

1. La moderación **nunca** bloquea al invitado. Sube, ve "listo", y la foto aparece cuando
   se aprueba.
2. La cola procesa **varias fotos en paralelo**. Con 100 fotos en ráfaga y 3 segundos cada
   una en serie, la última aparecería cinco minutos tarde.
3. La pantalla necesita el SSE justamente porque la foto llega después, no en el momento.

## Falta: la cuenta de AWS propia

Hoy Subí la Foto usaría las credenciales de CompraMeLaFoto. **No conviene**: si hay que
rotar esa clave por un incidente, se cae también el buscador de caras de CLF, que está en
producción.

Lo que hace falta es un usuario IAM dedicado con permiso para una sola operación:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SoloModeracionDeImagenes",
      "Effect": "Allow",
      "Action": "rekognition:DetectModerationLabels",
      "Resource": "*"
    }
  ]
}
```

Un solo permiso, nada más. Si esa clave se filtra, lo peor que puede hacer quien la tenga es
gastar dinero analizando imágenes — no puede leer caras, ni borrar colecciones, ni tocar S3.

**Pasos, en la consola de AWS (IAM → Usuarios → Crear usuario):**

1. Nombre: `subilafoto-moderacion`. Sin acceso a la consola.
2. Adjuntar una política en línea con el JSON de arriba.
3. Crear una clave de acceso, tipo "Aplicación fuera de AWS".
4. Cargar en Vercel, proyecto `subilafoto-dnxsuite`, entorno Production:
   `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-east-1`.

Este paso queda para el titular a propósito: crear identidades y generar claves de acceso es
configuración de seguridad, y la clave secreta no debe pasar por una conversación ni quedar
en un archivo del repositorio. Mientras tanto, el desarrollo puede seguir con las
credenciales existentes, que ya se verificaron.

## Falta: el correo del dominio

No hay casilla en `subilafoto.com`. Por eso la página no publica ninguna dirección de
contacto: un correo que rebota es peor que no tener ninguno. Cuando exista `hola@` o
similar, se agrega a la página y a los emails del sistema como remitente.

## Variables de entorno pendientes en Vercel

| Variable | Para qué | Estado |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Base de CompraMeLaFoto, rama `production` | Falta |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Moderación | Falta la cuenta propia |
| `R2_*` | Bucket `subilafoto-media` | Falta |
| `MP_*` | OAuth de Mercado Pago | Etapa 3 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Login con Google, **proyecto OAuth propio** | Etapa 1 |

El proyecto OAuth de Google es propio y no compartido: la pantalla de consentimiento muestra
el nombre del proyecto, y con el compartido el fotógrafo vería "ComprameLaFoto" al entrar a
Subí la Foto. Es el mismo criterio que se aplicó en Fotoffice.
