# Etapa 02 Imp. 02 — Panel admin de inscripciones

**Estado:** DONE (con limitaciones documentadas)  
**Fecha:** 2026-08-01  
**Alcance:** presentación y UX del listado + detalle de inscripciones admin.  
**No modificado:** Prisma, APIs, rutas, permisos, lógica de inscripción/pago/acreditación/kit/placas/Resend/FotoRank.

---

## Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/admin/inscripciones` | Listado: filtros, chips, tabla reducida, cards mobile, empty/error copy |
| `/admin/inscripciones/[registrationId]` | Detalle: jerarquía, labels humanos, técnico colapsable, acciones renombradas |

Sin cambios de path ni navegación general.

---

## Componentes modificados

- `app/admin/(panel)/inscripciones/page.tsx`
- `app/admin/(panel)/inscripciones/[registrationId]/page.tsx`
- `components/admin/registrations/ItemFulfillmentForm.tsx`
- `components/admin/registrations/RegistrationTransitionButtons.tsx`
- `components/admin/registrations/RegistrationListMobileCard.tsx` (creado en esta etapa)
- `lib/admin-registration/domain/transitions.ts` (solo copy de efectos/labels)
- `scripts/admin-registrations-orders-ui.selfcheck.ts` (asserts UX)
- `package.json` (`test:admin-ux`)

---

## Componentes creados

| Componente | Rol |
|---|---|
| `lib/admin-registration/ui/admin-status-presentation.ts` | Capas admin de estados + síntesis operativa |
| `components/admin/AdminTechnicalInfo.tsx` | Bloque técnico colapsable (cerrado por defecto) |
| `components/admin/registrations/RegistrationFiltersPanel.tsx` | Filtros principales + “Más filtros” |
| `components/admin/registrations/RegistrationListMobileCard.tsx` | Tarjeta mobile del listado |
| `lib/admin-registration/ui/admin-status-presentation.test.ts` | Tests de presentación y contratos UI |

---

## Estados traducidos

Ver `admin-status-map.md`. Cobertura: inscripción, pago, kit, placa, publicación, correo/Resend, FotoRank, síntesis operativa.

---

## Columnas del listado

**Mantenidas (prioridad operativa):**

1. Participante (nombre, email, Instagram)
2. Estado general (síntesis)
3. Pago (+ monto)
4. Kit (+ talle)
5. Próxima acción
6. Fecha
7. Acciones → “Abrir”

**Movidas a detalle / técnico / exportación:**

- IDs / UUID
- Referencias de orden / payment order
- Soft refs FotoRank / welcome card IDs
- Documento (detalle)
- Holds / metadatos
- Historial completo

**Acreditación en listado:** no hay dato de check-in en el DTO; se indica “Se opera en sede” en la tarjeta mobile y copy del header.

---

## Estrategia móvil

- `AdminDataTable`: tabla `hidden md:block`; cards `md:hidden` con `mobileCard`.
- Una sola acción “Abrir inscripción” en la card (sin duplicar botones de la tabla).
- Filtros: búsqueda + edición visibles; resto en acordeón “Más filtros”.
- Detalle: una columna, botones `min-h-11` / `w-full` en mobile, sin `min-w-[640+]`.
- Kit: lista de tarjetas (no tabla ancha).

---

## Filtros modificados

- Misma query GET / mismos params.
- UI: principales vs secundarios; chips con labels humanos; “Limpiar filtros”; contador de activos.
- Options de status siguen enviando enums en `value` (necesario); labels visibles en español.

**Persistencia al volver del detalle:** el enlace “Volver” conserva `editionId`. Otros filtros se mantienen si el operador usa el botón Atrás del navegador. No se añadió `returnTo` completo para no cambiar contratos de navegación.

---

## Acciones renombradas

| Antes | Después |
|---|---|
| Regenerar | Volver a generar placa |
| Reintentar | Reintentar generación |
| Encolar placa | Generar placa |
| Reintentar envío | Reenviar confirmación |
| Sincronizar / reintentar | Sincronizar con FotoRank |
| (fulfillment genérico) | Marcar como entregado / Revertir entrega |
| Efectos con enums (`Pasa a CONFIRMED`) | Efectos en español operativo |

Transiciones destructivas siguen con `window.confirm` + motivo.

---

## Información técnica reubicada

Bloque `AdminTechnicalInfo` (cerrado por defecto): IDs de inscripción/usuario/edición/entrada/sede, referencias de cobro, reconciliación, mensaje de correo, FotoRank, foto/placa, SKUs, holds, fechas internas.

No incluye tokens, secretos ni payloads sensibles.

---

## Pruebas ejecutadas

Ver sección de resultados en la entrega final de la conversación (typecheck, lint, `test:admin-ux`, selfcheck, build).

---

## Resultados por resolución (validación de layout)

Validación estructural por código + breakpoints objetivo:

| Viewport | Resultado esperado |
|---|---|
| 320×568 | Listado en cards; filtros apilados; sin `min-w` obligatorio |
| 360×800 | Idem |
| 390×844 | Idem |
| 430×932 | Idem + más aire en chips |
| Desktop ≥768 | Tabla operativa reducida |

Limitación: no se abrió navegador real contra datos de producción (restricción).

---

## Fallas previas ajenas

- Webhook Resend de delivery events: ya documentado históricamente; copy admin ya no lo grita en mayúsculas.
- Código promocional no expuesto en DTO admin: solo descuento monetario.
- Build local: Prisma avisó `ClickatonEdition.coverImageVerticalUrl` inexistente en DB durante generación estática de páginas públicas; el build igual completó OK. Ajeno a esta etapa.

---

## Riesgos pendientes

1. Acreditación no visible como estado en el listado hasta enriquecer el DTO (fuera de alcance: no cambiar consultas).
2. Filtros distintos de edición no vuelven por el CTA “Volver al listado”.
3. `AdminDataTable` renderiza tabla y cards con CSS hide; `display:none` las saca del árbol a11y, pero conviene vigilar en futuras auditorías.
4. Brick/checkout público: fuera de esta implementación.

---

## Acción legal

Ninguna acción legal inmediata. Consentimientos / uso de imagen / licencia: no reescritos; `LEGAL_REVIEW` intacto.
