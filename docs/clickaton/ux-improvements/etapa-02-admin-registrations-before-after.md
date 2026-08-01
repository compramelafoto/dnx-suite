# Antes / después — Admin inscripciones (Etapa 02 Imp. 02)

Ejemplos representativos de copy y presentación. No son capturas de pantalla.

---

## Tabla de escritorio

**Antes**

| Participante | Status | Payment | Order | FR | Welcome | Doc | … |
|---|---|---|---|---|---|---|---|
| uuid… / nombre | `CONFIRMED` | `APPROVED` | `pay_…` | `SYNCED` | `GENERATED` | •••• | |

Muchas columnas + IDs; scroll horizontal frecuente.

**Después**

| Participante | Estado general | Pago | Kit | Próxima acción | Fecha | Acciones |
|---|---|---|---|---|---|---|
| Lucía Fernández · email · @ig | Todo listo | Pago acreditado · $X | Entregado · Talle M | Operá acreditación… | 01/08/2026… | Abrir |

---

## Tarjeta móvil

**Antes:** misma tabla con `min-w-[640–880px]` → scroll horizontal obligatorio.

**Después:**

```
Lucía Fernández
lucia@mail.com
@luciafoto

[Todo listo] [Pago acreditado] [Kit pendiente]

Pago              Acreditación
Pago acreditado   Se opera en sede

La inscripción está confirmada…
Próximo paso: Entregá el kit en sede…

N.º 1042 · Inscripta 01/08/2026 · Talle M

[ Abrir inscripción ]
```

---

## Filtros

**Antes:** fila densa de selects (edición, estado, pago, sede, ticket, fechas, notes, order…).

**Después:**

- Siempre visibles: Edición + Buscar participante  
- Chips: “Pago pendiente”, “Kit sin entregar” (labels humanos)  
- Botón “Más filtros (N filtros activos)” / “Ocultar filtros”  
- “Aplicar filtros” · “Limpiar filtros” · exportaciones

---

## Encabezado del detalle

**Antes**

- Título: `Lucía Fernández`  
- Descripción: `email · editionId · ticketTypeId`  
- Badges + “Volver”

**Después**

- Título: `Inscripción de Lucía Fernández`  
- Descripción: “Revisá el estado del pago, la acreditación y los datos…”  
- Badges de síntesis + pago · edición · entrada  
- “Volver al listado” · “Ir a acreditación”

---

## Estado de pago

**Antes:** “Comercial (soft refs DNX Payments)” + centavos crudos + IDs enmascarados como contenido principal.

**Después:**

- Estado (badge)  
- Total / Subtotal / Descuento  
- Fecha de confirmación / medio  
- Alertas humanas si `MANUAL_REVIEW` o `PROCESSING`  
- IDs → Información técnica

---

## Acreditación

**Antes:** no había bloque claro; jerga de check-in mezclada en otros módulos.

**Después:** bloque que explica que el check-in se opera en el módulo de sede + CTA “Abrir módulo de acreditación”. Sin cambiar la lógica de acreditación.

---

## Entrega del kit

**Antes:** tabla `min-w-[640px]` con SKU, enums `PENDING`, “user #…”.

**Después:** tarjetas por producto:

- Producto · Talle · Cantidad  
- Estado de entrega (español)  
- “Marcar como entregado” / “Revertir entrega” (+ confirmación)  
- SKU en Información técnica

---

## Acciones

| Antes | Después |
|---|---|
| Regenerar / Reintentar / Encolar placa | Volver a generar / Reintentar generación / Generar placa |
| Reintentar envío | Reenviar confirmación |
| Sincronizar / reintentar | Sincronizar con FotoRank |
| “Pasa a CONFIRMED” en confirm | “La inscripción quedará confirmada” |

---

## Información técnica

**Antes:** IDs, Resend ID, FotoRank participant, SKUs visibles en bloques principales.

**Después:** sección colapsable “Información técnica” (cerrada por defecto) con etiquetas comprensibles + Copiar.

---

## Estados vacíos

| Caso | Antes | Después |
|---|---|---|
| Sin datos | genérico / vacío técnico | “No hay inscripciones todavía…” |
| Filtros sin match | mismo empty | “No encontramos resultados…” + Limpiar |
| Error carga | mensaje crudo posible | “No pudimos cargar las inscripciones…” |

---

## Errores

**Antes:** posible jerga (`Unauthorized`, stack, enums en mensajes).

**Después:** mensaje humano primario; detalle técnico secundario si ya venía en `message`; transitions enmascaran “desde estado ENUM”.
