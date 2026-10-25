# Muestras Fotográficas — Etapa 2: panel, página de cada obra, fichas con QR y perfil del fotógrafo

Fecha: 2026-10-09 · Estado: alcance decidido con Daniel en chat; este documento fija el diseño.
Diseño general: `docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md`.
Plan: `docs/superpowers/plans/2026-10-09-muestras-etapa-2.md`.

> **Numeración.** El diseño general llamaba "etapa 2" a la parte de FOTOFFICE (aprobación por
> institución, blog, portal del socio). Daniel decidió adelantar esto otro; lo de FOTOFFICE pasa a
> ser la etapa siguiente. Esta etapa adelanta además una parte de la etapa 4 (perfil) y de la 6
> (ficha con QR, sin plantillas del diseñador).

## Qué se construye

1. **Panel lateral** para toda persona con sesión, con todas las funcionalidades a la vista.
2. **Página pública de cada obra**: `/m/<muestra>/o/<obra>`.
3. **Fichas de sala con QR en PDF**, una por obra o todas juntas, A6 o A5.
4. **Perfil público del fotógrafo** (`/fotografos/<slug>`) y la página **"Fotógrafos que expusieron"**.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | El panel vive en `app/panel/…` (segmento real, sin grupo de rutas). El encabezado público queda arriba en todo el sitio; el panel agrega la barra lateral debajo. | Mínimo movimiento de archivos: el layout raíz ya pinta encabezado y pie. Un grupo `(publico)` obligaría a mover todas las páginas públicas sin ganar nada visible. |
| D2 | Barra lateral con tres grupos: **Tu cuenta** (Inicio, Mis muestras, Proponer muestra, Mi perfil de fotógrafo), **Para organizar** (Convocatorias, Curaduría, Montaje e impresión, Ventas, Estadísticas) y **Administración** (Revisión, sólo super admin). En el teléfono, cajón que se abre con "Menú". | Daniel quiere todas las funcionalidades visibles. |
| D3 | Las secciones no construidas (Convocatorias, Curaduría, Ventas, Estadísticas) abren `/panel/<sección>`: una página limpia "En preparación" que explica qué va a hacer. Sin marca de "pronto" en la barra. | Mismo criterio que la portada: se publica todo sin cartel de "próximamente"; la explicación está adentro. |
| D4 | `/mis-muestras` → `/panel/muestras`, `/mis-muestras/:id` → `/panel/muestras/:id`, `/admin` → `/panel/revision` (308, permanentes). `/proponer` → `/panel/proponer` (307: es el enlace de difusión y mañana puede ser una página pública). | Los enlaces de correos ya enviados y los favoritos siguen andando. |
| D5 | Encabezado con sesión: "Proponé tu muestra", **"Mi panel"**, "Salir". Sin sesión: "Proponé tu muestra", "Ingresar". En los dos: **"Fotógrafos"**. | "Mis muestras" y "Revisión" pasan al panel. |
| D6 | **Obra oculta = ficha sin foto, no 404.** Mientras la muestra está próxima o abierta en modo "destacadas hasta el cierre", la página de una obra no destacada muestra título, autor, año, técnica y la muestra, **sin la imagen**, con "Esta obra se ve en la sala; la galería completa se publica cuando la muestra cierra", y `noindex`. | El QR de la ficha de sala apunta a la página de la obra y se escanea **justamente durante la muestra, frente a la obra**. Un 404 rompería el QR en el único momento en que se usa. Los datos de texto ya están en la pared; lo que se reserva para la visita es la imagen. |
| D7 | Visibilidad de una obra: se reutiliza `visibleWorks` de la etapa 1 (destacadas, o las primeras 12 si no marcó ninguna). Una obra es **completa** si está en esa lista, **sólo ficha** si no. Sólo actividades `APPROVED`; cancelada sigue visible. | Una sola regla para galería, página de obra y perfil: no pueden contradecirse. |
| D8 | Fichas: **PDF del servidor** con `pdf-lib 1.17.1` + `qrcode ^1.5.4` (versiones del lockfile). Una ficha por página, al tamaño final (A6 105×148 mm o A5 148×210 mm), sin sangrado: fondo blanco. QR vectorial. Helvetica (fuente estándar del PDF) con los textos pasados a WinAnsi. | Una página por ficha es lo que cualquier imprenta acepta. Archivo no está en el lockfile como archivo de fuente y sumar uno es otra decisión; Helvetica es la neutra más cercana. Lo que no entra en WinAnsi (p. ej. "Ł", emojis) sale como "?". |
| D9 | Sólo baja fichas quien propuso la muestra (o el super admin), con la muestra **publicada** y de tipo muestra. | Una ficha con QR a una página que no existe no sirve. |
| D10 | Perfil: tabla nueva `PhotographerProfile`; cada persona tiene **a lo sumo uno** (`userId` único y opcional, sin relación a `User`). El slug se arma solo del nombre y se puede cambiar. | Mismas convenciones que `CulturalActivity`. `userId` opcional deja lista la etapa en que el organizador crea perfiles de autores sin cuenta. |
| D11 | Vincular obra ↔ perfil: en el editor de obras, buscador por nombre ("Vincular a un perfil"). Al **agregar** una obra cuyo autor coincide con el nombre del perfil propio (sin importar mayúsculas, acentos ni espacios), se vincula sola. Si no, queda texto libre. `authorName` se conserva siempre como respaldo. | Simple, y el caso más común (el fotógrafo carga su propia muestra) sale sin tocar nada. |
| D12 | El dueño de un perfil ve en "Mi perfil" las obras vinculadas a él y puede **desvincular** cualquiera ("No es mía"). | Un organizador puede vincular por error (o a propósito) una obra a un perfil ajeno; la última palabra la tiene el dueño del perfil. |
| D13 | Avatar: `/api/imagenes` suma el uso `avatar` (800×800, recorte al centro, WebP 82), bajo `muestras/<userId>/`. | Reutiliza la subida y el control de "imagen propia" de la etapa 1. |
| D14 | "Fotógrafos que expusieron" lista los perfiles con al menos una obra en una actividad publicada. La página de un perfil muestra sus obras por muestra; las que todavía no se ven quedan como "y N obras más para ver en la sala". | El perfil no puede adelantar las fotos que la galería guarda para la visita (D7). |
| D15 | **Las obras conservan su id al editar la muestra.** Hoy cada guardado borra y vuelve a crear las obras (ids nuevos); desde esta etapa se conserva el id de cada obra que ya era de la muestra. | El id está en la URL de la obra y en el QR impreso: sin esto, editar una muestra después de imprimir rompería todas las fichas. |
| D16 | Un perfil se ve en público (`/fotografos/<slug>`) **sólo si tiene al menos una obra en una muestra publicada**; si no, 404. El dueño lo edita igual desde el panel. | Ninguna página pública muestra contenido que no pasó por una muestra revisada (un perfil nuevo podría ser spam). |

## Datos (migración aditiva, a mano)

`20261027120000_muestras_etapa_2_perfiles` (ordena después de `20261026120000_fotoffice_etapa_4_agenda`):

- **`PhotographerProfile`**: `id` (cuid), `userId Int? @unique`, `slug String @unique`,
  `displayName`, `bio?`, `city?`, `province?`, `website?`, `instagram?` (usuario sin "@"),
  `avatarUrl?`, `createdAt`, `updatedAt`. Índice por `displayName`.
- **`CulturalActivityWork.authorProfileId String?`**, con FK a `PhotographerProfile` `ON DELETE SET NULL`, e índice.

Sin enums, sin tocar filas existentes. Se aplica **a mano en producción** (Neon
`divine-hall-10689679`, rama `development`) **con permiso de Daniel**, y se registra en
`_prisma_migrations` con el SHA-256 del archivo. **Antes de publicar el código**: Prisma pide
todas las columnas del modelo, y una columna que falte rompe toda consulta de obras.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/panel` | con sesión | Inicio: muestras por estado, accesos rápidos, "Creá tu perfil" si no tiene; al super admin, cuántas hay para revisar. |
| `/panel/muestras`, `/panel/muestras/[id]` | con sesión (dueño o super admin) | Lo que era "Mis muestras" y su editor. En una publicada: descarga de fichas. |
| `/panel/proponer` | con sesión | Lo que era `/proponer`. |
| `/panel/perfil` | con sesión | Editar el perfil, avatar, obras vinculadas y "No es mía". |
| `/panel/montaje` | con sesión | Fichas de sala de cada muestra publicada propia (todas o una por obra, A6/A5) + qué más llega (marcos, plano, catálogo). |
| `/panel/[seccion]` | con sesión | "En preparación" para convocatorias, curaduría, ventas, estadísticas. Cualquier otra → 404. |
| `/panel/revision` | super admin | Lo que era `/admin`. |
| `/api/fichas/[id]?tamano=A6\|A5&obra=<id>` | dueño o super admin | PDF de fichas. |
| `/m/[slug]/o/[workId]` | público | Página de la obra (D6). |
| `/fotografos`, `/fotografos/[slug]` | público | Índice y perfil. |

## Permisos (todo del lado del servidor)

- Cada página del panel llama `requireUsuario`/`requireSuperAdmin` por su cuenta (el layout no alcanza: no se vuelve a ejecutar en cada navegación).
- Acciones: `guardarPerfil` (sólo el propio), `desvincularObra` (sólo obras vinculadas al perfil propio), `buscarPerfiles` (con sesión y con freno), `guardarBorrador` (ignora `authorProfileId` que no existan).
- Fichas: dueño o super admin, `APPROVED`, tipo `MUESTRA`.
- Páginas públicas: sólo `APPROVED`; visibilidad por D7. Sin palabras de revisión o aprobación.

## Reglas puras nuevas en `packages/muestras` (con tests)

`panel.ts` (secciones por rol, sección activa, resumen por estado), `work-access.ts` (completa / sólo ficha / no existe; URL pública de la obra), `profile.ts` (slug del perfil, palabras reservadas, Instagram, sitio web, comparación de nombres, vínculo por defecto, obras visibles de un perfil).

## Riesgos

- **Columna sin aplicar** rompe todas las consultas de obras: la migración va antes del deploy.
- **QR largo** (dominio + slug de hasta 67 caracteres + id): en A6 el QR mide 32 mm, con módulos de ~0,7 mm; se lee bien con un teléfono. Probar impreso antes de mandar a imprenta.
- **Caché de 5 minutos** en páginas públicas: al cerrar una muestra, las fotos tardan hasta 5 minutos en aparecer. Igual que la ficha de la etapa 1.
- **Vínculo indebido** a un perfil ajeno: mitigado por la revisión previa de la muestra y por D12.
- **Caracteres fuera de WinAnsi** en las fichas: salen como "?". Si molesta, incrustar Archivo con `@pdf-lib/fontkit 1.1.1` (ya en el lockfile) es una mejora acotada.

## Fuera de alcance

Perfiles creados por el organizador para autores sin cuenta y el "reclamar perfil"; plantillas del diseñador para marcos y fichas; convocatorias, curaduría, ventas y estadísticas (sólo su página explicativa); la parte de FOTOFFICE del diseño general.
