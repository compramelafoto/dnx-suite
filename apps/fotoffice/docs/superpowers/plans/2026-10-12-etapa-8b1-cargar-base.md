# Etapa 8B-1 · Traducir y cargar: estructura, simulación y datos base — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** el motor de carga desde los datos crudos de Alboom (`FotofficeAlboomCrudo`, Etapa 8A en producción) a las tablas
de FOTOFFICE, con **simulación** obligatoria antes de cargar, mapa de identificadores para no duplicar nunca, informe, y
los traductores de los datos base bien documentados. Pedidos, cobros, contratos, proyectos, citas y finanzas quedan para
8B-2, con los datos reales a la vista.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-12-etapa-8-migracion-design.md` (8B). Documentos de Alboom:
`apps/fotoffice/docs/alboom/0{1..5}-*.md`, `09-configuracion-real-dnx.md`, mapa general §5 (equivalencias).

## Global Constraints

- **Rama y worktree:** `feat/fotoffice-etapa-8b-alboom-cargar` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`. Disco limitado: borrar `apps/fotoffice/.next` después de compilar.
- **Sin dependencias nuevas.**
- **Base de datos:** migración `packages/db/prisma/migrations/20261106120000_fotoffice_etapa_8b_alboom_carga/migration.sql`
  (verificar nombre libre); **sólo tablas nuevas** (no se agregan columnas a tablas existentes):
  - `FotofficeAlboomMapa`: workspaceId (CASCADE), entity, alboomId, targetType (texto: CLIENT, PRODUCT, …),
    targetId, payloadHash (huella del crudo con que se cargó), loadedAt, updatedAt; único
    `(workspaceId, entity, alboomId)`; índice `(workspaceId, targetType, targetId)`.
  - `FotofficeAlboomCarga`: workspaceId (CASCADE), mode (CHECK `SIMULACION|CARGA`), status (CHECK
    `PENDIENTE|CORRIENDO|LISTA|ERROR|CANCELADA`), entities JSONB (cuáles), report JSONB (por entidad: crear,
    actualizar, iguales, omitidos con motivo, conflictos, errores; con ejemplos SIN datos personales — sólo ids de
    Alboom), startedByUserId?, startedAt, finishedAt?, errorReason?, lockedUntil?, updatedAt; una activa por workspace.
  - prueba de fuente; no se aplica en la rama; documento `packages/db/docs/MIGRACION-ETAPA-8B1.md` con checksum.
- **Motor (`lib/alboom/carga/`):**
  - cada traductor es una función **pura** `traducir(crudo, contexto) → { accion: CREAR|ACTUALIZAR|IGUAL|OMITIR, datos, motivo? }`
    más un escritor que aplica en la base; el contexto trae los mapas ya cargados (p. ej. contacto por id de Alboom);
  - **simulación**: corre todo sin escribir y guarda el informe; **carga**: sólo se habilita si hay una simulación
    LISTA con la misma huella de datos crudos (si los crudos cambiaron, hay que simular de nuevo);
  - idempotente: el mapa decide; si el crudo no cambió (misma huella) → IGUAL; si cambió → ACTUALIZAR sólo los campos
    que vienen de Alboom (nunca pisar lo que se editó en FOTOFFICE después de la carga: comparar con lo último cargado);
  - en tandas por el cron `/api/cron/alboom-carga` (5 min, presupuesto 270 s), retomable, con turno (`lockedUntil`);
  - orden de dependencias; un error en un registro no frena la entidad: queda en el informe.
- **Traductores de 8B-1:**
  1. **usuarios** → **no se crean usuarios**: se emparejan por correo con los miembros del workspace (para dueño
     de oportunidades/pedidos en 8B-2); sin pareja → `OMITIR` con motivo (se informa).
  2. **orígenes** → `FotofficeOrigen` (por nombre, sin duplicar con los existentes).
  3. **categorías de consulta** (`lead_type`) → `FotofficeConsultaCategoria` con grupo; **unificar nombres en
     portugués** (`15 anos` → "Fiesta 15 Años", `Casamento` → "Boda", `Ensaio` → "Sesión de Fotos", `Aniversário` →
     "Cumpleaños", `Família` → "Familia", `Pré Casamento` → "Pre Boda") y emparejar con las 21 categorías que ya tiene DNX.
  4. **etiquetas** → etiquetas de FOTOFFICE (`FotofficeTag…`, mirar el modelo real) para contactos.
  5. **embudos y etapas** (`lead_stage`) y **flujos de proyecto** (`stage`) → **emparejar** con los circuitos y etapas
     que ya existen en DNX (sembrados en 0.4: 4 embudos + 17 flujos) **por nombre normalizado**; lo que no empareja se
     informa (no se crea en 8B-1); guardar el mapa posición→etapa (Alboom guarda etapas por posición).
  6. **productos y combos** → `Product` + `FotofficeProductoCatalogo` (precio, categoría, combos como en Etapa 2);
     emparejar por nombre con los existentes; costos-plantilla si el modelo de la Etapa 3 los admite.
  7. **contactos** → `Client`: normalizar correo (minúsculas, sin espacios) y teléfono (dígitos, prefijo AR);
     **emparejar con contactos existentes** por correo, después por teléfono; si empareja, completar sólo campos vacíos;
     si no, crear; descartar datos de prueba evidentes (correos `usuario@`, `test@`, nombres "prueba"/"test") con motivo;
     duplicados dentro de Alboom (mismo correo) → uno solo y el informe lista los fusionados; guardar el id de Alboom
     en el mapa; documento y domicilio si vienen.
- **Pantalla:** en Configuración → Migración desde Alboom, sección **"Cargar en FOTOFFICE"**: elegir entidades (por
  omisión todas las de 8B-1), "Simular", ver el informe (tabla por entidad con crear/actualizar/iguales/omitidos/conflictos y
  motivos agregados), "Cargar" (sólo con simulación vigente, con confirmación), avance y resultado; sólo dueño/administrador.
- **Privacidad:** el informe guarda cantidades, motivos e ids de Alboom, nunca nombres, correos ni teléfonos.
- **Textos:** español rioplatense; nunca "plata".
- **Verificación:** vitest completo (traductores puros con crudos de ejemplo armados a partir de los documentos y de los
  fixtures de `origin/feat/fotoffice-asistente-ventas:apps/fotoffice/lib/sales-assistant/alboom/fixtures/*.json`;
  idempotencia; no pisar ediciones; simulación sin escrituras; aislamiento); tsc con 8 GB (código de salida y salida);
  prisma validate/generate; `next build --webpack` en limpio y `rm -rf apps/fotoffice/.next`; ningún componente de
  cliente importa `server-only`/`node:*`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: Todo 8B-1
- [ ] Commit(s) `Migración desde Alboom: simular y cargar los datos base (SQL sin aplicar)`.
