# Telegram privado local — canal principal (Etapa 20)

Durante esta etapa Telegram se ejecuta mediante long polling en la computadora local. El bot sólo funciona mientras el proceso `telegram:start` esté encendido.

La siguiente instalación prevista será en una notebook secundaria que permanece encendida. No es necesario desplegar todavía un servidor público.

Telegram es el canal principal para Dani. El laboratorio web continúa siendo una herramienta técnica secundaria.

## Propósito

Conversar con DNX Sales Assistant desde el teléfono, en un chat privado, sin webhook, dominio, HTTPS público ni túneles.

## Arquitectura de polling

```text
Telegram Bot API (HTTPS saliente)
  ← getUpdates (long polling)
  → sendMessage / answerCallbackQuery

apps/dnx-sales-assistant/src/channels/telegram/
  bot/          cliente API
  polling/      long polling + backoff
  security/     allowlist userId + chatId + private
  mapping/      update → inbound
  session/      handler → processIncomingMessage
  commands/     /inicio /presupuesto …
  persistence/  .local/telegram/
```

Usa el pipeline real (`processIncomingMessage` + `dani-conversation-v1` + pricing runtime + `runPricingReview`). No duplica extracción ni fórmulas.

## Por qué no requiere webhook

El proceso consulta Telegram periódicamente. No hay URL pública, no se abre el router, no se usa el puerto 8799.

## Configuración

Ejemplo sin secretos: `config/telegram/telegram.env.example`

Variables:

- `DNX_TELEGRAM_ENABLED`
- `DNX_TELEGRAM_BOT_TOKEN`
- `DNX_TELEGRAM_ALLOWED_USER_IDS`
- `DNX_TELEGRAM_ALLOWED_CHAT_IDS`
- `DNX_TELEGRAM_TRANSPORT=polling`
- `DNX_OWNER_EMAIL` (p. ej. `dnxfotografia@gmail.com`)
- `DNX_TELEGRAM_OWNER_USER_ID` / `DNX_TELEGRAM_OWNER_CHAT_ID`

Guardar en `.env.local` (gitignored).

La autorización para utilizar el bot de Telegram no determina por sí sola qué perfil económico debe utilizar Cuánto Cobro.

Ver también: [owner-pricing-profile.md](./owner-pricing-profile.md).

## Vinculación

```bash
pnpm --filter dnx-sales-assistant telegram:pair
```

En Telegram: `/vincular`. En la terminal aparecen user ID y chat ID. No autoriza solo.

## Allowlist

Solo user ID + chat ID + chat `private`. Username/nombre/foto no autorizan.

## Comandos

`/inicio` `/ayuda` `/nueva` `/estado` `/presupuesto` `/explicacion` `/supuestos` `/cancelar` `/privacidad`

## Roles conversacionales (Etapa 21)

Por lenguaje natural: «Simulemos un cliente» → modo CLIENT (vendedor, sin mínimos ni info interna). «Terminemos la simulación» → OWNER. Ver [conversation-roles.md](./conversation-roles.md). Independiente del perfil económico (Etapa 20B).

## Pricing y explicaciones

Los perfiles sintéticos existen únicamente para pruebas automatizadas y nunca pueden producir un presupuesto operativo para Dani.

Si el perfil real no está disponible, el asistente debe bloquear el cálculo en lugar de inventar o sustituir valores.

- `/presupuesto` con perfil real → mínimo sostenible y recomendado vía `@repo/cuanto-cobro-core`.
- Sin perfil / incompleto / sintético → bloqueo sin importes (`NOT_CONFIGURED`).
- `/explicacion` solo explica un presupuesto real válido.
- Al arrancar `telegram:start` se invalidan presupuestos previos de prueba; el draft del trabajo se conserva.
- Botones: explicación, supuestos, aprobar, necesita ajuste, nueva cotización (solo con presupuesto real).

## Persistencia

`.local/telegram/` — `sessions.json`, `updates.json`, `reviews.json`, `flags.json`.

Sobrevive a reinicios del proceso. Sin token ni perfil financiero completo.

## Cierre y reinicio

Ctrl+C / SIGTERM detiene el polling. Volvé a ejecutar `telegram:start`.

## Traslado a otra notebook

1. Clonar/actualizar repo  
2. `pnpm install`  
3. Copiar `.env.local` de forma segura  
4. Opcional: `telegram:export-local` / `telegram:import-local`  
5. `telegram:validate`  
6. `telegram:start`

Alternativas futuras (no configuradas): launchd, PM2, servicio del sistema.

## Privacidad y límites

- Bot privado de un solo dueño  
- Sin grupos/canales  
- Sin precios en logs  
- Sin webhook  
- Lab opcional y secundario  
