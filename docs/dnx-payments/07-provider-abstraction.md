# 07 — Provider abstraction

## Objetivo

Permitir Mercado Pago hoy y Stripe / PayPal / transferencias mañana **sin contaminar** el dominio.

## Capas

```
Product apps
    ↓ commands/queries
DNX Payments core (intents, distribution, ledger)
    ↓ PaymentProvider port
Adapter (mercado-pago | stripe | …)
    ↓ HTTP / SDK
External PSP
```

## Port: `PaymentProvider`

Operaciones (Etapa 03+):

| Método | Uso |
|---|---|
| `createOrder` | Crear orden split / checkout |
| `getOrder` | Verificar estado |
| `refund` | Refund total/parcial/por recipient |
| `parseWebhook` | Validar firma + normalizar |
| `listConsents` / `inviteConsent` / `cancelConsent` | Solo providers con split consent |
| `capabilities()` | Feature flags del provider |

Ningún tipo del core importa `mercadopago` SDK.

## Capabilities

```ts
ProviderCapabilities = {
  supportsSplit1N: boolean
  supportsMarketplaceFee: boolean
  supportsRefundPerRecipient: boolean
  supportsDeviceId: boolean
  supportedCurrencies: CurrencyCode[]
}
```

MP futuro: `supportsSplit1N: true`.  
CLF legacy Preferences: puede modelarse como provider distinto (`mercadopago-preferences`) durante coexistencia — **fuera del cutover de esta etapa**.

## Mapeo de IDs

| Dominio | Provider |
|---|---|
| `ProviderOrder.providerOrderId` | MP `ORD…` |
| `ProviderPayment.providerPaymentId` | MP `PAY…` |
| `ProviderRecipient.externalId` | MP `receiver_id` UUID o `user_id` |
| `SplitConsent` | MP split-consent API |

## Seguridad

- Adapters nunca loguean Access Tokens.
- Webhooks: verificar firma cuando el provider lo soporte.
- Sandbox vs production como `PaymentEnvironment` explícito.

## Carpeta

`packages/payments/src/providers/` — interfaces.  
`packages/payments/src/providers/mercado-pago/` — **solo tipos/placeholders** en Etapa 02 (sin HTTP).
