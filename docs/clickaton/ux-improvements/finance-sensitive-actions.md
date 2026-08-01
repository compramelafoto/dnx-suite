# Acciones financieras sensibles (admin UX)

Documento de presentación. **No se crearon acciones nuevas.** No se ejecutaron acciones sobre cuentas reales en esta etapa.

---

## Desconectar cuenta (owner)

| Campo | Valor |
|---|---|
| Acción UI | “Desconectar cuenta” |
| Riesgo | Alto — impide nuevos cobros con esa cuenta |
| Confirmación | `window.confirm` con consecuencias |
| Efecto esperado | Revoca autorización guardada (endpoint revoke existente) |
| Reversible | Sí, volviendo a conectar |
| Afecta pagos existentes | No elimina historial (según copy alineado al confirm previo) |
| Técnico | `/api/clickaton/payments/mercadopago/revoke` |
| Validación humana previa | Recomendada en producción |

---

## Desconectar cuenta (partner / mi cuenta)

| Campo | Valor |
|---|---|
| Acción UI | “Desconectar cuenta” |
| Riesgo | Alto para recepción de fondos asignados |
| Confirmación | Específica |
| Efecto | Revoca token partner |
| Reversible | Sí, reconectar |
| Técnico | `/api/dnx-payments/partner/mercadopago/revoke` |

---

## Volver a conectar / Conectar Mercado Pago

| Campo | Valor |
|---|---|
| Riesgo | Medio — cambia autorización |
| Confirmación | Redirección a MP (flujo existente) |
| Efecto | Inicia flujo de autorización existente |
| No modifica | Porcentajes ni distribución |

---

## Publicar distribución

| Campo | Valor |
|---|---|
| Acción UI | “Publicar distribución” (antes “Activar”) |
| Riesgo | Alto — define a quién se envía el dinero |
| Confirmación | Botón deshabilitado si cuentas no listas; acción de form existente |
| Efecto | Activa versión DRAFT → ACTIVE (lógica existente) |
| Reversible | Solo con nueva versión / procesos existentes |
| `FINANCE_REVIEW` | Titularidad y liquidación entre partes |

---

## Guardar configuración / crear borrador

| Campo | Valor |
|---|---|
| Riesgo | Medio |
| Confirmación | Validación UI suma 100 % |
| Efecto | Persiste DRAFT (sin publicar) |

---

## Validar configuración / Probar preparación de cobro

| Campo | Valor |
|---|---|
| Riesgo | Bajo — sin cobro real |
| Confirmación | No destructiva |
| Efecto | Dry-run / validación existente |

---

## Acciones no expuestas / no creadas

- Forzar estados de pago
- Cambiar entorno desde UI
- Reprocesar webhooks manualmente
- Editar ledger
- Cambiar collector por API fuera de OAuth
- Modificar porcentajes sin permiso `canMutate`

---

## Información técnica relacionada

IDs de conexión, fee policy, webhookReady, cron de verificación: solo en `AdminTechnicalInfo`.
