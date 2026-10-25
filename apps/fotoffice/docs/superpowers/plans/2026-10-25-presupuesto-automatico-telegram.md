# Plan — Presupuesto automático con aprobación por Telegram

Spec: [2026-10-25-presupuesto-automatico-telegram-design.md](../specs/2026-10-25-presupuesto-automatico-telegram-design.md)

1. **Esquema y migración.** Cuatro modelos nuevos en `packages/db/prisma/schema.prisma`, sin
   relaciones con tablas existentes; `20261219120000_fotoffice_presupuesto_automatico_telegram`
   con `IF NOT EXISTS`. Agregar las tablas a `lib/circuitos/base-en-memoria.ts`.
2. **Telegram (puro + red).** `lib/telegram/api.ts` (Bot API con `fetch`, nunca loguea el token),
   `lib/telegram/webhook.ts` (secreto, lectura de updates, datos de botones; PURO),
   `lib/integrations/telegram/credentials.ts` (cofre), `lib/telegram/conexion.ts` (conectar,
   vincular, desconectar). Registro en `lib/integrations/registry.ts`.
3. **Lógica del flujo** en `lib/presupuesto-automatico/`:
   - `resumen.ts` (PURO): texto del aviso y botones; `canales.ts` (PURO): decisión de canales y
     texto de WhatsApp; `portfolio-items.ts` (PURO): validación del portfolio.
   - `ajustes.ts`: interruptor por categoría, portfolio, acuse (lectura tolerante).
   - `flujo.ts`: `alLlegarConsulta` (borrador + aprobación + aviso) y `aprobarYEnviar` (idempotente).
   - `telegram-webhook.ts`: `/start <código>` y botones.
   - `portfolio.ts`: URLs del portfolio para la página pública.
4. **Enganches.** `lib/consultas/alta.ts` (consulta web), `armarBorradorParaAprobar` en
   `propuesta-automatica.ts`, `enviarPresupuestoDelSistema(..., { sinCorreo })` en `envio.ts`,
   herramienta `preparar_presupuesto` del bot de WhatsApp, aviso por WhatsApp del sistema
   (`lib/bandeja/aviso-sistema.ts`), historial de la consulta.
5. **Pantallas.** Configuración → Telegram (conectar, vincular, interruptores por categoría, acuse,
   pendientes de aprobar) y Configuración → Telegram → Portfolio de cada categoría; sección de
   portfolio en `app/w/[workspaceSlug]/presupuesto/[token]`.
6. **Webhook** `app/api/webhooks/telegram/[conexionId]/route.ts`.
7. **Pruebas vitest**: resumen, canales, webhook (secreto y lectura), idempotencia de aprobar,
   vínculo del chat, portfolio, migración.
8. **Verificación**: `tsc --noEmit`, vitest, `pnpm build`; commit, push, PR.
