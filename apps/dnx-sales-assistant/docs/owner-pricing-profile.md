# Perfil económico del propietario (Etapa 20B)

La autorización para utilizar el bot de Telegram no determina por sí sola qué perfil económico debe utilizar Cuánto Cobro.

Los perfiles sintéticos existen únicamente para pruebas automatizadas y nunca pueden producir un presupuesto operativo para Dani.

Si el perfil real no está disponible, el asistente debe bloquear el cálculo en lugar de inventar o sustituir valores.

## Autorización Telegram vs identidad económica

| Capa | Variables | Efecto |
|------|-----------|--------|
| Allowlist del bot | `DNX_TELEGRAM_ALLOWED_USER_IDS`, `DNX_TELEGRAM_ALLOWED_CHAT_IDS` | Puede hablar con el bot |
| Identidad propietaria | `DNX_OWNER_EMAIL`, `DNX_TELEGRAM_OWNER_USER_ID`, `DNX_TELEGRAM_OWNER_CHAT_ID` | Resuelve qué perfil de Cuánto Cobro usar |

Ambas deben coincidir. Un chat autorizado sin identidad/perfil económico recibe bloqueo, no un fallback sintético.

## Asociación con `dnxfotografia@gmail.com`

Configuración local explícita (`.env.local`):

```env
DNX_OWNER_EMAIL=dnxfotografia@gmail.com
DNX_TELEGRAM_OWNER_USER_ID=848105650
DNX_TELEGRAM_OWNER_CHAT_ID=848105650
```

Resolución:

```text
Telegram user ID + chat ID
→ propietario autorizado
→ correo DNX explícito
→ perfil económico asociado (.local)
→ @repo/cuanto-cobro-core
```

No se asocia por username, nombre de Telegram, email inferido, “primer archivo” ni defaults globales.

## Archivos locales

Candidatos (en orden):

1. `DNX_OWNER_PRICING_PROFILE_PATH` (opcional)
2. `config/pricing/owners/<slug>.local.json` (p. ej. `dnxfotografia.local.json`)
3. `config/pricing/dnx-pricing-profile.local.json`

Plantillas: `DNX_OWNER_PRICING_TEMPLATES_PATH` o `dnx-service-templates.local.json`.

Ejemplo (nunca cargado por runtime):

```text
config/pricing/owners/dnxfotografia.example.json
```

Los `.example.json` se rechazan en el loader.

## Bloqueo de sintéticos

`assertProductionSafePricingProfile` / `isUserFacingPricingProfile` bloquean:

- `id === TEST_ONLY_SYNTHETIC_PROFILE` (y equivalentes)
- `profileVersion` que empieza con `test-`
- nombres de fixture de prueba

Telegram nunca pasa `useSynthetic: true`.

## Estados del resolvedor

- `READY` — perfil + plantillas locales válidos
- `NOT_FOUND` — sin archivo utilizable
- `INCOMPLETE` — archivo inválido / no listo
- `IDENTITY_MISMATCH` — IDs/correo no coinciden
- `SYNTHETIC_BLOCKED` — archivo con marca de prueba

## Checklist CLI

```bash
pnpm --filter dnx-sales-assistant owner-profile:checklist
pnpm --filter dnx-sales-assistant owner-profile:validate
pnpm --filter dnx-sales-assistant pricing:checklist
```

No imprime gastos personales ni montos del perfil.

## Invalidación de resultados previos

Al arrancar `telegram:start`, se invalidan presupuestos/caché/aprobaciones ligados a perfiles de prueba. El draft conversacional (tipo de trabajo, ciudad, fecha, duración) se conserva. `/estado` puede mostrar el aviso de invalidación.

## Laboratorio

El lab puede usar sintético solo con opt-in explícito (`allowSynthetic` / checkbox / `DNX_PRICING_REVIEW_ALLOW_SYNTHETIC=true`). Muestra:

```text
PERFIL SINTÉTICO DE PRUEBA

Estos importes no corresponden al perfil real de Dani y no deben utilizarse para cotizar.
```

No se puede aprobar ni exportar como presupuesto operativo.

## Privacidad

Logs: `pricing profile status=…`, email enmascarado (`dnxfo***@gmail.com`). Sin token, sin gastos personales, sin perfil completo.
