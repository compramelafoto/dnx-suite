# Rediseño UX/UI del proceso de ventas — etapa 1: la ficha de la consulta

Fecha: 21/11/2026 · Pedido de Daniel: «visualmente es un lío… que pueda entrar al cliente, editar
datos y entrar a la ficha general de clientes… pensalo como una modificación íntegra de todas las
ventanas del proceso de ventas».

## Por qué

La ficha de la consulta es la pantalla donde la vendedora trabaja cada oportunidad. Hoy:

- El **cliente** (la persona a la que hay que venderle) está escondido al final, dentro del
  desplegable «Contacto y mensaje». Para llamarlo, escribirle o editarlo hay que buscarlo.
- El **título** repite datos («Consulta N° 2026-0041 · Consulta XV (3413 07-1917)») y es enorme.
- El **recorrido** son pastillas de colores sueltas: no se lee en qué paso está ni cuánto falta.
- **Ganada** usa el color principal (naranja), el mismo de cualquier acción: no se distingue del
  resto. **Perdida** es un bloque rojo sólido del mismo peso: invita a tocarlo sin querer.
- Los datos de la consulta son una sola columna larga de «término / valor».
- El **mensaje del cliente** (lo que pidió) está plegado.

## Objetivo

Que en 3 segundos se vea: **quién es, qué quiere, en qué paso está, qué hay que hacer ahora**, y
que contactar o editar al cliente esté a un toque.

No-objetivos: no se cambian reglas de negocio, permisos ni datos guardados; no hay migraciones.
Anti-objetivo: perder una función que hoy existe (toda acción actual sigue disponible).

## Enfoques considerados

1. **Reacomodar la misma página (elegido).** Encabezado nuevo, recorrido como barra de pasos,
   columna lateral fija con la tarjeta del cliente, contenido principal en dos columnas. Reutiliza
   los componentes y acciones existentes: bajo riesgo, se entrega rápido.
2. Abrir la consulta como panel lateral sobre el tablero (sin salir de la bandeja). Más moderno,
   pero rompe enlaces, la vista incrustada en la ficha del cliente y el botón «atrás»: mucho riesgo.
3. Fusionar consulta y ficha del cliente en una sola pantalla. Duplica la ficha del cliente, que ya
   tiene su propio diseño y permisos distintos (Clientes vs Consultas).

## Diseño (decisiones mías, corregibles)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Consultas   N° 2026-0041 · Vencida                                        │
│ Consulta XV                                         [WhatsApp] [Bot] [⋯]   │
│ Fotografía o Video de Cumpleaños de 15 · 12/03/2027 · ● Fecha libre         │
├────────────────────────────────────────────────────────────────────────────┤
│ ①──②──●③──④──⑤──⑥   Coordinar entrevista (paso 3 de 6)                     │
│ Responsable [Giuli ▾]   Vence 17/11 (vencida) Cambiar   [✓ Ganada] [Perdida]│
├───────────────────────────────────────────────┬────────────────────────────┤
│ Lo que pidió (mensaje del cliente)            │ CLIENTE                    │
│ Datos de la consulta (2 columnas)             │ (CX) Consulta XV           │
│ Tareas                                        │ 📞 3413 07-1917  💬 ✉       │
│ Cotizaciones · pedidos · proyectos · citas    │ etiquetas                  │
│ Participantes ▸  Más datos ▸  Historial ▸     │ Notas (3)  + Agregar nota  │
│                                               │ [Editar datos] [Ver ficha] │
└───────────────────────────────────────────────┴────────────────────────────┘
```

- **Encabezado**: título = nombre de la consulta (sin repetir el número); arriba, en chico, el
  número y el estado (Vencida / Ganada / Perdida). Debajo: categoría, fecha del evento y semáforo
  en una sola línea. Acciones: WhatsApp (si hay teléfono), Bot, Volver.
- **Recorrido**: barra de pasos numerados con línea de progreso; los pasos anteriores quedan
  marcados como hechos, el actual resaltado con su nombre y «paso N de M». Se sigue pudiendo tocar
  un paso para mover (con nota opcional). Responsable y vencimiento en una fila compacta.
  **Ganada en verde** (éxito) y **Perdida con borde rojo** (menos peso), a la derecha.
- **Tarjeta del cliente** (columna derecha, fija al hacer scroll en pantallas grandes): iniciales,
  nombre, teléfono con botón de llamar y WhatsApp, correo, etiquetas, las últimas notas con
  «Agregar nota» (la misma ventana de notas del tablero), y dos botones: **Editar datos** (abre la
  ficha del cliente con el formulario ya abierto) y **Ver ficha completa**.
- **Contenido principal**: el mensaje que dejó el cliente a la vista; datos de la consulta en
  grilla de 2 columnas; tareas; lo relacionado (cotizaciones, pedidos…) y los desplegables de
  siempre al final.
- En celular todo va en una columna: encabezado, recorrido, cliente, resto.

## Lo que queda para las próximas etapas

Mismo lenguaje visual en: tablero (tarjeta ya mejorada con notas), modo lista, alta de consulta,
ficha del cliente y ficha del proyecto.
