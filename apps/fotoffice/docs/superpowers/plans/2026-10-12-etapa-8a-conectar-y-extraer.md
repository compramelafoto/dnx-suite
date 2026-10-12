# Etapa 8A · Conectar Alboom y extraer — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** conectar la cuenta de Alboom de un workspace (credencial cifrada) y extraer todo su CRM en segundo
plano a una tabla de datos crudos, con avance visible, sin escribir nunca en Alboom.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-12-etapa-8-migracion-design.md` (Entrega 8A, Datos, Reglas).

## Global Constraints

- **Rama y worktree:** `feat/fotoffice-etapa-8a-alboom-extraer` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Sin dependencias nuevas.**
- **Base de datos:** migración `packages/db/prisma/migrations/20261105120000_fotoffice_etapa_8_alboom_extraccion/migration.sql`
  (verificar que el nombre completo no exista); sólo las dos tablas nuevas; prueba de fuente; no se aplica en la
  rama; documento `packages/db/docs/MIGRACION-ETAPA-8A.md` con checksum.
- **Reutilizar** de la rama `origin/feat/fotoffice-asistente-ventas` (nunca fusionada): `apps/fotoffice/lib/sales-assistant/alboom/client.ts`
  (inicio de sesión con `POST /api/users/login`, token Bearer, reintento ante 401, timeouts, errores
  `AlboomLoginError`/`AlboomApiError`) y `credentials.ts` (guardado cifrado en `WorkspaceIntegration` con
  `lib/integrations/store`), copiándolos a `lib/alboom/` y extendiéndolos con los métodos de lectura que hagan
  falta; **sólo `GET`/`POST` de lectura** (listados `paginate`, detalles, `list`): una lista blanca de rutas en el
  cliente que rechace cualquier otra (nada de `PUT`, `DELETE` ni `POST` que escriba).
- **Endpoints:** tomarlos de `apps/fotoffice/docs/alboom/0{1..5}-*.md` y `09-configuracion-real-dnx.md` (en la rama
  de docs `docs/fotoffice-crm-alboom`, worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-crm-alboom`) y de la memoria
  del proyecto: `POST /api/leads/paginate`, `GET /api/leads/{id}`, `GET /api/leads/progress/...`, `POST /api/activities/paginate`,
  `GET /api/mails/leads/{id}/0/50`, `POST /api/notes/paginate`, `GET /api/stages/list?type=lead_stage`,
  `POST /api/orders/paginate` (params `type:'all',user:'all',pageNumber,pageSize,sortBy,sortDir,period:'all',period_job:'all',start_date:'all'`),
  `GET /api/orders/items?id=`, contratos `POST /agreements/paginate` + `GET /agreements/:id`, plantillas
  `GET /agreement_templates`, proyectos `POST /projects/paginate` (+ `GET /projects/progress/:id/0/9999`,
  `POST /participants/paginate`), `GET /tasks`, `GET /eventtypes`, `POST /events/paginate`, `GET /settings`,
  finanzas `POST /account_trans/paginate_apr` (`type ar|ap`) y bancos/movimientos, productos, contactos
  (`GET /contacts/list?type=all_users`), etc. Donde un documento marque "No determinable", el extractor guarda lo
  que responda y registra la duda.
- **Ritmo:** ≤ 1 pedido por segundo a Alboom; tandas por el cron `/api/cron/alboom-extraccion` (cada 5 min,
  `maxDuration 300`, presupuesto 270 s), retomando desde `progress`; una extracción activa por workspace.
- **Pantalla:** Configuración → **Migración desde Alboom** (dueño/administrador): conectar / desconectar, "Probar
  conexión", "Extraer todo", "Volver a extraer" (incremental por huella), "Cancelar", avance por entidad
  (cantidad, páginas, errores, última actualización), "Borrar lo extraído". Textos en español rioplatense.
- **Seguridad y privacidad:** la contraseña nunca aparece en logs/eventos/respuestas; el payload crudo nunca se
  manda al navegador salvo un contador; aislamiento por `workspaceId`; módulo/acceso: sólo dueño/administrador
  (rol completo), sin módulo nuevo **[decisión]**.
- **Verificación:** vitest completo (cliente con `fetch` falso, lista blanca, paginado, reintentos, presupuesto de
  tiempo, idempotencia por huella); tsc con 8 GB (código de salida y salida); prisma validate/generate; `next build
  --webpack` en limpio y `rm -rf apps/fotoffice/.next`; ningún componente de cliente importa `server-only`/`node:*`.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: Todo 8A (datos, cliente de lectura, extractor por entidad, cron, pantalla, documento)
- [ ] Commit(s) `Migración desde Alboom: conectar y extraer en segundo plano (SQL sin aplicar)`.
