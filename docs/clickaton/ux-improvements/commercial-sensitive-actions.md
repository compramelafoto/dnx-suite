# Acciones comerciales sensibles (admin UX)

Documento de presentación. **No se crearon acciones nuevas.** No se ejecutaron cambios sobre fases/promos/productos de producción en esta etapa.

---

## Modificar / crear fase de precio

| Campo | Valor |
|---|---|
| Acción UI | “Crear fase” / “Guardar fase” |
| Consecuencia | Define importe y ventana para **nuevas** inscripciones cuando esté vigente |
| Riesgo | Alto si se edita una fase vigente |
| Confirmación | Copy + nota `COMMERCIAL_REVIEW`; habilitar/desactivar con confirm |
| Nuevas inscripciones | Sí, cuando la fase aplica |
| Inscripciones existentes | No se reescriben precios históricos por esta UI |
| Productos seleccionados | Relación de ítems de fase puede cambiar inclusiones futuras |
| Reversible | Sí vía nueva configuración / desactivar |
| Dependencias | `createPricePhaseAction`, ítems de fase |
| `COMMERCIAL_REVIEW` | Precios vigentes y beneficios por fase |

---

## Habilitar / desactivar fase

| Campo | Valor |
|---|---|
| Acción UI | “Habilitar fase” / “Desactivar fase” |
| Confirmación | `ConfirmSubmitButton` con texto de impacto en nuevas inscripciones |
| Nuevas inscripciones | Sí |
| Existentes | No |
| Reversible | Sí (rehabilitar) |

---

## Desactivar / rehabilitar código promocional

| Campo | Valor |
|---|---|
| Acción UI | “Desactivar código” / “Volver a habilitar” |
| Confirmación | Explica que no podrá usarse en nuevas inscripciones |
| Pagos ya hechos | No se afirma impacto |
| Reversible | Sí |

---

## Cambiar descuento / límites (formulario existente)

| Campo | Valor |
|---|---|
| Riesgo | Alto — altera campaña |
| Confirmación | No hay modal extra en create; edición limitada al flujo existente |
| `COMMERCIAL_REVIEW` | Límites, códigos a terceros, acumulabilidad no afirmada |

---

## Desactivar producto / variante / quitar de kit

| Campo | Valor |
|---|---|
| Acción UI | Desactivar producto; “Desactivar variante”; quitar ítem de composición |
| Confirmación | `confirm` en variantes; toggles existentes |
| Nuevas configs | Sí |
| Selecciones ya hechas | Pueden quedar inconsistencias operativas — soporte vía detalle inscripción |
| `COMMERCIAL_REVIEW` | Sustitución, stock, entrega |

---

## Elementos `COMMERCIAL_REVIEW`

- Modificación de precios vigentes
- Cambios retroactivos (no soportados por esta UI; no afirmar)
- Beneficios incluidos según fase
- Límites de promociones y códigos para terceros
- Venta separada de productos (todavía no tienda pública)
- Stock / falta de stock / sustitución
- Cambios de talle y condiciones de entrega
- Reembolsos asociados a productos
