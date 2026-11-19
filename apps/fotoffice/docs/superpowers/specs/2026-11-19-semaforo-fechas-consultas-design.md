# Semáforo de fechas en las consultas (diseño corto)

Fecha: 18 y 19/11/2026. Daniel lo pidió «como en Alboom CRM» y aclaró que DNX cubre hasta dos eventos por día.

## Qué muestra

Un punto de color junto a la fecha del evento. Al pasar el mouse se lee el detalle.

- 🔴 **Rojo:** ese día ya hay tantos eventos contratados como los que el estudio puede cubrir.
- 🟡 **Amarillo:** queda lugar, pero ya hay algún evento contratado u otras consultas abiertas para ese día.
- 🟢 **Verde:** no hay nada más ese día.

Aparece en tres lugares:

- las tarjetas del tablero de Consultas;
- la columna «Fecha del evento» del listado (y su exportación);
- una línea arriba de la ficha de la consulta.

Sólo lo llevan las consultas abiertas que tienen fecha. Tampoco lo llevan las de categorías que no piden fecha (R11).

## Reglas (decisiones mías, Claude)

- **Evento contratado:** un pedido no cancelado con esa fecha, o una consulta ganada sin pedido (por ejemplo, cobrada por fuera). Una consulta ganada que tiene pedido cuenta una sola vez.
- **Otras consultas:** las abiertas (Nueva, Contactada, Presupuestada, Interesada) con el evento el mismo día. Es el mismo criterio que el aviso de fecha superpuesta que ya existía.
- Una consulta nunca se cuenta a sí misma.

## Tope configurable

- Se configura en Configuración → Consultas → Avisos → «Eventos que podés cubrir el mismo día».
- Va de 1 a 20 y por omisión es 1.
- Se guarda en la columna nueva `FotofficeConsultaAjustes.eventsPerDay` (migración `20270214090000_fotoffice_consultas_eventos_por_dia`).
- La migración se aplicó y se registró el 19/11 en la base de FOTOFFICE, que es la única que tiene esa tabla.
- DNX Estudio quedó en 2.

## Enfoques

1. **Calcularlo al leer (elegido):** siempre está al día y no hay nada que mantener.
2. Guardarlo en cada consulta: queda viejo apenas se confirma o se cancela un pedido.
