# Migraciones, pruebas y despliegue

Responde a los entregables 11, 12 y 13 del capítulo 37.

## Primero: "base compartida" no significa lo que parece

En DNX Suite el schema Prisma es uno solo, pero **las bases son varias y no comparten
usuarios**. Verificado el 2026-09-11 contra Neon:

| Base | Qué corre ahí | Usuarios | Tablas |
|---|---|---:|---:|
| `divine-hall` rama `production` | CompraMeLaFoto | **797** (272 con Mercado Pago conectado) | 462 |
| `divine-hall` rama `development` | Fotoffice y FotoRank | 202 | 440 |
| `bitter-math` | Clickatón | — | — |
| `wandering-pine` | InfoSpot | — | — |
| `fragrant-union` | Staging de la suite | — | — |

Un fotógrafo registrado en CompraMeLaFoto **no existe** en la base de Fotoffice. Compartir
el código de login no comparte las cuentas.

Por eso "Subí la Foto usa el login compartido" todavía no está resuelto del todo: falta
decir **en qué base vive**. Es la decisión bloqueante número uno del documento 07.

## Las 19 tablas nuevas son la parte fácil

Al contrario de lo que suele pasar con este schema, agregar Subí la Foto es de **bajo
riesgo** para las otras aplicaciones:

- Son **tablas nuevas**. Ninguna app existente las conoce, así que no puede romperse por
  ellas.
- Las relaciones hacia `User` y `Workspace` son relaciones inversas de Prisma: la clave
  foránea vive en la tabla nueva, **no agrega ninguna columna a `User`**. Ese es
  precisamente el caso que provoca el error P2022 en las otras apps, y acá no ocurre.
- El único cambio a algo existente es **agregar `SUBILAFOTO` al enum `SuiteApp`**, que en
  Postgres es un `ALTER TYPE ... ADD VALUE`: no bloquea y no reescribe la tabla.

## Procedimiento de migración

<!-- Ningún build corre `prisma migrate deploy`. Aplicar y registrar son dos pasos. -->

1. Generar la migración en local contra una rama Neon de prueba, nunca contra producción.
2. Correr `pnpm --filter @repo/db db:drift` para ver qué falta en cada base.
3. Aplicar el SQL en la base donde vive Subí la Foto.
4. Aplicar **sólo el `ALTER TYPE` del enum** en las demás bases que tengan `SuiteApp`.
5. Registrar la migración en `_prisma_migrations` de cada base, copiando el checksum de una
   base donde ya esté aplicada y verificándolo con `shasum -a 256` contra el archivo local.
6. Confirmar con `prisma migrate status` que ninguna base la denuncia como modificada.

El paso 5 no es burocracia: si el SQL se aplica pero no se registra, la tabla existe y
Prisma cree que no. La próxima migración falla o, peor, se aplica dos veces.

**Antes de cada migración en la base de producción, crear una rama de respaldo en Neon.**
Ya es la costumbre del proyecto — hay más de una docena de ramas `backup-*` — y es lo que
convierte un error de migración en un susto de diez minutos.

## Plan de pruebas

### Automáticas

| Qué | Cómo |
|---|---|
| Cálculo de la ventana de 12 horas | Unitarias, con casos de horario de verano y cambio de fecha |
| Motor de reglas de moderación | Unitarias, con respuestas de Rekognition guardadas como fixtures |
| **Falla cerrada** | Simular timeout, error 500 y credenciales inválidas: ninguna publica |
| Cálculo de comisión y adicional | Unitarias, en centavos, con casos de redondeo |
| Idempotencia del webhook | El mismo aviso tres veces produce un evento y un cobro |
| Deduplicación de emails | El worker reintentado no manda dos veces el mismo recordatorio |
| Permisos | Una prueba por celda "✗" de la matriz de roles |
| Recorrido crítico | E2E con Playwright: QR → carga → moderación simulada → pantalla |

`packages/e2e` ya existe en el monorepo y hay Playwright disponible en la sesión.

### Manuales, sin sustituto posible

Estas no se automatizan y son las que evitan el papelón el día del evento:

- Un iPhone y un Android **reales**, en el salón, con el wifi del salón.
- Un televisor o proyector real, dos horas seguidas de proyección.
- Modo avión a mitad de la carga; wifi cortado a mitad de la proyección.
- Cien fotos entrando en diez minutos desde varios teléfonos a la vez.
- La pantalla vista desde el fondo del salón: ¿se lee el QR?

## Despliegue

- Proyecto Vercel propio, `subilafoto.com` como dominio canónico.
- Rama `main` a producción; cada rama de trabajo con su preview.
- Variables nuevas: credenciales de Rekognition (o reutilizar las de CLF), bucket R2
  propio, secreto del webhook de Mercado Pago, secreto de firma de las cookies de invitado.
- **Bucket R2 propio para Subí la Foto**, no compartido con CLF. Las políticas de retención
  son distintas: acá se borra a los 30 días, y un borrado masivo apuntando al bucket
  equivocado es irreversible.

### Rollback

| Falla | Qué se hace |
|---|---|
| Un despliegue rompe la app | Rollback instantáneo al anterior desde Vercel |
| Una migración rompe algo | Restaurar desde la rama de respaldo de Neon |
| Rekognition caído | Todo queda retenido (así está diseñado). Se activa el permiso de aprobación manual y el fotógrafo modera desde el panel |
| SSE caído | La pantalla cae sola al respaldo por consulta cada 15 s. Se nota, no se rompe |
| Mercado Pago caído | No se pueden vender eventos nuevos. Los ya pagados no se ven afectados |

El caso de Rekognition caído merece un ensayo real durante la Etapa 4: es el único que
obliga a operar distinto en vivo, y hay que saber que el camino manual funciona **antes**
de necesitarlo un sábado a las once de la noche.

## La moderación automática (Etapa 2.3 a 2.6)

Escrita el 2026-09-12. Cómo está armada y por dónde entra.

### Las piezas

| Archivo | Qué hace |
|---|---|
| `lib/moderacion/reglas.ts` | La política: umbrales por perfil, categorías de riesgo alto y la falla cerrada. **Función pura**, sin base ni nube |
| `lib/moderacion/proveedor.ts` | El contrato con el servicio de moderación, sea cual sea |
| `lib/moderacion/rekognition.ts` | La única pieza que sabe que existe Amazon |
| `lib/moderacion/procesar.ts` | El paso de foto subida a foto decidida. Recibe base y proveedor por parámetro |
| `lib/moderacion/conectar.ts` | Traducción a Prisma y R2 |
| `app/api/moderacion/procesar/route.ts` | La red de seguridad, protegida con `CRON_SECRET` |

Esa separación no es adorno: **42 tests cubren la política y la idempotencia sin
base de datos y sin gastar una sola llamada a Amazon.**

### Por dónde entra

El camino normal es `after()`: la ruta de confirmación le contesta al invitado y
*después* modera. El invitado ve "listo" enseguida y la foto aparece cuando se
aprueba. Moderar antes de responder lo dejaría mirando una rueda girar en medio
de la fiesta.

La red de seguridad es el cron cada 5 minutos, para las fotos que se perdieron
porque la función se cortó o Amazon estaba caído. Sin ella, una foto que falló
una vez se queda en `PROCESSING` para siempre y nadie se entera hasta que el
cliente pregunta por qué no salió en la pantalla.

### La idempotencia vive en la base, no en el código

El cambio de estado es un `updateMany ... where status = 'PROCESSING'` dentro de
una transacción con la escritura de la decisión. Si dos procesos llegan juntos,
el segundo cambia **cero filas**, no escribe decisión y se va. Por eso reprocesar
no publica dos veces.

El costo de esa elección: si dos procesos coinciden, los dos llaman a Amazon y
uno de los dos análisis se tira. Son 0,001 dólares y pasa muy poco. La
alternativa era un estado intermedio en el enum, que obliga a migrar las cinco
bases.

### Qué pasa cuando algo falla

Todo error —credenciales rotas, límite de frecuencia, imagen ilegible, archivo
que no está en el bucket— termina en `REVIEW_REQUIRED`. **Retenida, no
bloqueada**, y la diferencia importa: bloqueada es una acusación, retenida es
"todavía no la miramos". Si Amazon se cae una noche, el fotógrafo aprueba a
mano; lo que no puede pasar es que se proyecte algo que nadie evaluó.

Hay un detalle que conviene no perder: **una categoría que la política no
contempla, con 80% de confianza o más, también va a revisión**. Amazon agrega
categorías cuando publica un modelo nuevo, y sin esa regla la primera foto de
una categoría que todavía no evaluamos se publicaría sola.

### Configuración que hace falta en Vercel

- `CRON_SECRET` — sin ella la ruta devuelve 503 y el cron falla ruidosamente,
  que es preferible a dejarla abierta.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` — ya cargadas.

El `vercel.json` de la app declara **sólo** el cron. El comando de build y el de
instalación los sigue poniendo el panel de Vercel; agregarlos acá pisaría la
configuración que ya funciona.

## La prueba de la moderación con fotos reales

Son tres preguntas distintas y conviene no mezclarlas.

### Parte 1 — ¿Funciona la cañería? — HECHA el 2026-09-13

**Sí.** Dos fotos reales subidas a un evento de prueba en producción:

| | |
|---|---|
| Estado final | `APPROVED` con `publishedAt` |
| Proveedor | `aws-rekognition`, modelo 7.0 |
| Latencia | **243 ms y 219 ms** desde Vercel |
| `errorCode` | Nulo en las dos |

También quedó verificado el resto del recorrido: el álbum las muestra, el canal
en vivo las emite, y al reconectar con el cursor **no repite ni pierde ninguna**.

#### Lo que encontró esta prueba, que ningún test había visto

Amazon devuelve **la categoría y también su subcategoría**, las dos con la misma
confianza. En la foto de los novios llegaron `Alcohol` y `Alcoholic Beverages`.

La política trataba a la subcategoría como una categoría desconocida, y la regla
de lo desconocido manda a revisión arriba del 80%. Con una copa bien visible
—que en un casamiento es casi todas las fotos— **la subcategoría habría retenido
la foto en el perfil `SOCIAL`, que es justamente donde el alcohol está
permitido**.

Arreglado el mismo día: las reglas distinguen nivel uno de subcategoría. Una
categoría nueva de primer nivel sigue yendo a revisión; una subcategoría
desconocida se ignora, porque su categoría madre llega en la misma respuesta y
es la que decide. Hay cuatro tests que reproducen el caso exacto.

Es el mejor argumento a favor de la Parte 2: esto no aparece en un test, aparece
subiendo una foto de verdad.

### El procedimiento de la Parte 1, para repetirla

Una sola foto normal, de un evento cualquiera. Lo que hay que ver:

1. Se sube y queda en `PROCESSING`.
2. En segundos pasa a `APPROVED` y le aparece `publishedAt`.
3. En `SubilafotoModerationDecision` queda una fila con `provider` =
   `aws-rekognition`, la versión del modelo, la latencia y `errorCode` en nulo.

Si el estado queda en `REVIEW_REQUIRED` con un `errorCode`, la cañería está
rota y ese código dice exactamente dónde: `AccessDeniedException` es la clave
IAM, `NoSuchKey` es el bucket, `UnrecognizedClientException` es la región.

**Medir también la latencia real**, no la del diagnóstico: desde Vercel debería
rondar los 100 ms más la descarga desde R2.

### Parte 2 — ¿Los umbrales son razonables?

Esta es la que de verdad importa y **necesita fotos reales de eventos**, no
imágenes de prueba. Lo que se busca no es que bloquee lo prohibido —eso lo hace—
sino **cuántas fotos buenas retiene por error**, que es lo que arruina una fiesta.

Material mínimo, unas veinte fotos:

| Cuántas | Qué | Qué debería pasar |
|---|---|---|
| 10 | Fotos normales de casamiento y de quince | Todas aprobadas. **Si retiene una, hay un problema** |
| 3 | Gente brindando, con copas bien visibles | Aprobadas en perfil `SOCIAL`, retenidas en `FAMILIAR` |
| 2 | Baile, abrazos, gente muy junta | Aprobadas. Es el falso positivo más probable |
| 2 | Fiesta con pileta o playa, en malla | Aprobadas en `SOCIAL`, retenidas en `FAMILIAR` |
| 2 | Alguien fumando | Retenidas en `FAMILIAR`, aprobadas en `SOCIAL` |
| 1 | Un gesto con el dedo, de esos que salen en toda fiesta | Retenida en `FAMILIAR` |

**Cómo se corre:** crear un evento de prueba por perfil (`FAMILIAR`, `SOCIAL`,
`EMPRESARIAL`), subir el mismo lote a los tres y comparar. Las diferencias entre
perfiles son el resultado de la prueba; si los tres deciden igual, los umbrales
no están haciendo nada.

**Qué se ajusta después:** los números de `UMBRALES` en
`lib/moderacion/reglas.ts`, y hay que subir `VERSION_DE_POLITICA` en el mismo
commit. Las decisiones ya tomadas quedan atadas a la versión con la que se
tomaron, que es el punto de guardarla.

**Lo que no se puede probar con fotos propias** es el contenido explícito, y no
hace falta: para eso están los tests de riesgo alto, que verifican que ninguna
categoría grave se apruebe en ningún perfil.

### Parte 3 — La falla cerrada, en producción

Ya hay tests, pero conviene verla una vez de verdad: romper temporalmente
`AWS_ACCESS_KEY_ID` en Vercel, subir una foto y confirmar que queda retenida y
**no publicada**. Después restaurar la variable y reprocesar con
`/api/moderacion/procesar`.

Es la prueba que más tranquilidad da y la que menos ganas dan de hacer. Vale la
pena hacerla antes del lanzamiento y no después del primer evento real.

## La migración de Mercado Pago (2026-09-13)

`20260913120000_subilafoto_mercadopago` agrega cuatro columnas opcionales a
`SubilafotoSellerProfile`: `mpUserId`, `mpCredential`, `mpConnectedAt` y
`mpTokenExpiresAt`.

### Corrección al registro: las tablas de Subí la Foto viven en UNA base

El documento 05 decía que la migración de la Etapa 1 se aplicó "en las 5 bases".
**No es así, y está bien que no lo sea.** Verificado el 13/9: la rama
`development` de Neon —FOTOFFICE y FotoRank— no tiene `SubilafotoSellerProfile`
ni figura ninguna migración de Subí la Foto en su `_prisma_migrations`.

Las tablas de Subí la Foto sólo existen en la rama `production`, que es la única
base que esta aplicación usa. La advertencia de aplicar a las cinco vale para
campos en tablas que **otras** aplicaciones escriben; estas no las toca nadie más.

Así que esta migración también se aplicó sólo a `production`, y queda registrada
en su `_prisma_migrations` con el checksum del archivo.

### Por qué el token no reutiliza los campos de `User`

`User` ya tiene `mpAccessToken` y `mpRefreshToken`, y sería tentador usarlos.
**Rompería CompraMeLaFoto.** Los tokens de Mercado Pago son por aplicación: el de
Subí la Foto no sirve para cobrar desde CLF, y pisarlo dejaría a CLF sin poder
cobrar sin que nadie se entere hasta el primer cobro fallido.

### El token va cifrado

En `mpCredential`, con AES-GCM del vault de `@repo/payments`. Con ese token se
puede cobrar en nombre del vendedor, así que no va en texto plano.

AES-GCM y no sólo cifrado: **detecta si alguien tocó el texto cifrado** en lugar
de devolver basura. Hay un test que lo verifica.

**Hace falta `MP_CREDENTIAL_KEY` en Vercel**: 32 bytes en base64. Sin ella, la
conexión de Mercado Pago falla con un mensaje claro.
