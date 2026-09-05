# Publicación automática en Instagram de álbumes listos

**Fecha:** 2026-09-05
**App que se cablea:** `apps/compramelafoto`
**Paquetes que se tocan:** `@repo/social-publisher`, `@repo/design-studio`, uno nuevo
**Estado por defecto:** simulacro (`DNX_SOCIAL_PUBLISHER_LIVE` ausente = no publica nada real)

---

## 1. Objetivo

Cuando un fotógrafo termina de subir un álbum público y el análisis de fotos concluye,
el sistema arma un **carrusel** y una **historia** de Instagram con 3 o 4 fotos elegidas
por el propio fotógrafo, y los deja esperando aprobación en un panel. Al aprobarlos, se
publican desde la cuenta institucional de CompraMeLaFoto con el fotógrafo etiquetado como
colaborador y mencionado en el texto.

El objetivo comercial es que cada álbum nuevo se dé a conocer sin trabajo manual y que el
fotógrafo reciba difusión en su propio perfil a través de la etiqueta de colaboración.

## 2. Por qué existe y qué hay hoy

`@repo/social-publisher` ya existe y funciona: tiene estados, cifrado de tokens,
reintentos, auditoría y un panel en Clickatón. Pero le faltan tres cosas para servir a
este caso:

1. **No existe ningún módulo de conexión.** No hay flujo OAuth con Meta en todo el
   monorepo. Las filas de `DnxSocialAccount` habría que insertarlas a mano en la base.
   Éste es el hueco más grande y el que da nombre al trabajo.
2. **El provider de Instagram solo publica una imagen suelta.** No sabe hacer carrusel,
   ni historia, ni etiquetar colaboradores.
3. **CompraMeLaFoto no lo usa.** Está cableado únicamente en Clickatón.

Del lado de CLF ya está resuelto el disparador: `lib/analysis/album-analysis-readiness.ts`
decide cuándo un álbum está analizado, y es la misma regla que hoy gobierna los avisos por
correo al cliente.

## 3. Restricción que ordena todo: cada app tiene su propia base

El schema de Prisma es compartido, pero **cada app apunta a una base Neon distinta**
(CLF `ep-proud-wildflower`, fotoffice `ep-dawn-dew`). Una cuenta de Instagram conectada
desde fotoffice **no se ve** desde CompraMeLaFoto.

Consecuencia directa: no se puede construir un panel social único para toda la suite sin
inventar infraestructura nueva (una API entre apps o una sexta base). Ambas cosas se
descartaron por costo y por superficie de falla.

**La publicación es una capacidad compartida en forma de paquetes, con datos por app.**
Cada aplicación monta los mismos paquetes contra su propia base, conecta su propia cuenta
de Instagram y usa su propia plantilla. Infospot publicará con marca Infospot en la cuenta
de Infospot sin una sola línea de código nueva: monta los paquetes, conecta su cuenta y
hace su plantilla.

## 4. Arquitectura

Tres piezas compartidas más la app que las usa, con una división de responsabilidades
que no se debe mezclar:

| Pieza | Responsabilidad | Qué no hace |
|---|---|---|
| `@repo/design-studio` | Arma la imagen: layout, tipografía, huecos de foto, variables | No sabe de red, ni de tokens, ni de colas |
| `@repo/social-publisher` | Publica: estados, tokens, reintentos, auditoría, Meta | No sabe de diseño ni de álbumes |
| Paquete nuevo (fino) | Une los dos: plantilla + datos → JPEG → R2 → solicitud | No decide cuándo publicar |
| App (CLF) | Decide cuándo, con qué fotos y con qué permiso | No habla con Meta directo |

**Por qué el Designer arma la pieza y no la publica.** El Designer es un motor de
documentos y a propósito no sabe de red: recibe bytes y devuelve un archivo. Publicar
tiene estados, reintentos, auditoría y secretos; diseñar no tiene nada de eso. Si se
mezclan, cada retoque de diseño toca el código que guarda los tokens de Meta.

**Por qué el Designer y no `@repo/media-composition`.** El otro motor es más liviano y ya
está pensado para redes, pero sus plantillas son objetos de TypeScript: cambiar el diseño
significa tocar código. Como Infospot y las marcas que vengan necesitan su propia
estética, la plantilla tiene que ser un dato, no código. El Designer ya renderiza
documentos con bloques de imagen (con recorte y máscara), texto con variables y QR, y su
cadena PDF → PNG está en producción hoy (diplomas de FotoRank, carnets de fotoffice).

### Flujo completo

```
Fotógrafo termina el álbum
  → elige 3-4 fotos "para redes" + tilda permiso + deja su @usuario
  → (sube fotos, corre el análisis)
album-analysis-readiness dice "listo"
  → se crea UNA solicitud de publicación por álbum (PENDING_APPROVAL, idempotente)
  → render: documento del Designer + datos → PDF → PNG → sharp → JPEG → R2
  → panel /admin/social: se ve la pieza y el texto, se aprueba o se rechaza
  → cron /api/cron/social-publish
  → provider Instagram: carrusel + historia
  → se guardan IDs externos, permalink y registro de auditoría
```

## 5. El módulo de conexión

Es lo único que se construye de cero.

**Método de login: "Instagram Login"**, no Facebook Login. La diferencia importa: *no
exige una página de Facebook vinculada* a la cuenta profesional. Para la cuenta
institucional da igual, pero cuando le toque a 135 socios, pedirles que creen y vinculen
una página de Facebook mataría la adopción.

**Permisos:** `instagram_business_basic` e `instagram_business_content_publish`.

**Piezas:**

- Una ruta que arranca el login y redirige a Meta.
- Una ruta de retorno que intercambia el código por un token de larga duración y guarda
  la cuenta en `DnxSocialAccount` con el token cifrado (el `vault` AES-256-GCM ya existe
  en el paquete).
- Una pantalla en el panel que muestra la cuenta conectada, su estado y desde cuándo, y
  permite desconectarla.

**Renovación de token — no es opcional.** Los tokens de larga duración duran **60 días**.
Se renuevan contra `GET /refresh_access_token` si tienen al menos 24 horas de vida y no
vencieron. Va un cron que renueva toda cuenta a la que le queden menos de 10 días, y que
marca la cuenta como caída si la renovación falla. **Sin esto, la integración funciona dos
meses y después deja de funcionar sola, sin ningún error visible hasta que alguien mira
por qué no salió un post.** Es la forma más común en que estas integraciones se rompen en
producción.

## 6. El permiso y la elección de fotos

En la pantalla donde el fotógrafo configura el álbum en CLF se agrega:

- **Elegir fotos "para redes": mínimo 3, máximo 4.** Selección explícita, no automática.
  Con menos de 3 no se genera nada; a partir de la cuarta el botón queda deshabilitado.
  El orden de selección es el orden en que salen en el carrusel.
- **Tilde de permiso de difusión**, con texto claro sobre qué se va a publicar y dónde.
- **Su usuario de Instagram**, normalizado con `normalizeInstagramHandle` de
  `@repo/media-composition` (ya existe y rechaza entradas inválidas en vez de silenciarlas).
  El usuario vive **en el perfil del fotógrafo**, no en el álbum: se pide una vez y se
  reusa. El **permiso**, en cambio, es **por álbum**: cada álbum se autoriza por separado,
  porque cada uno tiene su propia gente fotografiada.

**Regla dura: sin permiso tildado o sin fotos elegidas, no se genera ninguna solicitud.**
No hay camino alternativo ni propuesta automática en el panel.

Esta regla es la protección de fondo del sistema. Los álbumes de CLF incluyen eventos
escolares y deportivos con menores y con gente identificable que no aceptó aparecer en la
cuenta de Instagram de nadie. El permiso lo tiene que dar quien tiene la relación con las
personas fotografiadas — el fotógrafo —, no el operador del panel, que no sabe quiénes son.

Que el fotógrafo elija resuelve además un problema práctico: las fotos que él elige son
buenas, y una selección automática publicaría lo que haya.

## 7. La pieza

Dos documentos del Designer por marca:

| | Carrusel | Historia |
|---|---|---|
| Medida | 1080×1350 (4:5) | 1080×1920 |
| Huecos de foto | 3 o 4, uno por diapositiva | Las mismas, en un mosaico |
| Texto | En el copy del post | Impreso en la imagen |
| Link al álbum | En el copy | Impreso, **no tocable** |
| Etiqueta de colaborador | Sí | No la permite Meta |

**Variables:** `{{nombreAlbum}}`, `{{fecha}}`, `{{arrobaFotografo}}`, `{{urlAlbum}}`.

**Las fotos van con marca de agua**, las mismas derivadas que ya usa la galería pública.
Publicar el original en alta sería regalar el producto que se está vendiendo.

**El copy** se arma con una plantilla de texto: nombre del álbum, aviso de que las fotos ya
están disponibles en compramelafoto.com, el link, la mención `@fotógrafo` y las etiquetas.

**Cadena de render:** documento del Designer → PDF → PNG → `sharp` → **JPEG**. La
conversión final es obligatoria: **Meta acepta únicamente JPEG** para publicar (ni PNG, ni
WEBP, ni JPEG extendido tipo MPO o JPS). El JPEG resultante sube a R2, que es de donde
Meta lo va a leer: la API exige una URL pública, no acepta subir bytes.

### Sobre el link en la historia

**Meta no permite agregar stickers por API**: ni link, ni mención, ni hashtag, ni música.
La API sube la imagen y nada más. No hay permiso especial que lo habilite; las
herramientas comerciales lo resuelven mandando una notificación al celular para que la
persona termine la historia a mano dentro de Instagram.

Decisión tomada: la historia lleva la dirección **impresa en la imagen**, legible y
grande, más "link en bio". Se acepta que no sea tocable. Si algún álbum amerita el sticker
real, se sube esa historia a mano.

## 8. El motor

Al provider de Instagram de `@repo/social-publisher` se le agrega:

**Carrusel** — tres pasos contra la API: se crea un contenedor por cada foto con
`is_carousel_item=true`, después un contenedor padre con `media_type=CAROUSEL`, la lista
de hijos, el copy y el parámetro `collaborators`, y recién ahí se publica el padre. El
parámetro de colaboradores va **en el contenedor padre, nunca en los hijos** — ponerlo en
los hijos es un error conocido que hace fallar la publicación.

**Historia** — contenedor con `media_type=STORIES` y publicación. Sin copy y sin
colaboradores.

**Colaboradores** — lista de usuarios de Instagram. El fotógrafo **tiene que aceptar la
invitación** desde su celular para que el post aparezca en su perfil; hasta entonces vive
solo en el feed de CompraMeLaFoto. Esto hay que explicárselo al fotógrafo en la pantalla
donde da el permiso, o va a parecer que el sistema no funciona.

**Límite de Meta:** 100 publicaciones por API cada 24 horas por cuenta. Un carrusel cuenta
como una. Con el volumen de álbumes de CLF sobra, pero el motor consulta el límite antes
de publicar y difiere en vez de fallar si se está cerca.

## 9. Cableado en CompraMeLaFoto

- **Disparador:** el mismo punto donde hoy se decide mandar el correo de "las fotos ya
  están disponibles", cuando `album-analysis-readiness` dice que el álbum está analizado.
- **Dos solicitudes por álbum, no una.** El carrusel y la historia son publicaciones
  distintas para Meta (distinto tipo de contenedor, distinto resultado, una puede fallar
  sin la otra), y el modelo de datos tiene una publicación por solicitud. Se crean con
  claves idempotentes `clf:album-carousel:{albumId}` y `clf:album-story:{albumId}`, las
  dos en estado pendiente de aprobación y enlazadas entre sí por `metadata`. Si ya
  existen, no se hace nada.
- **Se aprueban juntas.** El panel las muestra como una sola tarjeta del álbum y aprueba
  las dos con un clic. Se pueden rechazar por separado (por ejemplo, publicar el carrusel
  y descartar la historia), pero el camino normal es uno solo.
- **Soft-fail:** si la creación de la solicitud falla, **no** debe romper el envío del
  correo al cliente. Es el mismo criterio que ya usa Clickatón tras el pago.
- **Cron:** `/api/cron/social-publish` en CLF, autenticado con `CRON_SECRET`, copiando el
  de Clickatón. Cada 5 minutos.
- **Panel:** `/admin/social` en CLF — ver la pieza y el copy, aprobar, rechazar con
  motivo, programar para más tarde, cancelar y reintentar los fallidos.
- **Almacén:** un `prisma-store` propio de CLF, como el que ya existe en
  `apps/clickaton/lib/social-publisher/prisma-store.ts`.

## 10. Variables de entorno

| Variable | Uso |
|---|---|
| `DNX_SOCIAL_VAULT_MASTER_KEY` | Clave de cifrado de tokens (base64, 32 bytes). Ya existe |
| `DNX_SOCIAL_PUBLISHER_LIVE` | `true` para publicar de verdad. Ausente = simulacro |
| `META_APP_ID` / `META_APP_SECRET` | App de Meta para el login |
| `META_OAUTH_REDIRECT_URL` | Ruta de retorno del login |
| `CLF_SOCIAL_ACCOUNT_ID` | Cuenta institucional destino (opcional) |
| `CRON_SECRET` | Autenticación del cron. Ya existe |

## 11. Pruebas

Siguiendo el patrón que ya usa `decideAlbumReadiness`:

- **Decisiones puras, sin base:** si corresponde generar una solicitud (permiso, fotos,
  álbum listo, no duplicada), cómo se arma el copy, cómo se eligen y ordenan las fotos,
  cómo se normaliza el usuario de Instagram.
- **Conversación con Meta:** con un `fetch` falso, como el test que ya existe en
  `packages/social-publisher/src/social-publisher.test.ts`. Se cubren el carrusel de tres
  pasos, la historia, el error de colaboradores en el hijo y el manejo de límite alcanzado.
- **Render:** que la pieza salga en JPEG, con la medida correcta y sin variables sin
  resolver.
- **Renovación de token:** que renueve con menos de 10 días de vida, que no renueve con
  menos de 24 horas, y que marque la cuenta caída si Meta rechaza.

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| El token vence a los 60 días y todo deja de funcionar en silencio | Cron de renovación + estado visible de la cuenta en el panel + registro cuando falla |
| Se publica una foto con un menor o con alguien que no quiere aparecer | El permiso lo da el fotógrafo, foto por foto; sin permiso no se genera nada |
| Se publica algo desafortunado sin que nadie lo mire | Cola de aprobación: nada sale sin un clic humano |
| Meta cambia la API y rompe la publicación | La versión de la API está fija en el cliente; el motor registra el error y reintenta |
| El render pesado (binario nativo) hace fallar el empaquetado | Ya está resuelto en el repo con `serverExternalPackages`; se copia esa configuración |
| El fotógrafo no acepta la invitación de colaboración y cree que falló | Se le explica en la misma pantalla del permiso |

## 13. Decisiones cerradas

1. Publica la **cuenta institucional** de CompraMeLaFoto. Las cuentas de los fotógrafos
   son una etapa posterior (ver punto 14).
2. **Cola de aprobación**, no publicación automática.
3. **Carrusel + historia.** Nada de Reels.
4. **El fotógrafo elige las fotos y da el permiso.** Sin eso no se publica.
5. **La pieza se diseña en el Designer**, no se codea.
6. Todo vive **dentro de CompraMeLaFoto**, con paquetes compartidos. Sin API entre apps,
   sin base compartida.
7. La historia lleva el link **impreso**, no como sticker.

## 14. Fuera de alcance

**Cuentas de Instagram de los fotógrafos.** Publicar desde cuentas que no son propias
requiere **acceso avanzado y revisión de app de Meta**: screencast mostrando el uso,
semanas de espera y rechazo frecuente en el primer intento. El modelo de datos ya lo
soporta (`DnxSocialAccountGrant` existe), así que cuando la revisión pase es cableado, no
rediseño. Además implica renovar tokens de 135 cuentas, no de una.

**Sticker de link tocable en historias.** Meta no lo permite por API. No hay rodeo.

**Videos, Reels y YouTube.** Decisión explícita de dejarlo para después. Nota para esa
etapa: los videos subidos por API desde un proyecto **no auditado por Google quedan
bloqueados como privados**, así que YouTube exige una auditoría de cumplimiento antes de
servir para algo.

**Infospot cableado.** Queda a un paso: montar los paquetes, conectar su cuenta y hacer su
plantilla. No requiere código nuevo del motor.

**Panel social único para toda la suite.** Lo impide la separación de bases. Si algún día
se quiere, se construye encima de esto sin tirar nada.
