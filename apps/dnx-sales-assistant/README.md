# dnx-sales-assistant

Asistente comercial DNX — simulación HTTP + **Telegram privado local** (Etapa 20).

Sin WhatsApp, Prisma, IA, webhook público ni precios en HTTP público.

## Conversación natural (Etapa 15)

Renderer `dani-conversation-v1` (default) + legacy + fallback. Doc: [`docs/dani-conversation-v1.md`](docs/dani-conversation-v1.md).

## Evaluación conversacional (Etapa 14–15)

Banco offline + score `dani-style-v1`. Doc: [`docs/conversation-evaluation.md`](docs/conversation-evaluation.md).

```bash
pnpm --filter dnx-sales-assistant conversation:evaluate:all
pnpm --filter dnx-sales-assistant conversation:evaluate:scenario wedding-complete-first-message
pnpm --filter dnx-sales-assistant conversation:compare
pnpm --filter dnx-sales-assistant conversation:lab
```

Laboratorio local (solo desarrollo): `http://localhost:8799/review-lab` — doc [`docs/conversation-review-lab.md`](docs/conversation-review-lab.md).

## Referencias visuales (Etapa 17)

Catálogo local curado (solo laboratorio). Sin búsqueda web ni imágenes públicas.

```bash
pnpm --filter dnx-sales-assistant visual-references:checklist
pnpm --filter dnx-sales-assistant visual-references:validate
pnpm --filter dnx-sales-assistant visual-references:list
```

Doc: [`docs/visual-references.md`](docs/visual-references.md).

## Calibración humana (Etapa 18)

Bandeja de revisiones → agrupaciones → propuestas de copy (simulación in-memory) → casos dorados. Sin aprendizaje automático. Dry-run por defecto.

```bash
pnpm --filter dnx-sales-assistant calibration:report
pnpm --filter dnx-sales-assistant calibration:validate
```

Doc: [`docs/conversation-calibration.md`](docs/conversation-calibration.md).

## Telegram privado (Etapa 20)

Canal principal para Dani vía long polling local (sin dominio ni webhook).

```bash
pnpm --filter dnx-sales-assistant telegram:checklist
pnpm --filter dnx-sales-assistant telegram:pair
pnpm --filter dnx-sales-assistant telegram:validate
pnpm --filter dnx-sales-assistant telegram:start
```

Doc: [`docs/telegram-local-owner-channel.md`](docs/telegram-local-owner-channel.md).

## Revisión de presupuesto (Etapa 19)

Sección del laboratorio para revisar el cálculo real del core y la explicación `dani-pricing-explanation-v1`. Importes ocultos por defecto; solo con «Mostrar valores internos».

```bash
pnpm --filter dnx-sales-assistant pricing-review:validate
pnpm --filter dnx-sales-assistant pricing-review:report
pnpm --filter dnx-sales-assistant pricing-review:checklist
pnpm --filter dnx-sales-assistant pricing-review:scenario pr-wedding-complete
```

Doc: [`docs/pricing-review-lab.md`](docs/pricing-review-lab.md).

## Pipeline

```
HTTP → Request Parser → processIncomingMessage(store)
  → Intent + memoria efímera
  → Quote extract/merge (si aplica)
  → Response Builder → HTTP
```

## Precios (Etapas 09–12)

- Config versionada en `config/pricing/` (examples seguros; `.local` gitignored).
- Adaptador puro → DTO compatible con ¿Cuánto Cobro?
- Motor real en `@repo/cuanto-cobro-core`.
- Dry-run CLI + **runtime silencioso** al llegar a `READY_FOR_CALCULATION` (resultado solo en memoria interna).
- **No hay precios en HTTP.** Docs: [`docs/pricing-integration.md`](docs/pricing-integration.md).

### Configuración

```bash
pnpm --filter dnx-sales-assistant pricing:checklist
```

Copiá **a mano** (no se crea automáticamente):

```text
config/pricing/dnx-pricing-profile.example.json
→ config/pricing/dnx-pricing-profile.local.json

config/pricing/dnx-service-templates.example.json
→ config/pricing/dnx-service-templates.local.json

config/pricing/dnx-pricing-job.example.json
→ config/pricing/dnx-pricing-job.local.json
```

Completá valores reales, `configured: true`, y validá:

```bash
pnpm --filter dnx-sales-assistant pricing:validate
pnpm --filter dnx-sales-assistant pricing:dry-run
```

- `pricing:validate` y `pricing:dry-run` **fallan hoy** si no existen los `.local.json` (esperado).
- No cotizar con examples (`configured: false`).
- Un dry-run `READY` es cálculo técnico; **no autoriza** enviar el precio (`approvalStatus: NOT_REVIEWED`).
- `READY_FOR_CALCULATION` en conversación solo indica datos mínimos; **sin precios en HTTP**.

## Memoria conversacional efímera (RAM)

- ID = SHA-256 del teléfono (no se expone en HTTP).
- TTL 30 min; máx. 1000 conversaciones.
- Se pierde al reiniciar el proceso.

## Arranque

```bash
pnpm sales-assistant:dev
```

Puerto: `3040`.

## Limitaciones

Sin IA, sin precios en HTTP, sin persistencia real, sin imports a ComprameLaFoto.
