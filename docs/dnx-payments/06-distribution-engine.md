# 06 — Distribution Engine

## Objetivo

Calcular un `DistributionPlan` deterministicamente a partir de:

- `totalAmount` (`Money`)
- reglas de beneficiaries ( %, fijo, mixto)
- prioridades
- política de redondeo
- opcionales / futuros

**No** contiene lógica Mercado Pago. Solo dinero DNX.

## Entrada

```ts
DistributionInput = {
  total: Money
  rules: DistributionRule[]
  rounding: RoundingPolicy
  feePolicy?: FeeAllocationPolicy // WAITING_MP_CONFIRMATION
}
```

### DistributionRule

| Campo | Significado |
|---|---|
| `recipientId` | Beneficiario lógico |
| `kind` | `PERCENTAGE` \| `FIXED` |
| `value` | Percentage (bps o ratio) o Money fijo |
| `priority` | Orden de aplicación (menor = antes) |
| `optional` | Si no puede cobrarse (sin consent), se omite y se redistribuye según política |
| `role` | Metadata financiera |

## Modos

### 1. Solo porcentaje

Suma de porcentajes = 100% (10000 bps). Redondeo reparte residuos.

### 2. Solo fijo

Suma de fijos = `total`. Si no, error de dominio.

### 3. Combinaciones

Orden:

1. Aplicar reglas `FIXED` por prioridad.
2. Remanente se reparte entre reglas `PERCENTAGE` (sobre remanente o sobre total — **política explícita** `percentageBase: REMAINDER | GROSS`).
3. Default recomendado: `REMAINDER` (fijos primero, % sobre lo que queda).

### Beneficiarios opcionales

Si `optional` y recipient no elegible:

- `DROP_AND_REDISTRIBUTE` (default)
- `DROP_TO_PLATFORM`
- `FAIL`

## Redondeo

Nunca float. Trabajar en **minor units** (enteros).

Políticas:

| Policy | Comportamiento |
|---|---|
| `LARGEST_REMAINDER` | Método Hamilton: residuos a quien tenga mayor parte fraccional |
| `PLATFORM_ABSORBS` | Residuo (±1..n) a cuenta plataforma |
| `FIRST_RECIPIENT_ABSORBS` | Residuo al de mayor prioridad |

Invariante final: `sum(entries.amountMinor) === total.amountMinor`.

## Fee del provider

`FeeAllocationPolicy`:

- `UNKNOWN` / `WAITING_MP_CONFIRMATION` — el plan se calcula **gross** y el fee se registra aparte en ledger cuando se conozca.
- Futuras: `PROPORTIONAL`, `OWNER_PAYS`, `PLATFORM_PAYS`.

## Salida

`DistributionPlan` con `entries: DistributionEntry[]` en montos fijos minor units (siempre materializados, aunque la regla haya sido %).

## Determinismo

Misma input → misma output. Obligatorio para tests y auditoría.
