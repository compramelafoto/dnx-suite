# Alboom CRM → FOTOFFICE: mapa general, equivalencias y plan de migración

> Fecha: 2026-09-29 · Estado: **relevamiento terminado (análisis del código), sin verificar en vivo, sin una línea de código.**
> Objetivo: que DNX Estudio pase de Alboom CRM (`dnxfotografia.alboomcrm.com`) a FOTOFFICE sin perder
> datos ni la forma de trabajar: mismos conceptos, mismo circuito, estructura mejorada y nombres propios.

## Cómo está hecho este relevamiento

- Se descargó el código público del panel de Alboom (AngularJS 1.x, `alboomcrm.min.js`, 1 MB) y sus
  **443 plantillas de pantalla**. De ahí salen **~300 rutas**, **36 recursos** con **306 operaciones de API**
  y el diccionario inglés→español de la interfaz (3229 textos). Nada de eso contiene datos de clientes.
- Seis análisis por módulo, cada uno con cita de la plantilla o función de origen:

| Documento | Cubre |
|---|---|
| [01-oportunidades-y-contactos.md](01-oportunidades-y-contactos.md) | Oportunidades, embudos (kanban), contactos, formulario web, seguimiento, etiquetas, notas |
| [02-presupuestos-pedidos-productos.md](02-presupuestos-pedidos-productos.md) | Presupuestos, pedidos (y pedido rápido), productos, paquetes, lista de precios, facturas |
| [03-contratos-proyectos-agenda.md](03-contratos-proyectos-agenda.md) | Contratos con firma, proyectos, flujos de trabajo, calendario/citas, Área de Clientes |
| [04-finanzas-e-informes.md](04-finanzas-e-informes.md) | A cobrar, a pagar, bancos y cajas, conciliación, plan de cuentas, clases, informes |
| [05-configuracion-y-transversales.md](05-configuracion-y-transversales.md) | Las 33 pantallas de Ajustes, planes, usuarios y permisos, plantillas, menú, widgets, listados |
| [06-galerias-de-prueba-y-apps.md](06-galerias-de-prueba-y-apps.md) | Galerías de prueba del CRM — **descartadas como modelo** (sistema viejo); sólo referencia |
| [07-alboom-proof.md](07-alboom-proof.md) | **Alboom Proof** (proof.alboompro.com): el modelo para la galería propia de FOTOFFICE |
| [08-dnx-flux.md](08-dnx-flux.md) | DNX FLUX: copia de tarjetas, huellas, respaldo en R2, Aftershoot, publicación y Drive; propuesta de integración |
| [09-configuracion-real-dnx.md](09-configuracion-real-dnx.md) | Configuración real de DNX Estudio leída de las pantallas de Ajustes (embudos, flujos, categorías, plan de cuentas…) |

- Los documentos citan números de línea de una copia formateada de `app.js` que quedó fuera del repo
  (es código de un tercero). Si hace falta re-verificar algo, se vuelve a descargar de
  `https://dnxfotografia.alboomcrm.com/js/alboomcrm.min.js` y se formatea con prettier.
- **Falta**: verificar en vivo ~90 dudas (listadas al final de cada documento) y leer los datos reales
  de DNX Estudio (embudos, etapas, productos, plantillas, volúmenes). Ver §6.

## 1. Cómo funciona Alboom, en una página

```
Contacto ──► Oportunidad ──► Presupuesto ──► PEDIDO ──┬─► Contrato (firma online)
 (cliente)   (embudo+etapa)   (enlace público)  │       ├─► Proyecto (flujo de etapas y tareas)
                                                │       ├─► Cita en la agenda
                                                │       ├─► Cuentas a cobrar (plan de cuotas)
                                                │       └─► Cuentas a pagar (costos del producto)
                                                └─ el PRODUCTO define qué se crea solo
```

1. **El Pedido es el centro.** Al pasar a *Venta Completada* (estado 475) el servidor genera las cuotas a
   cobrar, los costos a pagar, el proyecto y la cita, según lo que diga cada **Producto** (precio mínimo,
   costos-plantilla con días desde el evento, "añadir proyecto" con flujo y responsable, "añadir cita").
2. **Un solo mecanismo de etapas** sirve para tres cosas: Embudos de venta, Flujos de trabajo de proyecto y
   Tareas de pedidos. Cada etapa tiene duración en días y tareas modelo; al entrar a una etapa se fija la
   fecha límite (hoy + duración), se crean sus tareas y queda registro en el historial.
3. **El "grupo" de la categoría** (Boda, Evento, Trabajo con fecha, Trabajo sin fecha) decide qué campos
   se piden en oportunidades y pedidos (novios, lugares, invitados, fecha del evento).
4. **Finanzas es partida doble simplificada**: un libro de asientos (`account_trans`) con plan de cuentas
   (1.1 bancos y cajas, 1.2 a cobrar, 2.1 a pagar, 3 ingresos, 4 costos, 5 gastos) y *clases* como centros
   de costo. Cada cobro genera recibo con enlace público.
5. **Todo es configurable desde Ajustes** (33 pantallas, sólo administrador): embudos, flujos, categorías,
   orígenes, métodos de pago, plan de cuentas, numeración, 21 correos del sistema con variables
   `[variable]` y bloques condicionales, plantillas de WhatsApp, contratos con ~110 variables, campos extra
   (fijos: 4 de texto y 2 de fecha por entidad), Área de Clientes (9 interruptores).
6. **Listados uniformes**: filtros en la URL y recordados en el navegador, búsqueda al escribir, 10/25/50/100
   filas, panel de detalle al costado, acciones masivas (fechas, prioridad, finalizar, usuarios, etiquetas,
   embudo, borrar), CSV (sólo admin), impresión Resumen/Detallado.
7. **Fichas uniformes**: todas llevan los mismos componentes — Etiquetas, Notas, Mensajes, Actividad,
   Relacionados, Adjuntos, Progreso.
8. **Permisos**: Administrador, Usuario (permisos por módulo con Crear/Borrar), Independiente y Contacto
   (cliente en el portal). Interruptor "sólo lo propio" que filtra todos los listados.
9. **No tiene** buscador global, motivos de pérdida (el motivo *es* el estado), aceptación del presupuesto
   por el cliente, automatizaciones configurables ni envío real de WhatsApp (sólo abre `wa.me`).

## 2. Equivalencias: nombre en Alboom → nombre propuesto en FOTOFFICE

Los nombres son **propuesta para decidir**. Criterio: palabras que usa un fotógrafo argentino, sin chocar
con módulos que FOTOFFICE ya tiene (Clientes, Caja, Ventas de mostrador, Coberturas, Reservas).

| Alboom | FOTOFFICE (propuesta) | Base en FOTOFFICE hoy | Nota |
|---|---|---|---|
| Contactos | **Contactos** (clientes, proveedores, colaboradores) | `Client` (módulo Clientes) | Ampliar `Client` con tipo, relaciones y fechas especiales |
| Oportunidades | **Consultas** | Spec del 14/09 (`FotofficeConsulta`) + `ServiceSalesLead` | Ya decidido en el spec de Presupuestos |
| Embudos de venta | **Circuitos de venta** | — | Con el motor único de etapas |
| Presupuestos | **Presupuestos** | Spec del 14/09 + `cuanto-cobro-core` | Sumar aceptación online (Alboom no la tiene) |
| Presupuesto estándar | **Propuesta modelo** | — | Correo con adjuntos por categoría |
| Pedidos | **Pedidos** (decidido 29/09) | — | Mismo nombre que en Alboom |
| Pedido rápido | **Venta de mostrador** | Módulo `sales` (PR 156) | Ya existe: se unifica |
| Productos y paquetes | **Catálogo** (servicios, productos, combos) | — | Con costos-plantilla y "qué crea al venderse" |
| Contratos | **Contratos** | — | Firma online sin cuenta, con evidencia |
| Proyectos | **Proyectos** (decidido 29/09: no "Trabajos") | Spec E3 (sin diseñar); Coberturas como referencia | |
| Flujos de trabajo | **Flujos de trabajo** | — | Mismo motor de etapas |
| Tareas de pedidos | **Checklist del pedido** | — | Mismo motor de etapas |
| Calendario / Citas | **Agenda** | Reservas + sincronización Google Calendar | Capas: citas, proyectos, consultas, vencimientos, tareas, cumpleaños |
| Galerías de prueba (CRM) y Alboom Proof | **Galería FOTOFFICE** (selección, entrega, aprobación de álbum) | Subida directa a R2 de FotoRank; DNX FLUX | **Decidido 29/09: va en FOTOFFICE** (no son para la venta). Modelo: Alboom Proof, no las pruebas del CRM |
| Cuentas a cobrar | **Cobranzas** | `MembershipCharge` (sólo socios) | Nuevo, genérico para contactos |
| Cuentas a pagar | **Pagos a proveedores** | — | |
| Cuentas bancarias | **Caja y bancos** | Módulo `cash` (`CashAccount`) | Sumar conciliación |
| Plan de cuentas | **Rubros** (ingresos, costos, gastos) | `CashCategory` (plana) | Sumar jerarquía |
| Clases | **Unidades de negocio** | — | Centros de costo (bodas, escolar, 360…) |
| Informes | **Informes** | Reporte de Caja | Resultados, flujo de caja, ventas, embudo, IVA |
| Área de Clientes | **Portal del cliente** | `Client.userId` reservado | Enlace seguro, sin contraseña débil |
| Ajustes | **Configuración** | `/workspace/configuracion` | |
| Campos extra | **Campos personalizados** | — | Genéricos, sin tope de 4+2 |
| Numeración de tablas | **Numeración** | Correlativos fijos por tabla | Genérica, con prefijo y año |

## 3. Qué se mejora (estructura), sin cambiar la forma de trabajar

Detalle en la sección "Mejora propuesta" de cada documento. Las decisiones de fondo:

1. **Motor único de etapas** (circuitos de venta, flujos de trabajo, checklists): etapas con
   identificador propio —no posición, que en Alboom rompe todo al reordenar—, duración, tareas modelo,
   historial con tiempo en cada etapa.
2. **Listado estándar reutilizable** (hoy FOTOFFICE arma cada tabla a mano): filtros en URL, búsqueda,
   paginación, orden, acciones masivas, CSV, impresión, vistas guardadas. Se construye una vez y lo usan
   todos los módulos.
3. **Ficha estándar** con línea de tiempo única por contacto (consultas, presupuestos, pedidos,
   cobros, mensajes y notas en un solo lugar), etiquetas, notas, adjuntos, relacionados.
4. **Estados explícitos** donde Alboom los deduce: presupuesto (borrador/enviado/visto/aceptado/rechazado/
   vencido), contrato (enviado/visto/firmado/objetado), motivos de pérdida en catálogo aparte del estado.
5. **Automatizaciones** configurables (disparador → condición → acción) en lugar de reglas fijas.
6. **Plantillas** de correo y WhatsApp editables con las mismas variables para todos los canales.
7. **Buscador global** (ya diseñado en DNX: ⌘K) sobre contactos, consultas, pedidos y proyectos.
8. **Argentina**: Mercado Pago con aviso automático de pago y comisión, transferencias con comprobante,
   factura ARCA; se descarta lo brasileño (boletos, PagSeguro).
9. **Seguridad**: validar todo en el servidor (Alboom compara códigos de acceso en el navegador, borra
   archivos desde el navegador y su "quicklogin" usa el identificador como contraseña).
10. **Errores documentados de Alboom (~70)** que no se copian: listados al final de cada documento.

## 4. Orden de construcción propuesto

Cada etapa se diseña, se prueba y se publica por separado; las tablas siempre antes que el código.

| Etapa | Contenido | Depende de |
|---|---|---|
| 0 · Cimientos | Listado estándar, ficha estándar y línea de tiempo, motor de etapas, campos personalizados, numeración, plantillas, permisos por módulo con "sólo lo propio" | — |
| 1 · Contactos y Consultas | Contactos ampliados, Consultas, Circuitos de venta (tablero kanban), formulario web, seguimiento, importación | 0 |
| 2 · Catálogo y Presupuestos | Servicios, productos, combos, costos-plantilla; presupuestos con enlace y aceptación (spec del 14/09 + ¿Cuánto Cobro?) | 1 |
| 3 · Pedidos y Cobranzas | Pedido con plan de cuotas; cobranzas y pagos; Caja y bancos ampliada con rubros, unidades de negocio y conciliación; recibos | 2 |
| 4 · Proyectos y Agenda | Proyectos con flujos de etapas creados desde el pedido; agenda con capas y Google Calendar | 3 |
| 5 · Contratos | Plantillas con variables, firma online con evidencia | 3 |
| 6 · Informes | Resultados, flujo de caja proyectado, ventas, embudo de consultas, IVA | 3 |
| 7 · Galería FOTOFFICE y DNX FLUX | Galería propia al estilo Alboom Proof (selección, entrega, aprobación de álbum); DNX FLUX publica por API con clave de dispositivo y sube directo a R2; material del proyecto con respaldo y verificación visibles; portal del cliente | 4, 5 |
| 8 · Migración | Ensayo completo en base de prueba, verificación, migración definitiva y corte | 1–6 |

El Asistente de ventas (rama `feat/fotoffice-asistente-ventas`) hoy lee Alboom; después de la migración
pasa a leer las Consultas propias de FOTOFFICE.

## 5. Plan de migración de datos

**Principio:** una sola migración definitiva al final, precedida de ensayos en una rama de base de datos
de prueba. Mientras tanto se sigue trabajando en Alboom. Nada se escribe en Alboom.

1. **Extraer** todo de Alboom en archivos (JSON/CSV) guardados fuera del repo: contactos, oportunidades con
   historial de etapas, notas, actividades y correos, presupuestos, pedidos con ítems, plan de pagos y
   costos, contratos (texto y evidencia de firma), proyectos con progreso, citas, cuentas a cobrar y a
   pagar con sus cobros, bancos y movimientos, productos, configuración completa, adjuntos.
2. **Traducir** con tablas de equivalencia explícitas:
   - Estados de oportunidad 421 Abierto, 422 Ganado, 423 Suspendido, 424 Abandonado, 425 Perdido,
     426 Fecha no disponible.
   - Estados de pedido 471 Abierto, 474 Cancelado, 475 Venta Completada, 476 Pedido Rápido.
   - **Etapas guardadas por posición**: traducir posición → etapa con la configuración del embudo o flujo
     *al momento de extraer*; revisar a mano las que hayan quedado fuera de rango.
   - Asientos por `category_id` (71 débito, 72 depósito, 73 pedido, 74 transferencia, 81/82 manuales,
     83/84 cobro/pago) y plan de cuentas.
   - Fechas en hora de Argentina; `created` de presupuestos no es confiable (Alboom lo pisa al editar).
3. **Cargar** con un script idempotente: cada registro guarda su identificador de Alboom, así se puede
   repetir la carga sin duplicar.
4. **Verificar** con conciliaciones automáticas: cantidades por entidad, totales vendidos por mes, saldo de
   cada banco y total a cobrar y a pagar deben coincidir con los informes de Alboom.
5. **Corte**: congelar Alboom un día, última extracción incremental, activar FOTOFFICE, dejar Alboom en
   sólo lectura unos meses como respaldo.

## 6. Pendiente para seguir (necesita decisión de Daniel)

1. **Leer los datos y la configuración reales de DNX Estudio.** El intento de leerlos llamando por dentro
   a la API de Alboom desde el navegador fue bloqueado por el control de seguridad. Caminos posibles:
   - navegar las pantallas de Ajustes y leer lo que muestran (para la configuración);
   - exportar los CSV que Alboom permite (contactos, oportunidades, pedidos, productos, finanzas);
   - usar la integración del Asistente de ventas, que ya guarda la credencial de Alboom cifrada con
     autorización del 28/09, para un extractor que corra del lado del servidor;
   - habilitar el permiso correspondiente en la configuración de Claude Code.
2. ~~Nombres~~: decidido *Pedidos*. Los demás nombres de §2 quedan como propuesta.
3. ~~Alcance de galerías~~: decidido, en FOTOFFICE, modelo Alboom Proof + DNX FLUX. Quedan las preguntas de §7.
4. **Verificar en vivo** las ~90 dudas de los seis documentos antes de diseñar cada etapa.

## 7. Galería FOTOFFICE: decisiones (29/09/2026)

1. **Drive** se sigue usando por ahora como entrega, en paralelo.
2. A la galería van **las fotos que el fotógrafo eligió para entrega** en Aftershoot (4, 5 estrellas o ambas: lo que se exportó a Entregas).
3. **Dos versiones en R2**: una liviana para ver (~2000 px) y el original en alta para descargar con enlace firmado. Entregas en un prefijo/bucket separado de los crudos (los crudos mantienen su regla de 180 días; la retención de entregas se define aparte).
4. Las galerías ya publicadas en Proof **se migran**, igual que los datos del CRM, recién cuando todo funcione perfecto.
5. La galería se ata al **Proyecto** de fotografía, que pertenece a un **Pedido** (un pedido puede tener varios proyectos: foto, video, fotolibro).
6. DNX FLUX **se usará en Windows**: hay que calibrar Aftershoot ahí.
7. No se venden fotos desde la galería. La venta, cuando exista, es a través de **CompraMeLaFoto** como brazo de venta de FOTOFFICE.
