# Santa Fe en Foco — ETAPA 01 Diseño público

## Estado

**DONE** (Implementación 01 técnica + Implementación 02 validación visual en navegador real).

Sin persistencia de tema, sin editor visual, sin migración ni deploy. Sin commit/push.

## Alcance

Sistema visual mínimo de concursos públicos FotoRank aplicado a landing e inscripción. Tema Santa Fe en Foco centralizado en código (`ContestVisualTheme`), sin DB.

## Contradicciones de contenido (reportadas, no corregidas)

| # | Tema | Evidencia | Nota |
|---|------|-----------|------|
| 1 | Fechas DB vs config oficial | Landing/cronograma usan fechas de `FotorankContest` en DB; config `santa-fe-en-foco-2026.ts` fija apertura 1 ago 2026 y cierre exclusivo 1 oct 2026 (30 sep inclusive). UI local muestra cierre **1 de octubre de 2026** (fecha DB). | No se “arregla” silencioso. |
| 2 | Bases draft vs bases publicadas | Landing: `contest.rulesText`. Inscripción: `getCurrentPublishedRules`. | Pueden ser versiones distintas. |
| 3 | Formatos de archivo | Draft bases (§12): JPEG/PNG/WebP sin límites reglamentarios. Pipeline upload (`upload-policy.ts`): solo `image/jpeg`, min 1200×800, max 25MB, draftConfig. | Contradicción técnica vs copy de bases. |
| 4 | Carga de fotografías | Landing “Cómo participar” condiciona por `submissionOpensAt`. Confirmación de inscripción ofrece continuar a fotografía; si upload cerrado, aviso en página. | UX coherente solo si fechas DB están bien. |
| 5 | Cantidad de categorías / obras | Config oficial: 4 categorías, 1 obra. UI lista categorías ACTIVE de DB y `maxFiles`. | Depende de seed/DB. |
| 6 | Marcadores legales / IDs técnicos | Título publicado incluye `(sfef-provisional-institutional-v1)`. Posibles `LEGAL REVIEW REQUIRED` / `PENDING_*` en contenido. | Presentación: heading amigable «Bases publicadas»; el ID técnico queda en caption (no se altera el contenido). |
| 7 | Copy hardcode Santa Fe en formulario | Nota “Participación abierta” y `CATEGORY_HINTS` en `InscriptionForm`. | Puede divergir de bases publicadas. |
| 8 | Organizadores institucionales | Config oficial menciona SFPR + Cámara de Senadores. Landing muestra la org de DB (SFPR). | Decisión de producto / datos. |

## Confirmaciones de restricción

- Sin migración de base de datos.
- Sin persistencia de tema visual.
- Sin panel “Estética y diseño”.
- Sin deploy a staging/producción.
- Sin cambios de lógica de negocio, pagos ni habilitación de upload.
- Sin modificación del sentido legal de consentimientos/bases (solo presentación).

---

## Validación visual — Implementación 02

### Entorno

| Ítem | Valor |
|------|--------|
| Proyecto | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| App | `apps/fotorank` |
| Rama | `feat/fotorank-super-admin-09b` |
| Commit base | `43553fb` |
| Comando | `pnpm --filter fotorank dev` |
| URL local | `http://127.0.0.1:3000` |
| Slug | `santa-fe-en-foco` (confirmado) |
| Capturas | `.tmp/fotorank-etapa01-impl02-visual/` (gitignored vía `**/.tmp/`) |
| Script | `apps/fotorank/scripts/visual-capture-etapa01-impl02.mjs` |
| Login fixture | `participante1@fotorank.com` / seed local |

### Resoluciones probadas

**Landing** (`/concursos/santa-fe-en-foco`):

- 1440×1000 viewport + full
- 1280×800 viewport + full
- 768×1024 viewport + full
- 390×844 viewport + full

**Inscripción** (`/concursos/santa-fe-en-foco/inscripcion`, con sesión):

- 1440×1000 viewport + full
- 390×844 viewport + full

Total: **12 PNG** + `capture-report.json`.

### Diagnóstico visual por viewport

| Viewport | Hallazgos |
|----------|-----------|
| 1440 / 1280 | Hero sin imagen con fallback elegante; lectura acotada; resumen en grilla; cronograma compacto; CTAs repetidos sin saturar. |
| 768 | Grilla 2 columnas en resumen; nav completa; ritmo vertical razonable. |
| 390 landing | CTAs apilados a ancho completo; nav sticky con scroll horizontal (sin overflow de página); título mobile más contenido. |
| 1440 / 390 inscripción | Encabezado con eyebrow corto + org en caption; Edad en el mismo bloque que categoría; bases con heading semántico + renderer; CTA primario claro. |

### Defectos encontrados (navegador)

1. Nav «Información» apuntaba a `#sobre` ausente cuando no hay `fullDescription`.
2. Orden de secciones ≠ orden de anclas (organizador demasiado arriba).
3. Resumen con card vaga «Inscripción: Consultá bases».
4. Organizador sin logo mostraba nombre largo en caja (aspecto placeholder).
5. Hero CTAs lado a lado en ~390 px (apretados).
6. Eyebrow de inscripción con org en mayúsculas expandidas (texto largo).
7. Título de bases mostraba ID técnico como H2.
8. Riesgo de anclas tapadas por nav sticky (`scroll-padding` ausente en `html`).
9. Indicador Next.js «N» / overlay de dev (solo local; no producto).

### Correcciones realizadas

- Reordenar secciones y alinear nav a contenido real; ocultar anclas sin sección.
- Resumen: card «Estado» = fase pública (p. ej. Inscripciones abiertas).
- Organizador: iniciales cortas sin logo.
- Hero: CTAs en columna bajo 639 px; título display más contenido en mobile.
- `html:has(.fr-contest-shell) { scroll-padding-top }` para anclas.
- Inscripción: eyebrow «Inscripción» + org en caption; heading «Bases publicadas» + caption con título/versión DB.
- Edad: mismo card que categoría; control angosto intencional (~8rem) alineado al eje izquierdo.
- Cronograma más compacto; cards summary con menos padding; labels sin uppercase forzado.

### Continuación — ETAPA 02 IMPLEMENTACIÓN 01

Ver `docs/fotorank/santa-fe-en-foco-etapa02-impl01.md` y `docs/fotorank/santa-fe-en-foco-visual-assets.md`.
Composición editorial + contrato `ContestVisualPresentation` entregados; assets oficiales siguen pendientes.

### Defectos → ETAPA 02

- Hero/logo/social assets reales del organizador (sin stock ni IA).
- Persistencia de tema + panel «Estética y diseño».
- Unificar `EntryUploadPanel` al sistema `fr-contest-*`.
- Páginas `jurados` / `resultados` públicas aún fuera del shell.
- Indicador visual de scroll en nav sticky mobile (opcional).

### Defectos → decisión de producto

- Mostrar segundo organizador institucional (Cámara de Senadores) vs org única de DB.
- Copy de card de costo/estado vs arancel real.
- Unificar fuente de bases landing vs inscripción.

### Defectos → revisión legal

- Contenido publicado con ID `sfef-provisional-institutional-v1` y avisos de vigencia.
- Posibles marcadores `LEGAL REVIEW REQUIRED` si permanecen en texto publicado.
- Diferencias de fechas/formatos entre bases y pipeline (documentadas; no tocadas).

### Resultado de navegador (última corrida)

- Console errors: **0**
- Page errors: **0**
- Failed requests (≥400, excl. HMR): **0**
- Horizontal overflow de documento: **0**
- `scroll-padding-top`: **64px**
- Formulario de inscripción: presente; Edad width ≈ 128 px
