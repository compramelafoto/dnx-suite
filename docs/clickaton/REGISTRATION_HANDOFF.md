# Clickaton — handoff de inscripción (Etapa 09B1)

## Arquitectura

```text
Clickaton → FotoRank (oferta pública) → DNX Payments (09B2+) → proveedor
```

En 09B1 **no** hay cobro real, Preferences de Mercado Pago, webhooks ni órdenes en FotoRank.

## Flujo actual (09B1)

```text
Clickatón (card / ficha)
  → registration.registrationUrl  (landing FR)
  → FotoRank /concursos/{slug}?source=clickaton[&returnTo=…]
  → mensaje / formulario futuro según estado de oferta
```

- `checkoutUrl` es **siempre `null`** en 09B1.
- El CTA usa solo `registrationUrl` cuando `canRegister` es true.
- Merchandising: solo flag informativo `hasOptionalMerchandise` (sin catálogo ni stock).

## Contrato público (`registration`)

Campos relevantes:

| Campo | Uso en Clickaton |
|-------|------------------|
| `mode` | `free` \| `paid` (explícito) |
| `status` | ventana: not_open / open / closed / full / … |
| `canRegister` | habilita CTA |
| `displayPrice` | `amountMinor` + `currency` + `formatted` |
| `capacity` / `remainingSpots` | cupo visible |
| `hasOptionalMerchandise` | copy opcional |
| `registrationUrl` | destino del CTA |
| `checkoutUrl` | null hasta 09B2 / DNX Payments |

## Variables

| Variable | Uso |
|----------|-----|
| `CLICKATON_PUBLIC_DATA_SOURCE` | `fotorank` \| `fixture` |
| `FOTORANK_PUBLIC_API_BASE_URL` | Clickatón → API V1 |
| `FOTORANK_PUBLIC_WEB_BASE_URL` | URLs absolutas de handoff |
| `CLICKATON_PUBLIC_WEB_BASE_URL` | Origen permitido para `returnTo` |

## Seguridad

- Solo `http`/`https`
- Sin credenciales en URL
- `returnTo` restringido a origen Clickatón o ruta relativa `/…`
- Sin IDs de órdenes, pagos, collectors ni stock en la Public API

## Persistencia (repo, no aplicada en este paso)

Migración aditiva: `20260715180000_fotorank_public_registration_summary`  
Campos en `FotorankContest`: enabled, pricing mode, precio minor, moneda, ventana, cupo, flag merch.

**No** aplicar migraciones ni `db push` sin autorización explícita.

## Fuera de alcance 09B1

- DNX Payments / Mercado Pago / webhooks
- Checkout y órdenes en FotoRank
- Catálogo / stock / reservas de merch
- Split, collector, comisiones
