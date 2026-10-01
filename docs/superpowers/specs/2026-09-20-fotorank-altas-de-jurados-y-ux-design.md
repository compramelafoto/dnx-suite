# FotoRank — Altas de jurados por cuenta propia y limpieza de la UX administrativa

**Fecha:** 2026-09-20
**App:** `apps/fotorank`
**Rama de trabajo:** `feat/jurado-unico-dos-plataformas` (PR #202 a `main`)
**Base de producción:** proyecto Neon `divine-hall-10689679`, rama `development`
**Bases afectadas por la migración:** las 5 del schema compartido

**Complementa:** `2026-09-19-fotorank-bolsa-de-jurados-design.md`, que diseñó las etapas
0 a 3 de la bolsa de jurados. Esta especificación conserva sus decisiones, agrega los
defectos que encontró la auditoría del 2026-09-20 y suma el rediseño de la UX
administrativa, que aquel documento no cubría.

---

## 1. Qué se auditó y qué se encontró

El módulo de jurados está construido casi entero y nunca se usó. Estado de producción,
consultado el 2026-09-20 contra la rama `development`:

```
cuentas de jurado ......... 0
perfiles .................. 0
asignaciones .............. 0
votos ..................... 0
invitaciones .............. 1  (sin aceptar)
concursos ................. 7
```

### 1.1 Lo que ya funciona

| Pieza | Dónde |
|---|---|
| Cuenta de jurado con login propio y sesión | `/jurado/login`, `app/lib/judge-auth.ts` |
| Alta a mano por el organizador | `/jurados/nuevo`, `app/actions/judges.ts:324` |
| Invitación por token con vencimiento y reenvío | `/jurados/invitaciones`, `app/actions/judges.ts:806` |
| Panel del jurado con sus asignaciones | `/jurado/panel` |
| Perfil profesional editable por el jurado | `/jurado/perfil`, `app/actions/judgeProfessionalProfile.ts` |
| Página pública individual | `/jurados/publico/<slug>` |
| Página de jurados del concurso | `/concursos/<slug>/jurados` |
| **Sección "Jurado" en la landing del concurso** | `ContestPublicLanding.tsx:455`, ancla `#jurado` |
| Directorio con filtros y propuestas | `/jurados/directorio`, `app/lib/fotorank/judges/professionalDirectory.ts` |
| Asignaciones, votos, conflictos, auditoría, rúbricas | completo |

La sección de jurados por concurso **ya existe**: muestra sólo a los jurados con
asignación `ACCEPTED`, `IN_PROGRESS`, `COMPLETED` o `EXTENDED` —es decir, confirmados—,
respeta a quien tiene el perfil público apagado, y tiene su propio ítem en el menú de
navegación del concurso. Nunca se vio porque sólo se renderiza con al menos un jurado.

### 1.2 Los siete defectos

1. **No existe el autoalta.** `/jurado/register` exige un token de invitación.
2. **El registro por invitación exige una asignación previa.**
   `registerJudgeFromInvitation` (`app/actions/judges.ts:1077`) rechaza el alta si no hay
   una asignación en `ASSIGNED` o `INVITATION_SENT`, con un mensaje que nombra esos
   estados. Un jurado invitado antes de ser asignado no puede registrarse y no entiende
   por qué.
3. **La foto no sobrevive un despliegue.** Se guarda en `public/uploads/judges`
   (`app/lib/fotorank/judges/judgeAvatarStorage.ts:44`). En Vercel ese disco se borra. El
   propio archivo lo advierte.
4. **El jurado no puede subir su propia foto.** `uploadJudgeAvatarImage` exige sesión de
   organizador (`app/actions/judges.ts:117`).
5. **El jurado no puede cargar sus URL ni su teléfono.**
   `judgeUpdateProfessionalProfileAction` no incluye `website`, `instagram`,
   `otherLinksJson` ni `phone`. Sólo el organizador puede cargarlos, con
   `updateJudgeProfileByAdmin`. La página pública sí los muestra.
6. **La página pública ignora los interruptores de privacidad.**
   `getJudgePublicProfile` (`app/actions/judges.ts:1618`) devuelve `website`,
   `instagram`, `city` y `country` sin mirar `showWebsitePublicly`,
   `showInstagramPublicly` ni `showLocationPublicly`. El directorio sí los respeta
   (`professionalDirectory.ts:264-268`); la página pública individual, no.
7. **Cuatro estadísticas se muestran y nadie las escribe.**
   `completedJuryAssignmentsCount`, `responseRate`, `avgResponseTimeHours` y
   `completionScore` se leen en la ficha del directorio y ningún código del repositorio
   les asigna valor.

## 2. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Base de trabajo | Fusionar primero el jurado único (PR #202), construir encima |
| Moderación del autoalta | El postulante espera el visto bueno de DNX para ser visible |
| Alcance del rediseño de UX | Sólo las pantallas de jurados y usuarios |
| Primera entrega | Alta, perfil completo y sección en el concurso. Sin CV ni estadísticas |

## 3. Lo que queda afuera de esta entrega

- **El CV en PDF** con sus tres visibilidades (etapa 2 del documento del 19/9).
- **Las estadísticas verificables** y el criterio del sello (etapas 3 y 9 del mismo).
- El cobro del honorario, que tiene especificación propia.
- El rediseño de cualquier pantalla de concurso, pública o administrativa.

Los cuatro campos muertos del defecto 7 **no se borran todavía**: se ocultan de la
pantalla. El `DROP` de columnas va junto con las estadísticas calculadas, para no dejar
la ficha sin nada que mostrar en el medio.

## 4. Etapa A — Cimientos

### 4.1 La foto va al bucket privado

Se reemplaza `judgeAvatarStorage.ts` (disco local) por `judgeAssetStorage.ts`, que delega
en el proveedor unificado que FotoRank ya usa —`getPrivateContestStorageProvider()`, con
`putObject`, `getSignedUrl`, `deleteObject` y `streamObject`, con implementación local
para desarrollo y R2 en la nube—. **No se crea un bucket nuevo ni se toca CORS.**

Clave de almacenamiento:

```
fotorank/judges/<judgeAccountId>/avatar/<hash>.<ext>
```

La foto se sirve por `/api/jurados/avatar/<judgeProfileId>/<hash>` con cache larga: el
hash del contenido va en la ruta, así que al cambiar la foto cambia la URL y ningún
navegador se queda con la anterior. `avatarUrl` pasa a guardar la clave del bucket, no
una URL; la pantalla arma la ruta a partir de ella. Tope de 2 MB y formatos JPEG, PNG y
WebP, como hoy.

**No hay datos que migrar:** hay 0 perfiles, así que no existe ningún avatar viejo en
disco. Las pantallas que hoy leen `avatarUrl` como URL directa pasan por un helper único
`judgeAvatarSrc(profile)`, que devuelve la ruta servida o `null`.

### 4.2 El jurado sube su propia foto

Nueva acción `judgeUploadOwnAvatarAction` con `requireJudgeAuth()`. La acción del
organizador se conserva: los dos caminos de alta siguen existiendo.

### 4.3 El registro por invitación deja de exigir una asignación previa

Aceptar la invitación crea la cuenta, el perfil y la membresía de la organización. Si hay
asignaciones pendientes, las pasa a `ACCEPTED` como hoy. **Si no las hay, el alta igual
se completa** y el panel del jurado dice, en castellano, que todavía no le asignaron
ninguna categoría. La invitación se marca `ACCEPTED` en los dos casos.

## 5. Etapa B — El alta por cuenta propia

### 5.1 La ruta

`/jurados/postulacion` — pública, sin token, compartible.

**Obligatorio:** nombre, apellido, email, contraseña de 8 caracteres o más, ciudad, país,
titular profesional, bio corta de 120 caracteres o más, al menos una especialidad, años
de experiencia, y aceptación de los términos y del tratamiento de datos.

**Opcional:** teléfono, idiomas, región, web, Instagram, portfolio, otros links, foto,
disponibilidad y tarifa con su modalidad.

El formulario dice, con esas palabras, que **el directorio es común a todos los
organizadores de FotoRank**, no de una sola institución.

### 5.2 Verificación del email

Token de un solo uso, 48 horas de vida, guardado con hash — el mismo patrón que
`FotorankJudgeInvitation.tokenHash`. Sin email verificado el perfil **no entra a la cola
de revisión**, y el jurado ve en su panel qué le falta.

### 5.3 Defensa contra el abuso

- Tope de 5 altas por IP por día.
- Campo trampa invisible y tiempo mínimo de llenado del formulario (3 segundos).
- Si el email ya existe: mensaje neutro que **no revela** si hay cuenta, y aviso al dueño
  real de la casilla.

### 5.4 Las cuatro puertas, separadas

Ninguna implica otra:

| Puerta | Campo | Significa |
|---|---|---|
| Puede entrar | `accountStatus` | Tiene login y puede editar su perfil |
| Está en la lista | `isListedInProfessionalDirectory` + estado de revisión | Aparece en el directorio |
| Tiene página pública | `isPublic` | Existe `/jurados/publico/<slug>` |
| Está verificado | `isVerifiedByPlatform` | DNX respalda su trayectoria (fuera de esta entrega) |

Transiciones:

```
autoalta          → accountStatus ACTIVE
                    emailVerifiedAt null
                    directoryReviewStatus PENDING
                    isListedInProfessionalDirectory false
                    isPublic false
verifica el email → entra a la cola de revisión
aprobación        → directoryReviewStatus APPROVED
                    isPublic true
                    isListedInProfessionalDirectory = wantsDirectoryListing
rechazo           → directoryReviewStatus REJECTED + motivo obligatorio
                    puede corregir y volver a pedir revisión (vuelve a PENDING)
```

El jurado **puede entrar y trabajar en su ficha desde el minuto cero**. Lo único que
espera la aprobación es la visibilidad. Un alta creada por un organizador nace
`APPROVED`: ese organizador ya respondió por esa persona.

**Consecuencia sobre el autoservicio actual:** hoy cualquiera con cuenta puede marcar
`isListedInProfessionalDirectory` en su perfil y quedar listado sin que nadie lo revise.
A partir de esta etapa esa casilla escribe `wantsDirectoryListing`, no el listado real.
El listado real sólo lo escribe la aprobación.

### 5.5 Campos nuevos en la base

Dos enums nuevos:

```prisma
enum FotorankJudgeDirectoryReviewStatus { PENDING APPROVED REJECTED }
enum FotorankJudgeSignupSource { ORGANIZER_CREATED ORGANIZER_INVITATION PUBLIC_SIGNUP }
```

En `FotorankJudgeAccount`:

- `emailVerifiedAt DateTime?`
- `emailVerificationTokenHash String?`
- `emailVerificationExpiresAt DateTime?`

En `FotorankJudgeProfile`:

- `signupSource FotorankJudgeSignupSource @default(ORGANIZER_CREATED)`
- `directoryReviewStatus FotorankJudgeDirectoryReviewStatus @default(PENDING)`
- `directoryReviewedAt DateTime?`
- `directoryReviewedByUserId Int?`
- `directoryReviewNotes String?`
- `wantsDirectoryListing Boolean @default(false)`

Y un cambio aparte: `FotorankJudgeAuditEvent.organizationId` es obligatorio, y un alta
pública **no tiene organización**. Pasa a `String?` para poder auditar los hechos de
plataforma. Los eventos que hoy existen siguen llevando su organización.

El enum `FotorankJudgeCvVisibility` y las columnas del CV **no entran en esta migración**:
van con la etapa del CV.

### 5.6 Moderación en Super Admin

Ruta `/super-admin/jurados`, con el gate que ya existe (`globalRole === "SUPER_ADMIN"`,
`app/lib/auth.ts:123`).

La cola de pendientes muestra la ficha completa: foto, titular, bio, especialidades,
años, links y desde dónde se dio de alta. Tres acciones: **aprobar**, **rechazar con
motivo obligatorio**, **suspender la cuenta**. Cada una deja evento en
`FotorankJudgeAuditEvent` (`JUDGE_PUBLIC_SIGNUP`, `JUDGE_DIRECTORY_APPROVED`,
`JUDGE_DIRECTORY_REJECTED`) y dispara correo al jurado por el outbox que ya existe
(`app/lib/fotorank/notifications/outbox.ts`, Resend directo), con dos tipos nuevos:
`JUDGE_SIGNUP_VERIFY_EMAIL` y `JUDGE_DIRECTORY_REVIEWED`.

Aprueba DNX, no cada organizador, porque la lista es común a toda la plataforma.

La cola lleva su contador a la vista en Super Admin: un directorio abierto cuya cola
nadie atiende deja la lista vacía y el enlace público pierde sentido.

## 6. Etapa C — El perfil completo y la privacidad

### 6.1 Los campos que faltan

`judgeUpdateProfessionalProfileAction` suma `website`, `instagram`, `otherLinksJson` y
`phone`. El formulario de `/jurado/perfil` suma esos campos, con los otros links como
lista de pares nombre + URL.

Validación: las URL exigen `http://` o `https://`; Instagram acepta el usuario con o sin
`@` y se normaliza; el teléfono se guarda como texto libre y **no se muestra nunca en
público**, sólo a los organizadores.

### 6.2 La página pública respeta lo que el jurado eligió

`getJudgePublicProfile` deja de devolver los campos apagados:

| Campo | Condición |
|---|---|
| `website` | `showWebsitePublicly` |
| `instagram` | `showInstagramPublicly` |
| `city`, `country` | `showLocationPublicly` |
| `phone` | nunca |

Se resuelve en la consulta, no en la pantalla: un dato que no se puede mostrar no sale de
la capa de datos.

## 7. Etapa D — Los jurados en cada concurso

La sección existente se conserva y se le da presencia:

- Retrato redondo más grande, nombre, y **titular profesional** debajo (hoy sólo muestra
  la bio corta).
- **Carrusel cuando hay más de seis jurados.** Con seis o menos, la grilla existente se
  ve mejor que un slide. El carrusel se navega con teclado y no depende de JavaScript
  para mostrar el contenido: sin JS, es una lista con scroll horizontal.
- Se conservan el "Ver todos" hacia `/concursos/<slug>/jurados` y el ítem en el menú.
- La regla de qué jurados aparecen **no cambia**: confirmados y con perfil público.

No se toca ninguna otra sección de la landing ni ninguna pantalla de concurso.

## 8. Etapa E — La UX de jurados y usuarios

**Criterio único: ninguna pantalla muestra palabras de la base de datos.**

### 8.1 Un módulo de presentación, no parches por pantalla

Se crea `app/lib/fotorank/judges/ui/judgePresentation.ts` con las funciones que traducen
estado a palabras y tono. Es el mismo patrón que Clickatón ya usa
(`lib/admin-registration/ui/admin-status-presentation.ts`) y que tiene pruebas propias.
Ninguna pantalla imprime un enum directamente.

| Hoy | Va a decir |
|---|---|
| `ACTIVE` / `SUSPENDED` / `INVITED` | Activo · Suspendido · Invitado |
| `PENDING` / `APPROVED` / `REJECTED` | En revisión · Aprobado · Rechazado |
| `ASSIGNED` / `INVITATION_SENT` / `IN_PROGRESS` | Asignado · Invitación enviada · Evaluando |
| `Último acceso: 19/9/2026, 14:32:07` | Entró hace 2 días |
| `No hay asignaciones pendientes (ASSIGNED o INVITATION_SENT)…` | Todavía no te asignaron a ninguna categoría. Escribile al organizador. |

### 8.2 Las pantallas

Alcance cerrado, once pantallas:

1. `/jurados` — lista de jurados de la organización
2. `/jurados/nuevo` — alta a mano
3. `/jurados/<id>/editar` — ficha del organizador
4. `/jurados/directorio` — directorio con filtros
5. `/jurados/directorio/<id>` — ficha profesional
6. `/jurados/directorio/invitaciones` — propuestas enviadas
7. `/jurados/invitaciones` — invitaciones a concurso
8. `/jurados/asignaciones` — asignaciones por concurso
9. `/jurados/auditoria` — registro de hechos
10. `/super-admin/jurados` — la cola de revisión (nueva, etapa B)
11. `/super-admin`, **sólo su sección `#usuarios`** (línea 166 de
    `app/(home)/super-admin/page.tsx`). Es una página única con secciones; las de
    Organizaciones, Concursos, Configuración global y Logs **no se tocan**.

Reglas que se aplican a todas:

- **Una tarjeta por persona**, con foto, nombre, titular y estado. El email en segunda
  línea, no como título.
- **Los identificadores desaparecen de la vista.** Ningún `cuid` a la vista; donde haga
  falta para soporte, va detrás de un botón de copiar.
- **Fechas en lenguaje humano** ("hace 2 días"), con la fecha exacta en el `title` del
  elemento.
- **Cada pantalla vacía dice qué hacer**, no sólo que está vacía.
- **Los filtros se agrupan** en una barra, con el conteo de resultados al lado.
- Se quitan de la pantalla las cuatro estadísticas que nadie escribe.

### 8.3 Lo que no cambia

Las rutas, los permisos y el comportamiento. Es un cambio de presentación: si una
pantalla hoy hace algo, después lo sigue haciendo igual.

## 9. Migración

Una sola migración SQL con los dos enums nuevos, las columnas nuevas en cuenta y perfil, y
el paso de `FotorankJudgeAuditEvent.organizationId` a nulo.

**Las filas que ya existan quedan en `APPROVED` y con `signupSource` =
`ORGANIZER_CREATED`.** En la base de FotoRank hay 0 perfiles, pero las otras cuatro bases
comparten el schema y no se verificaron una por una: si en alguna hubiera un perfil
cargado, dejarlo `PENDING` lo haría desaparecer del directorio sin que nadie entienda por
qué.

Se aplica **a mano en las 5 bases Neon del schema compartido** y se registra en
`_prisma_migrations` con el checksum de una base sana. El despliegue no corre
`prisma migrate deploy`.

## 10. Pruebas

Se implementa con TDD: primero la prueba, después el código.

**Unitarias**

- Transiciones del estado de revisión, incluidos el rechazo y el segundo pedido.
- Validación del formulario público: campos obligatorios, largo mínimo de la bio, email
  repetido, campo trampa, tiempo mínimo.
- Verificación del email: token usado dos veces, token vencido, token de otro.
- Armado de claves de almacenamiento de la foto y borrado de la anterior al reemplazar.
- Regla de privacidad de la página pública, con los cuatro interruptores en las dos
  posiciones.
- Normalización de URL e Instagram.
- El módulo de presentación: cada enum tiene su texto en castellano, y un valor
  desconocido no rompe la pantalla.
- Registro por invitación sin asignaciones pendientes: el alta se completa.

**De punta a punta (Playwright)**

1. Autoalta → correo de verificación → el perfil **no** aparece en el directorio →
   aprobación en Super Admin → aparece.
2. Rechazo con motivo: el jurado lo ve, corrige y vuelve a pedir revisión.
3. El jurado sube su foto y carga su web e Instagram; apaga "mostrar mi web" y la página
   pública deja de mostrarla.
4. Un concurso con jurados confirmados muestra la sección en su landing, y con más de
   seis aparece el carrusel.

## 11. Riesgos

- **Datos personales.** El teléfono y el email son datos sensibles. Cuando el jurado borra
  su cuenta, la foto se borra del bucket de verdad, no sólo la fila.
- **El directorio es común a toda la plataforma.** Un organizador de cualquier workspace
  ve a todos los jurados aprobados. Es deliberado y es lo que hace que la bolsa sirva,
  pero tiene que estar dicho en el formulario de alta.
- **La migración toca 5 bases a mano.** Si se aplica en una sola, las escrituras de las
  otras aplicaciones se rompen.
- **La cola de revisión es un compromiso.** Si nadie la atiende, el enlace público no
  sirve para nada.
- **El rediseño toca pantallas que hoy nadie usa.** Con 0 jurados no hay forma de ver una
  regresión mirando producción: las pruebas son la única red.

## 12. Orden de implementación

```
Paso 0   fusionar el jurado único (PR #202)          ← hecho, esperando revisión
Etapa A  cimientos: foto al bucket, foto propia, arreglo del registro
Etapa B  alta pública + verificación de email + cola de moderación
Etapa C  perfil completo (URL, teléfono) + privacidad de la página pública
Etapa D  los jurados en el concurso
Etapa E  limpieza de la UX de jurados y usuarios
```

La etapa A va primera y sola: mientras la foto se guarde en el disco del servidor, todo lo
que se construya arriba se rompe en el primer despliegue. La etapa E puede hacerse en
paralelo a B, C y D porque toca pantallas distintas.
