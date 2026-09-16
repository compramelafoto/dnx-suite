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

## La cuenta de AWS propia — hecha

El 2026-09-11 el titular creó el usuario IAM `subilafoto-moderacion` con una sola operación
permitida:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "SoloModeracionDeImagenes", "Effect": "Allow",
      "Action": "rekognition:DetectModerationLabels", "Resource": "*" }
  ]
}
```

Un solo permiso. Si esa clave se filtra, lo peor que puede hacer quien la tenga es gastar
dinero analizando imágenes: no puede leer caras, ni borrar colecciones, ni tocar S3. Y si
hay que rotarla, no se cae el buscador de caras de CompraMeLaFoto.

Las claves las creó y cargó el titular en Vercel. Ese paso queda para él a propósito: crear
identidades y generar claves es configuración de seguridad, y una clave secreta no debe
pasar por una conversación ni quedar en un archivo del repositorio.

### Por qué Amazon y no Google Cloud Vision

Porque **la cuenta de facturación de Google Cloud está cerrada** (`open: false`, verificado
el 2026-09-12) y Cloud Vision exige facturación activa aun para su tramo gratuito. Además
Amazon sale más barato: USD 1,00 por cada 1.000 imágenes contra USD 1,50 de Google. El
detalle completo, con la tabla de precios y lo que queda abierto, en la decisión 5 del
documento 07.

## Falta: el correo del dominio

No hay casilla en `subilafoto.com`. Por eso la página no publica ninguna dirección de
contacto: un correo que rebota es peor que no tener ninguno. Cuando exista `hola@` o
similar, se agrega a la página y a los emails del sistema como remitente.

## Variables de entorno en Vercel

Verificado en producción el 2026-09-11 con `/api/diagnostico`:

| Variable | Para qué | Estado |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Base de CompraMeLaFoto, rama `production` | ✅ |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Moderación, usuario propio `subilafoto-moderacion` | ✅ |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` / `AUTH_URL` | Login unificado con la suite | ✅ cargadas |
| `R2_*` | Bucket `subilafoto-media` | ✅ verificado de punta a punta el 11/9 |
| `MP_*` | OAuth de Mercado Pago | Etapa 3 |

**La moderación desde Vercel tarda ~100 ms**, no los 2,7 a 11 segundos medidos desde
Argentina. El costo era la distancia hasta Virginia, no el servicio. Sigue valiendo que la
cola sea asíncrona, pero el margen es mucho más cómodo de lo que parecía.

### La trampa de las dos filas

Al configurar esto se perdió media hora con un `P2021 — la tabla no existe` que en realidad
decía "estás en otra base". Los proyectos de Vercel tienen **dos entradas** de
`DATABASE_URL`: la de `production` apunta a la base real y la de `preview` a
`dnx-suite-staging` (`ep-round-fog`). En la pantalla se llaman igual.

Peor: la de producción es de tipo **sensitive**, que Vercel no deja revelar nunca, y la de
preview es **encrypted**, que sí. O sea que la única copiable es la equivocada.

**El valor correcto se saca de Neon**, no de Vercel: consola → proyecto `compramelafoto` →
rama `production` → Connect. Con "Connection pooling" encendido para `DATABASE_URL` y
apagado para `DIRECT_URL`.

Ante un `P2021` en una app nueva, lo primero es mirar el **host** de la base, no la
migración.

## Autenticación: unificada con el resto de DNX Suite

**Decisión del titular, 2026-09-11:** el inicio de sesión de SubiLaFoto usa **el mismo
cliente OAuth de Google que el resto de la suite**. No se crea un proyecto nuevo en Google
Cloud.

Esto revierte lo que estaba escrito antes acá, que proponía un proyecto propio para que la
pantalla de permisos mostrara "SubiLaFoto" y no "ComprameLaFoto". Se acepta ese costo
—el usuario ve el nombre del proyecto compartido al entrar— a cambio de que la identidad
sea una sola en toda la suite. Es coherente con la decisión de compartir la base: un
fotógrafo es la misma persona en CompraMeLaFoto y en SubiLaFoto, y debería entrar igual.

Lo que hay que hacer, y no genera credenciales nuevas:

1. En Google Cloud, en el cliente OAuth que ya usa la suite, **agregar las URIs de
   redirección** de SubiLaFoto: `https://subilafoto.com/api/auth/google/callback` y
   `https://www.subilafoto.com/api/auth/google/callback` (confirmar la ruta exacta contra
   `packages/auth/src/google-oauth.ts` al implementar el login).
2. En el proyecto `subilafoto-dnxsuite` de Vercel, cargar `GOOGLE_CLIENT_ID` y
   `GOOGLE_CLIENT_SECRET` **con los mismos valores** que tiene `fotoffice-dnxsuite`.

Si más adelante molesta que el consentimiento diga otro nombre, se puede cambiar el nombre
público del proyecto OAuth a algo neutro como "DNX Suite", que sirve para todas.

## Mercado Pago: cómo se integra de verdad (corregido el 2026-09-14)

**El 13/9 se escribió una capa de pagos propia dentro de `apps/subilafoto` y se
revirtió entera al día siguiente.** Duplicaba infraestructura que ya existe y
mejor. Queda escrito para que nadie la vuelva a escribir.

### Lo que estaba mal

| Lo que hice | Lo que corresponde |
|---|---|
| Decir que había que crear una aplicación de Mercado Pago para SubiLaFoto | **Una sola app "DNX Suite"** para toda la suite, decidido el 2026-09-03. Cada app nueva pide su propia homologación, que es el trámite que ya frenó a FOTOFFICE |
| Un `/api/pagos/aviso` propio como URL de notificación | **Acá me pasé de corrección y lo verifiqué después.** El límite de una sola URL es del flujo de **Orders / split 1:N**, que se configura en el panel. En **Checkout Pro la `notification_url` viaja en cada preferencia**, así que cada producto sí puede tener la suya — es como lo hace CompraMeLaFoto hoy y como está diseñado el adaptador del paquete |
| `external_reference` = el id de la orden, pelado | La convención es `<producto>-<entidad>-<idOpaco>`, y ya existe `buildOpaqueExternalReference()`. **Ojo con sus guardas anti-PII: pierden fuerza con el prefijo puesto.** "Ana Gonzalez" deja de parecer un nombre cuando la cadena es `subilafoto-orden-Ana Gonzalez`; del segmento del id sólo se revisa que no tenga arroba. SubiLaFoto valida aparte que el id sea opaco |
| Un `preferencia.ts` propio con `marketplace_fee` | Ya existe `createMercadoPagoCheckoutProLiveAdapter` en `@repo/payments`, con su `marketplace-fee.test.ts` |
| Un `estado-oauth.ts` firmado a mano | Existe la tabla compartida `DnxMercadoPagoOAuthState`, con PKCE, vencimiento y un solo uso |
| Cuatro columnas de credenciales en `SubilafotoSellerProfile` | El vault persiste en `DnxFinancialIdentity` + `DnxPaymentAccount`. No van columnas por app |
| `MP_CREDENTIAL_KEY` propia | La clave del vault es de toda la suite: `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` |
| Variables `MP_*` peladas | La convención es `<PRODUCTO>_MP_*`, como `FOTOFFICE_MP_CLIENT_ID` |

Todo eso está revertido: código borrado, columnas quitadas de la base y las dos
variables sacadas de Vercel.

### Lo que corresponde hacer

Portar el módulo `apps/fotoffice/lib/payments/connect/`, que es el consumidor más
nuevo y completo de la infraestructura compartida. Son unas 2.200 líneas con sus
tests y resuelve lo que mi versión ignoraba: PKCE, estado de un solo uso con
vencimiento, identidad financiera, frescura del token y consentimiento.

Variables que van a hacer falta, con la convención correcta:
`SUBILAFOTO_MP_CLIENT_ID`, `SUBILAFOTO_MP_CLIENT_SECRET`,
`SUBILAFOTO_MP_REDIRECT_URI` — y la clave del vault, que ya debería existir para
la suite.

**No hay que crear ninguna aplicación en Mercado Pago.** Sí hay que declarar la
URL de retorno de SubiLaFoto en la lista de la app centralizada: eso sí admite
varias, a diferencia de la de notificación.

## La compra, de punta a punta (2026-09-14)

`/v/[slug]` → `/v/[slug]/comprar` → Mercado Pago → `/compra/[id]/gracias`, con
`/api/pagos/aviso` recibiendo la confirmación por atrás.

### El orden en que pasan las cosas, y por qué

1. Se revisan los datos del comprador.
2. Se resuelve **el cobrador**: el token del vendedor, refrescado si hace falta.
3. Recién ahí se crea la orden.
4. Y al final se arma la preferencia.

Crear la orden antes dejaría órdenes pendientes de nadie cada vez que un
vendedor no tiene su cuenta conectada o alguien escribe mal el correo. Y el
comprador se entera de que ese vendedor no puede cobrar **antes** de completar
un formulario, no después.

### La pantalla de gracias no miente

Se puede llegar ahí **antes** de que Mercado Pago nos avise: la vuelta del
navegador y el aviso al servidor son dos caminos distintos y el segundo puede
tardar. Si la orden todavía figura pendiente, la pantalla dice que estamos
confirmando. Afirmar que el pago está hecho y que después falle es peor que
pedir un minuto.

### El evento nace sin fecha

Lo crea el aviso de pago, pero **sin fecha**: la pone el cliente al configurarlo.
Inventarle una haría que la ventana de 12 horas empiece a correr sin que nadie
lo sepa.

Si la creación del evento falla, **la orden queda pagada igual**. La plata entró;
perder el pago sería mucho peor que crear el evento tarde. Queda registrado el
motivo.

### Variables que faltan cargar

| Variable | Para qué |
|---|---|
| `SUBILAFOTO_MP_CLIENT_ID` | La app única de la suite |
| `SUBILAFOTO_MP_CLIENT_SECRET` | Lo mismo. Es secreta |
| `SUBILAFOTO_MP_REDIRECT_URI` | `https://subilafoto.com/api/pagos/conectar/retorno` |
| `SUBILAFOTO_MP_ACCESS_TOKEN` | Para preguntarle a Mercado Pago el estado real de cada pago |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` | La bóveda de toda la suite |
