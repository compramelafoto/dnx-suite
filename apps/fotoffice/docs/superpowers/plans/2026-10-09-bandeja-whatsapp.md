# Bandeja de WhatsApp (Etapa A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Bandeja de WhatsApp en FOTOFFICE funcionando en modo simulado: datos, reglas bot/persona, webhook de Meta verificado, envío (simulado o real), panel y configuración con simulador.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-09-bandeja-whatsapp-design.md` (autoridad: nombres, estados, textos y reglas salen de ahí).

## Global Constraints

- Worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/bandeja-whatsapp`, rama `feat/fotoffice-bandeja-whatsapp`. Nada fuera de ahí.
- Migración `20261027100000_fotoffice_bandeja_whatsapp`: SÓLO crea las 3 tablas nuevas (+ FKs/índices). No se aplica desde el código.
- El token de Meta sólo en el vault (`WorkspaceIntegration`, proveedor `WHATSAPP`). Nunca loguear texto de mensajes, teléfonos completos ni tokens (logs sólo con códigos).
- Workspace y usuario SIEMPRE de la sesión; VIEW para ver, MANAGE para actuar, `configurar` para configuración.
- Horas en Argentina (`America/Argentina/Buenos_Aires`) en pantalla.
- Sin dependencias nuevas. Textos en español rioplatense. Botones `fo-btn` con variante.
- Tests `pnpm --filter fotoffice test -- <ruta>`; typecheck `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p apps/fotoffice/tsconfig.json` (leer salida). Tras tocar el schema: `pnpm --filter @repo/db exec prisma generate`.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: Tablas + teléfono + reglas (puro)

Files: `packages/db/prisma/schema.prisma` (3 modelos + relaciones inversas en Workspace, Client), migración + `apps/fotoffice/lib/bandeja/migracion.test.ts`, `lib/circuitos/base-en-memoria.ts` (3 tablas, defaults, únicos incl. `(workspaceId, waMessageId)` sólo con valor), `apps/fotoffice/lib/bandeja/constantes.ts` (tipos/estados como uniones de strings + `BANDEJA_MODULE_KEY = "whatsapp-inbox"`), `lib/bandeja/telefono.ts` (`waIdDe(raw): string | null`, `ultimos10(waId)`), `lib/bandeja/reglas.ts` (puro: `atiendeElBot`, `puedeResponderLibre`, `alEntrante`, `alEco`, `alTomar`, `alDevolver`, `alResolver`, `alResponderDesdePanel` — cada una recibe el chat (campos de estado) + ahora (+ datos) y devuelve el parche del chat y, si corresponde, el mensaje SISTEMA a registrar). Tests de todas las transiciones de §3.

### Task 2: Webhook (parser + firma + ruta) y registro

Files: `lib/bandeja/webhook.ts` (puro: `leerWebhook(json): EventoWa[]`, `firmaValida(cuerpo, firma, secreto)`), `lib/bandeja/registro.ts` (servidor: `aplicarEventos(eventos, ahora?)` — conexión por phoneNumberId, chat upsert, mensaje idempotente, vínculo con cliente §4 vía `clienteDelTelefono`, reglas de Task 1, estados de envío), `app/api/webhooks/whatsapp/route.ts` (GET/POST de §5, patrón de `app/api/webhooks/resend/route.ts`). Fixtures JSON de payloads (texto, imagen con caption, statuses, eco, desconocido). Tests de parser, firma, ruta (sin secreto 404, firma mala 401, ok 200, idempotencia) y registro.

### Task 3: Envío y acciones

Files: `lib/bandeja/envio.ts` (§6; `fetch` inyectable para tests), `lib/bandeja/conexion.ts` (leer/guardar `FotofficeWaConexion`; token vía `lib/integrations/store.ts` + proveedor `WHATSAPP` en el registry), `lib/bandeja/acciones.ts` (servidor, con ctx: `responder`, `tomar`, `devolverAlBot`, `resolver`, `vincularCliente`, `crearContactoDesdeChat`, `marcarLeido`), `app/actions/bandeja.ts` (server actions que arman ctx de la sesión), registro del módulo en `lib/modules/registry.ts` (+ catálogos donde aparece `quotes` si hace falta). Tests de permisos (VIEW no actúa, otro workspace no), 24 h, simulado vs real con fetch simulado, registro de autor.

### Task 4: Panel `/bandeja`

Files: `app/(shell)/bandeja/{layout,page}.tsx`, `app/(shell)/bandeja/[chatId]/page.tsx`, `components/bandeja/*` (lista con filtros y búsqueda, conversación, caja de respuesta, botones, panel del cliente, refresco periódico con `router.refresh()`), `lib/bandeja/lecturas.ts` (listado y detalle con permisos), ítem de menú en `components/shell/shell-nav.tsx` con no leídos. Reglas de fuente + tests de lecturas.

### Task 5: Configuración → WhatsApp y simulador

Files: `app/workspace/configuracion/whatsapp/{page,actions}.tsx|ts` (+ tarjeta en la portada de Configuración), simulador que arma un evento ENTRANTE y lo pasa por `aplicarEventos` (sólo modo SIMULADO, `configurar`), horas de pausa, estado de la conexión. Tests.

### Task 6: Verificación

Suite completa, typecheck, build, revisión final, prueba en navegador contra rama Neon de prueba (simular entrantes, tomar, responder, devolver), PR.
