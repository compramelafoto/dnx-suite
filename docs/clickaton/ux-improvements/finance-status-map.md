# Mapa de estados financieros (admin)

**Fuente:** `apps/clickaton/lib/admin/edition-finance/ui/finance-status-presentation.ts`  
**Nota:** presentación pura; no persiste estados nuevos ni cambia el gate.

---

## Síntesis de edición (`presentEditionFinanceOverall`)

| Clave | Etiqueta | Criterio | Tone | Atención | ¿Lista para cobrar? |
|---|---|---|---|---|---|
| `needs_mp` | Falta conectar Mercado Pago | Cuenta no conectada | warning | action | no |
| `needs_attention_auth` | Requiere atención | Conectada pero auth inválida | danger | action | no |
| `incomplete` | Configuración incompleta | Sin ACTIVE o suma ≠ 100% | warning | action | no |
| `test_only` | Solo para pruebas | Env TEST / gate TEST | warning | action | no |
| `blocked` | Requiere atención | Gate no OK / allocations / updates | danger | action | no |
| `ready` | Listo para recibir pagos | Todo OK en LIVE | success | ok | sí |

Pantallas: `/admin/ediciones/[id]/finanzas`.

---

## Conexión Mercado Pago

| Estado interno | Etiqueta | Descripción | Próxima acción |
|---|---|---|---|
| `NOT_CONNECTED` / vacío | Sin conectar | Sin cuenta autorizada | Conectar Mercado Pago |
| `OAUTH_PENDING` | Conexión en curso | Auth incompleta | Completar / volver a conectar |
| `ACTIVE` / `VERIFIED` | Cuenta conectada | Autorizada | — |
| `CONNECTED_UNVERIFIED` | Conectada · pendiente de verificación | Falta verificación | Revisar |
| `EXPIRED` / `NEEDS_REAUTH` | La conexión necesita actualizarse | No sirve para nuevos pagos | Volver a conectar |
| `REVOKED` | Cuenta desconectada | Auth revocada | Conectar |
| `ERROR` | Error de conexión | No se pudo comprobar | Revisar / soporte |

---

## Entorno

| Interno | Etiqueta | Gravedad |
|---|---|---|
| LIVE / PROD / PRODUCTION | Pagos reales | watch |
| TEST / SANDBOX / DEV | Entorno de prueba | action |
| otro / vacío | Entorno no indicado | watch |

---

## Distribución (versión)

| Interno | Etiqueta |
|---|---|
| `ACTIVE` | Distribución publicada |
| `DRAFT` | Borrador |
| ausente | Sin distribución publicada |

---

## Actualizaciones automáticas (webhook)

| Interno | Etiqueta operativa |
|---|---|
| ready=true | Actualizaciones automáticas disponibles |
| ready=false | Actualizaciones automáticas incompletas |

---

## Verificación de pagos (reconciliación)

| Condición | Etiqueta |
|---|---|
| errores recientes | No pudimos completar la verificación |
| órdenes pendientes | Pendiente de verificación |
| sin lastRun | Pendiente de verificación |
| ok | Sin diferencias |

---

## Operativo vs técnico

| Concepto | Operativo | Técnico |
|---|---|---|
| Cuenta receptora | Nombre + % + estado | paymentConnectionId |
| Conexión | Label ES | status enum |
| Updates | Copy humano | webhookReady flag |
| Distribución | Publicada / borrador | ACTIVE / DRAFT |
| PKCE / client id | — | AdminTechnicalInfo |
| Ledger / fee policy | — | AdminTechnicalInfo |

---

## Casos no contemplados

1. Totales cobrados / pendientes / rechazados por edición (no hay UI de movimientos).
2. Comisiones MP netas confirmadas vs estimadas.
3. Multi-receptor productivo real (hoy suele ser 100 % a una cuenta).
4. Diferencia staging app vs sandbox MP: se etiqueta según `environment` de la conexión; no se inventa.
