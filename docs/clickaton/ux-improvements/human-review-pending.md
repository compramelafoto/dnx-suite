# Pendientes humanos, legales y de producto — consolidado Etapa 02

Documento de seguimiento. **No modifica** consentimientos, bases, precios, distribución ni criterios de evaluación.

---

## Revisión legal (`LEGAL_REVIEW`)

Fuentes: `legal-review-consents.md`, Imp. 01 wizard, Imp. 08 social.

- Consentimiento agrupado (imagen / placa / redes / licencia) en funnel.
- Uso de nombre, imagen e Instagram en placas.
- Etiquetado y publicación en redes (no asumir autorización automática).
- Posteos colaborativos (no habilitados en UI).
- Revocación / eliminación / reutilización comercial.
- Cuerpo de `/legal/terminos` y `/legal/privacidad` (no reescrito en UX).
- Envíos promocionales no estrictamente transaccionales.

## Revisión comercial (`COMMERCIAL_REVIEW`)

Fuentes: Imp. 07 pricing/promos/productos.

- Modificación de precios vigentes y beneficios por fase.
- Límites y códigos promocionales para terceros.
- Venta separada de productos (tienda pública inexistente).
- Stock / sustitución / talles / entrega / reembolsos asociados a productos.

## Revisión financiera (`FINANCE_REVIEW`)

Fuentes: Imp. 03 finanzas MP.

- Titularidad de cuentas Mercado Pago.
- Publicación de distribución / liquidación entre partes.
- Desconectar cuentas owner/partner.

## Decisiones de producto

- Portal de patrocinadores (placeholder).
- Roles por sede / organizador dedicado (no existe).
- Sustituir `window.confirm` por modal accesible compartido.
- Mensajes admin / CRM de contacto (parcial).
- Copy marketing “Sponsors locales” en `organizar-sede`.

## Dependencias de FotoRank

- Jurado, evaluación anónima, ranking y publicación de resultados.
- Sync de participantes/fotos admitidas (Clickatón solo prepara).
- No hay panel de jurado dentro de Clickatón (Imp. 06 PARTIAL/OUT_OF_SCOPE).

## Dependencias de integraciones

- `DNX_SOCIAL_PUBLISHER_LIVE` para publicación real.
- Resend webhooks para “entregado”.
- URLs admin FotoRank / pagos opcionales.
- OAuth Mercado Pago owner/partner.

## Validaciones de staging

- Flujos de cobro reales (sandbox/live) fuera de UX.
- Publicación social dry-run vs LIVE.
- Smoke de correos / webhooks.

## Validaciones E2E

- No ejecutadas en Imp. 09 (sin entorno E2E dedicado en esta entrega).
- Recomendado: login admin, nav mobile, inscripción, postpago, mi-cuenta QR/placa.

## Bloqueos para cierre “perfecto” de producto

1. Revisiones LEGAL / FINANCE / COMMERCIAL firmadas.
2. Panel jurado (FotoRank) o decisión explícita de no duplicarlo.
3. E2E staging verdes.
4. Auditoría a11y especializada.
5. Decisión sobre tienda / venta separada.
