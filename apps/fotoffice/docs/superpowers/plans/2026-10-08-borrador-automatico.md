# Borrador automático — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Al llegar una consulta web de una categoría con el interruptor encendido, se arma solo el presupuesto en borrador (sin enviarlo) con tarea de revisión.

**Architecture:** Tabla nueva `FotofficePropuestaBorradorAuto` (fila = encendido). `armarBorradorDePropuesta` reutiliza el armado del envío automático sin enviar. El alta web lo llama cuando la propuesta no salió sola. Casilla en el editor de la propuesta.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-borrador-automatico-design.md`

## Global Constraints

- Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/borrador-automatico`, rama `feat/fotoffice-borrador-automatico`. Nada fuera de ahí.
- Migración `20261023100000_fotoffice_propuesta_borrador_auto`, UNA tabla nueva, no toca otras. No se aplica desde el código.
- Leer el interruptor nunca rompe nada: error/tabla faltante = apagado.
- El alta nunca falla ni se demora por esto (corre en `despuesDeResponder`, aislado).
- El borrador nunca se envía y nunca registra correo; no se duplica si la consulta ya tiene presupuesto.
- No tocar las opciones de pago ni `lib/presupuestos/{ajustes,versiones,editor,publico,vista-publica,aceptacion}.ts` (terreno de la sesión de Etapa 3) salvo lo imprescindible.
- Sin dependencias nuevas. Textos en español rioplatense. Botones `fo-btn` con variante.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: Tabla + interruptor

Files: `packages/db/prisma/schema.prisma` (modelo + relaciones inversas en `Workspace` y `FotofficeConsultaCategoria`), `packages/db/prisma/migrations/20261023100000_fotoffice_propuesta_borrador_auto/migration.sql`, `apps/fotoffice/lib/presupuestos/borrador-automatico.ts` (servidor), `apps/fotoffice/lib/circuitos/base-en-memoria.ts`, tests `apps/fotoffice/lib/presupuestos/borrador-automatico.test.ts` y `.../migracion-borrador-automatico.test.ts` (patrón de `migracion-propuesta-modelo.test.ts`).

Produces:
- `armaBorradorAuto(workspaceId: string, categoriaId: string): Promise<boolean>` (sistema; error → false).
- `categoriasConBorradorAuto(workspaceId: string): Promise<Set<string> | null>` (null si la tabla falta/error).
- `guardarBorradorAuto(ctx: CtxPresupuestos, categoriaId: unknown, encendido: unknown): Promise<{ ok: true } | { ok: false; error: string }>` (exige configurar; categoría del workspace sin archivar; encendido = upsert de fila, apagado = deleteMany; error de base → "No se pudo guardar. ¿Ya se aplicó el SQL del borrador automático?").

### Task 2: Armar el borrador + enganche en el alta

Files: `apps/fotoffice/lib/presupuestos/propuesta-automatica.ts` (+ test), `apps/fotoffice/lib/consultas/alta.ts` (+ test del alta si existe; si no, prueba en `propuesta-automatica.test.ts` o `lib/consultas/*.test.ts` siguiendo el patrón actual).

Produces `armarBorradorDePropuesta(workspaceId, leadId, deps?)` → `"ARMADO" | "NO_APLICA" | "YA_TIENE_PRESUPUESTO" | "FALLO" | "ERROR"` (ver spec §2.3). Extraer el armado común de `enviarPropuestaModelo` a una función interna compartida sin cambiar su comportamiento (sus tests siguen verdes). En el alta: dentro del bloque WEB de `despuesDeResponder`, después de `enviarPropuestaModelo`, si el resultado no es `ENVIADA` ni `ERROR_TRAS_ENVIO`, `await armarBorradorDePropuesta(...)` en su propio try/catch con `registrarFalla("armarBorradorDePropuesta", error)`. Actualizar el comentario de pasos del alta.

### Task 3: Casilla en el editor de la propuesta

Files: `apps/fotoffice/app/workspace/configuracion/presupuestos/propuestas/[categoriaId]/page.tsx`, `apps/fotoffice/components/presupuestos/editor-propuesta-modelo.tsx`, `apps/fotoffice/app/workspace/configuracion/presupuestos/actions.ts` (+ tests). La página lee `armaBorradorAuto` (si `categoriasConBorradorAuto` da null, pasa `sqlPendiente: true` y la casilla se muestra deshabilitada con "Falta aplicar el SQL del borrador automático"). Acción `guardarBorradorAutoAction(categoriaId, encendido)` → `guardarBorradorAuto`. La casilla se guarda al tildar (con estado y mensajes role status/alert). Con "Enviar sola" encendido, deshabilitada con "Ya sale sola". Opcional barato: en la lista de propuestas (`propuestas/page.tsx`) mostrar "Borrador automático" en las categorías que lo tienen.

### Task 4: Verificación

Suite completa, typecheck, build, revisión final, PR apilado sobre `feat/fotoffice-plantillas-servicio`.
