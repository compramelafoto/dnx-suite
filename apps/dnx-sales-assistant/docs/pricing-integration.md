# Integración de precios — dnx-sales-assistant

## Package compartido (Etapa 11)

- Motor puro: `@repo/cuanto-cobro-core`
- Fuente única de fórmulas
- ComprameLaFoto consume el package vía wrappers

## Engine offline (Etapa 12)

- Implementación: `src/pricing/cuanto-cobro-engine/`
- Orquestador: `src/pricing/offline/run-pricing-dry-run.ts`
- CLI: `pnpm --filter dnx-sales-assistant pricing:dry-run`

### Flujo completo (solo offline)

```text
loaders (.local.json)
→ readiness
→ preparePricingJob
→ createCuantoCobroCompatibleInput
→ CuantoCobroPricingEngine → calculateCuantoCobro
→ PricingCalculationResult
```

### Precio comercial DNX

Usa **`recommendedBusinessPrice`**.  
`recommendedPrice` del core es legado y NO se usa como recomendado comercial.

### Approval

Todo resultado offline lleva `approvalStatus: "NOT_REVIEWED"`.  
Cálculo técnico válido ≠ precio autorizado para enviar al cliente.

### Archivos requeridos para dry-run

```text
config/pricing/dnx-pricing-profile.local.json
config/pricing/dnx-service-templates.local.json
config/pricing/dnx-pricing-job.local.json
```

Examples seguros (`configured: false`):

- `dnx-pricing-profile.example.json`
- `dnx-service-templates.example.json`
- `dnx-pricing-job.example.json`

No se crean `.local.json` automáticamente. No marcar `configured: true` hasta completar valores reales.

### Output seguro del CLI

Cuando esté listo: estado, moneda, mínimo, recomendado negocio, versiones, warnings.  
Sin breakdown económico, gastos, ingresos ni equipo por defecto.

Hoy (locales ausentes): exit ≠ 0, sin montos, indica archivos faltantes.

### Runtime silencioso (Etapa 13)

Cuando el draft llega a `READY_FOR_CALCULATION`, el pipeline ejecuta el motor **en memoria** vía `src/pricing/runtime/`:

- resultado en `StoredConversation.pricingResult` (sin breakdown completo);
- cache por huella draft + versiones;
- invalidación si cambia el draft;
- fallos → `FAILED`/`INCOMPLETE` sin romper la conversación;
- **la respuesta HTTP y los textos al usuario no cambian**.

Logs permitidos: `Pricing runtime READY|FAILED|INCOMPLETE` (sin montos).

## Prohibiciones vigentes

- No precios en `POST /simulate/message`
- No importar el engine/core desde HTTP/processor/conversation (solo `pricing/runtime` desde pipeline)
- `READY_FOR_CALCULATION` conversacional ≠ precio enviado al cliente
- `approvalStatus: NOT_REVIEWED` hasta etapa de exposición

## Adaptador (Etapa 10)

- `src/pricing/cuanto-cobro-adapter/`
- Matriz: [`pricing-adapter-mapping.md`](pricing-adapter-mapping.md)

## Comandos

```bash
pnpm --filter dnx-sales-assistant pricing:checklist
pnpm --filter dnx-sales-assistant pricing:validate
pnpm --filter dnx-sales-assistant pricing:dry-run
```

Flags dry-run: `--profile` `--templates` `--job`  
Env: `DNX_PRICING_PROFILE_PATH` `DNX_PRICING_TEMPLATES_PATH` `DNX_PRICING_JOB_PATH`

## Limitaciones

- Sin perfil/plantillas/job reales todavía
- Sin exposición de montos en HTTP
- Sin workflow de aprobación persistido
- El core no exporta aún una constante pública de versión de motor; se usa `formulaVersion` de perfil/plantilla
- Próxima etapa: política de exposición y eventual cableado controlado (no automático) a conversación

## Próxima etapa recomendada

Definir política de exposición de montos y, si corresponde, un puente opcional/flag interno hacia conversación — **sin** enviar precios al cliente hasta `approvalStatus: APPROVED` y decisión de producto.
