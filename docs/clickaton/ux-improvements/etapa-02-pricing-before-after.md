# Etapa 02 Imp. 07 — Antes / después (precios, promociones, productos)

Solo presentación. Los valores de negocio no cambian.

| Concepto | Antes (típico) | Después |
|---|---|---|
| Phase | “Pricing” / técnico | **Fases de precio** |
| Pricing rule | Metadato motor | Fuera de título; técnico si hace falta |
| Active | `ACTIVE` / “Activa” ambiguo | **Vigente** — se aplica ahora |
| Scheduled | Fechas crudas | **Programada** — comenzará en la fecha |
| Coupon | Promo / rule | **Código promocional** (`CLICK50`) |
| Redemption | Contadores crudos | “12 de 50 usos utilizados” |
| Variant | “Variante” dominante | **Talle u opción** |
| SKU | Columna principal | **Código interno (SKU)** / técnico |
| Fulfillment | Clave técnica | Fuera de listado comercial |
| Producto incluido | Relación poco clara | Lista “Incluye” en fase + composición de entrada |
| Talle | Variant name / SKU | Nombre del talle + panel “Talles y opciones” |
| Vigencia | ISO / UTC | Español + “Horario de la edición” |
| Precio actual | Texto suelto | Bloque **Precio actual** destacado |
| Próximo precio | “Próxima subida” técnico | Importe **tachado** si es mayor + “Precio promocional…” |
| Vista móvil | Tabla ancha | Cards / una columna |
| Información técnica | Mezclada | `AdminTechnicalInfo` cerrado |

## Ejemplo visual (precio)

**Antes:** “Fase inicial · $25.000 · next: 3000000”

**Después:**

- Precio actual: **$25.000** ~~$30.000~~
- Fase inicial · vigente hasta 10 de agosto…
- Desde … pasa a Fase general ($30.000).
- Helper: el tachado es la próxima fase; ahora cuesta menos.
