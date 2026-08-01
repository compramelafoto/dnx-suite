# Mapa de estados comerciales (presentación)

Fuente: `lib/admin/pricing/ui/commercial-status-presentation.ts`  
**No son estados persistidos nuevos.** Derivan de `isActive` + fechas (+ usos en promos).

---

## Fases de precio

| Interno / clave | Etiqueta | Descripción | Variante | Próxima acción | Visible | Vigente | Editable | Atención | Pantallas |
|---|---|---|---|---|---|---|---|---|---|
| `inactive` | Desactivada | No puede usarse en nuevas inscripciones | neutral | Habilitar fase | No | No | Sí | No | Precios |
| `scheduled` | Programada | Comenzará en la fecha indicada | accent/info | Revisar precio y productos | Sí | No | Sí | No | Precios |
| `active` | Vigente | Se aplica actualmente | success | — | Sí | Sí | Sí | No | Precios, wizard |
| `expired` | Finalizada | Período terminado | neutral | — | No | No | Sí | No | Precios |

Casos no contemplados como estado propio: hueco sin fase (se muestra “Sin precio vigente”); solape (alerta aparte, no un badge).

---

## Promociones

| Clave | Etiqueta | Descripción | Visible | Vigente | Atención |
|---|---|---|---|---|---|
| `promo_inactive` | Desactivada | No usable en nuevas inscripciones | No | No | watch |
| `promo_scheduled` | Programada | Fuera de vigencia (aún no empezó) | Sí | No | watch |
| `promo_expired` | Finalizada | Vigencia terminada | No | No | ok |
| `promo_exhausted` | Agotada | Límite de usos alcanzado | No | No | action |
| `promo_available` | Disponible | Puede usarse según reglas | Sí | Sí | ok |

Descuento (no es estado): `PERCENTAGE` → “X % de descuento”; `FIXED_AMOUNT` → “$… de descuento” (pueden quedar otros cargos).

---

## Producto / tienda

| Interno | Etiqueta | Notas |
|---|---|---|
| `isActive` true/false | Activo / Inactivo | Catálogo operativo |
| `DRAFT` | En preparación | Venta separada no lista |
| `ACTIVE` (store) | Disponible para venta separada | No implica tienda pública |
| `OUT_OF_STOCK` | Sin stock | Atención |
| `HIDDEN` | Oculto | — |
| `ARCHIVED` | Archivado | Menos editable |

---

## Precio compare (síntesis)

| Flag | Significado UI |
|---|---|
| `showNextStruck` | Próximo precio tachado porque `next.amount > current.amount` |
| Sin current | “Sin precio vigente” |
| Next sin struck | “Próximo cambio” sin tachado |

---

## `COMMERCIAL_REVIEW`

Cualquier comunicación externa de precios/beneficios/promos tras cambiar configuración vigente.
