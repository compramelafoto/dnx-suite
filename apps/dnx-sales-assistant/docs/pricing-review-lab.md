# Revisión de presupuesto (laboratorio local)

La revisión de presupuesto existe únicamente para verificar el funcionamiento del motor y la claridad de sus explicaciones antes de habilitar resultados económicos para usuarios.

El laboratorio no debe utilizarse como sustituto de una revisión profesional de la configuración económica del fotógrafo.

## Propósito

Permitir que Dani revise, en el laboratorio local (`/review-lab`), cómo el asistente interpreta un cálculo real de `@repo/cuanto-cobro-core` y cómo lo explicaría en español rioplatense — **sin** mostrar precios a usuarios públicos.

## Alcance

Incluye:

- resumen de datos utilizados (con origen);
- supuestos;
- faltantes;
- componentes explicativos (sin duplicar fórmulas);
- mínimo sostenible, recomendado y factor comercial;
- explicación `dani-pricing-explanation-v1`;
- revisión humana e integración con calibración;
- exportación financiera separada.

No incluye: precios públicos, PDF, WhatsApp, pagos, Prisma, Redis, modificación de fórmulas ni del perfil económico.

## Datos utilizados

Campos típicos: tipo de trabajo, fecha, ciudad, duración, fotógrafos, traslado, factor comercial, moneda.

Orígenes:

| Origen | Significado |
|--------|-------------|
| Informado por el fotógrafo | Extraído de la conversación |
| Obtenido del perfil | Configuración económica local |
| Valor predeterminado | Default del sistema |
| Inferido por el sistema | Hint de laboratorio / inferencia |
| Faltante | Aún no disponible |

## Mínimo sostenible / recomendado / factor

- **Mínimo sostenible:** no debería reducirse; cubre costos y sostenimiento según el perfil.
- **Recomendado:** incorpora la decisión comercial (`commercialPositioningId` → factor).
- **Regla:** el recomendado nunca es inferior al mínimo (garantizado por el core).
- Los montos provienen **solo** del motor real; esta capa no recalcula.

## Componentes

Vista explicativa (tiempo de trabajo, gastos, equipo, estructura, margen, etc.). No expone el breakdown técnico del core en rutas públicas.

## Supuestos y faltantes

Todo supuesto declara `code`, `label`, `valueDescription`, `source` y `canChangeResult`.

Los faltantes indican por qué se necesitan, origen esperado y acción (preguntar al fotógrafo vs. perfil).

## Explicación Dani

Versión: `dani-pricing-explanation-v1`.

- Español rioplatense, clara, sin jerga financiera innecesaria.
- Diferencia mínimo vs recomendado.
- Se adapta a segundo fotógrafo, traslado, duración aproximada, ciudad, etc.
- **No** se envía aún en la conversación pública.

## Revisión humana

Veredictos: `APPROVED` | `NEEDS_ADJUSTMENT` | `INCORRECT`.

Categorías `PRICING_EXPLANATION_*` se integran en la calibración local. No modifican automáticamente la explicación.

## Protección de precios

Los importes solo pueden mostrarse cuando:

- `NODE_ENV !== "production"`
- `DNX_SALES_ASSISTANT_REVIEW_LAB=true`
- endpoint del laboratorio
- control «Mostrar valores internos» activo en la sesión

Nunca en respuestas públicas, transcripts públicos, logs, evaluación conversacional general, compare legacy/Dani, referencias visuales ni export estándar del lab.

## Perfiles sintéticos

Los perfiles sintéticos existen únicamente para pruebas automatizadas y nunca pueden producir un presupuesto operativo para Dani.

Si el perfil real no está disponible, el asistente debe bloquear el cálculo en lugar de inventar o sustituir valores.

En el laboratorio el modo sintético está **desactivado por defecto**. Solo con opt-in explícito (checkbox «Usar perfil sintético de prueba», body `allowSynthetic: true`, o `DNX_PRICING_REVIEW_ALLOW_SYNTHETIC=true`) y con advertencia visible:

```text
PERFIL SINTÉTICO DE PRUEBA

Estos importes no corresponden al perfil real de Dani y no deben utilizarse para cotizar.
```

No se puede aprobar ni exportar un resultado sintético como presupuesto operativo. Telegram nunca usa este fallback.

## Configuración `.local`

Perfil y plantillas en `config/pricing/*.local.json` o `config/pricing/owners/<slug>.local.json` (gitignored). Los `.example.json` no se cargan.

Verificar:

```bash
pnpm --filter dnx-sales-assistant pricing:checklist
pnpm --filter dnx-sales-assistant owner-profile:checklist
```

Sin `.local` y sin opt-in sintético → `NOT_CONFIGURED`.

## Exportación

Acción explícita → `apps/dnx-sales-assistant/.local/pricing-review/pricing-review-<timestamp>.json`

Excluye secretos, tokens, env, rutas absolutas y perfil económico completo.

## Endpoints (solo laboratorio)

- `GET /review-lab/api/pricing-review`
- `POST /review-lab/api/pricing-review/calculate`
- `POST /review-lab/api/pricing-review/explain`
- `POST /review-lab/api/pricing-review/review`
- `POST /review-lab/api/pricing-review/export`

## Comandos

```bash
pnpm --filter dnx-sales-assistant pricing-review:validate
pnpm --filter dnx-sales-assistant pricing-review:scenario <scenario-id>
pnpm --filter dnx-sales-assistant pricing-review:report
pnpm --filter dnx-sales-assistant pricing-review:checklist
```

## Privacidad y límites

- Sin CORS abierto; sin stack traces; sin secretos.
- No aceptar perfiles económicos arbitrarios desde el navegador.
- El cálculo silencioso en conversación pública sigue sin exponer montos ni breakdown.
