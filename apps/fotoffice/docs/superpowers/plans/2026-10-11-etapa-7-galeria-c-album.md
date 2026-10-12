# Etapa 7 · Galería · Entrega C (Aprobación de álbum) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** galería de aprobación de álbum: láminas por rondas, comentarios marcados en un punto, aprobar o pedir
cambios, revisión del estudio.

**Architecture:** sobre A1/A2/B (en producción, PR 484, 505, 507): `lib/galerias/*`, ficha del estudio, página
pública. Las láminas son filas de `FotofficeGaleriaFoto` (mismo pipeline de subida y `sharp`) con ronda.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-10-etapa-7-galeria-design.md` §6.

## Global Constraints

- **Rama y worktree:** `feat/fotoffice-etapa-7-galeria-album` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Sin dependencias nuevas.**
- **Base de datos:** migración `packages/db/prisma/migrations/20261104120000_fotoffice_etapa_7_galeria_album/migration.sql`
  (verificar que el nombre completo no exista); sólo tablas `FotofficeGaleria*` y nuevas; prueba de fuente; no
  se aplica en la rama; documento `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-C.md` con checksum.
  - CHECK de `FotofficeGaleria.kind` pasa a `SELECCION|ENTREGA|ALBUM` (DROP + ADD con el mismo nombre de
    restricción que tenga hoy; verificarlo en la migración A1).
  - **Nueva** `FotofficeGaleriaRonda`: workspaceId (CASCADE), galeriaId (CASCADE), number INT (≥ 1), status
    (CHECK `ABIERTA|CERRADA`), note TEXT? (≤ 2000, nota del estudio para el cliente), createdByUserId?, createdAt,
    closedAt?; único `(galeriaId, number)`.
  - `FotofficeGaleriaFoto` suma `rondaId` TEXT? (FK a la ronda, CASCADE); índice `(rondaId, order)`.
  - `FotofficeGaleriaComentario` suma `rondaId` TEXT? (FK SET NULL), `pinX` y `pinY` DOUBLE PRECISION?
    (CHECK ambos nulos o ambos entre 0 y 1), `pinNumber` INT?.
  - **Nueva** `FotofficeGaleriaDecision`: workspaceId (CASCADE), galeriaClienteId (CASCADE), rondaId (CASCADE),
    decision (CHECK `APROBADO|CAMBIOS`), message TEXT? (≤ 2000), createdAt; único `(galeriaClienteId, rondaId)`.
- **Reglas:**
  - crear galería de álbum desde el Proyecto ("Nueva prueba de álbum"); se crea con la **ronda 1 ABIERTA**;
  - las láminas se suben con el uploader existente (JPG/PNG ≤ 50 MB) a la ronda abierta; tope 300 láminas por
    ronda; orden por nombre o manual como siempre;
  - publicar exige láminas `LISTA` en la ronda abierta;
  - **abrir ronda nueva:** sólo si la anterior tiene al menos una decisión o el estudio lo fuerza; cierra la
    anterior; puede **copiar** láminas de la ronda anterior (copia de objetos en R2 con `CopyObject`, filas nuevas)
    y luego reemplazar/borrar/sumar; los clientes vuelven a `EN_PROGRESO`; correo `GALERIA_ALBUM_RONDA` (o
    reutilizar el de envío con texto de álbum) con la nota;
  - **cliente:** comentar sólo en la ronda abierta y en `EN_PROGRESO`; pin con `x,y` relativos (0–1) a la imagen
    mostrada, numerado por lámina y cliente; decisión con escritura condicional `EN_PROGRESO → EN_REVISION`,
    `CAMBIOS` exige mensaje o al menos un comentario en la ronda; correo al estudio con la decisión;
  - las rondas cerradas se ven en sólo lectura (cliente y estudio);
  - `ALBUM` no tiene venta ni selección ni "Recibir todo" (descarga según `downloadMode`, por omisión NINGUNA).
- **Estudio:** pestaña de láminas por ronda (selector de ronda), revisión por cliente con las láminas y los
  pines dibujados encima, lista de comentarios por lámina con "Responder", decisión y mensaje, "Abrir ronda
  nueva", "Finalizar" (sólo con `APROBADO`), historial.
- **Seguridad:** todo por `workspaceId`; acciones públicas atadas al token; pines validados (0–1, números
  finitos); topes de comentarios (300 por cliente y ronda).
- **Textos:** español rioplatense; nunca "plata".
- **Verificación:** vitest completo; tsc con `NODE_OPTIONS=--max-old-space-size=8192` (código de salida y
  salida); prisma validate/generate; **`next build --webpack` en limpio** y `rm -rf apps/fotoffice/.next`; revisar
  que ningún componente `"use client"` importe (directo o indirecto) módulos que usen `node:*` o `server-only`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Datos, rondas y estudio
**Files:** schema, migración y prueba de fuente; `lib/galerias/rondas.ts` y cambios en `galerias.ts`/`fotos.ts`; crear álbum desde el Proyecto; pestaña de láminas por ronda; abrir ronda nueva con copia; pruebas.
- [ ] Commit `Galería: pruebas de álbum por rondas (SQL sin aplicar)`.

### Task 2: El cliente aprueba o pide cambios
**Files:** página pública en modo álbum (`components/galeria-publica/*`), acciones públicas (pin, comentario, decisión), correos; pruebas.
- [ ] Commit `Galería: el cliente comenta en la lámina y aprueba el álbum`.

### Task 3: Revisión del estudio y documento
**Files:** revisión por cliente con pines, respuestas, decisión, finalizar; `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-C.md`; pruebas.
- [ ] Commit `Galería: revisión de la prueba de álbum y documento de migración`.
