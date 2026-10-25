# Cómo conviven todos los módulos de FOTOFFICE según el tipo de workspace

> 29/09/2026 · Complementa `2026-09-29-fotoffice-como-producto.md` y el mapa de Alboom (`docs/alboom/`).
> Propuesta para decidir; no hay código.

## 1. Cómo es hoy

- Hay un catálogo único de módulos (`lib/modules/registry.ts`) con dos categorías, GENERAL e
  INSTITUTIONAL, y cada workspace tiene encendidos los suyos en `WorkspaceFeatureModule`. **Los enciende
  el Super Admin, módulo por módulo.**
- La portada (`lib/landing/tipos.ts`) ya pregunta **qué tipo de organización sos** (7 tipos: freelance,
  local, escuela, sociedad, agrupación, ONG, espacio) y sugiere 3 módulos destacados + "además". Pero esa
  respuesta **no queda guardada en el workspace** ni decide qué se enciende: sólo orienta la portada.
- `FotofficeWorkspaceBranding.activityType` guarda otra cosa (independent | studio | agency).
- Palabras configurables: sólo "persona/personas" (socio, voluntario, alumno…).

## 2. La idea: un núcleo común + familias de módulos

Todos los workspaces comparten el **núcleo**. Encima, cada uno enciende las **familias** que le sirven.
El tipo de organización **sugiere** un paquete al crear el workspace, pero **no prohíbe**: DNX Estudio
es un negocio, pero también da Workshops (Formación); una sociedad puede alquilar su salón (Espacios).

| Capa | Módulos | Quién la usa |
|---|---|---|
| **Núcleo (todos)** | Contactos (hoy Clientes, ampliado) · Caja y Cobranzas · Agenda · Correos y plantillas · Equipo y permisos · Sitio web · Portal · Informes básicos · Configuración | Todos |
| **Negocio fotográfico** | Consultas y circuitos de venta · Catálogo · Presupuestos · Pedidos · Contratos · Proyectos · Galería · DNX FLUX · Finanzas completas · Asistente de ventas · Venta de mostrador | Freelance, estudio, productora, local |
| **Institución** | Socios · Cuotas · Carnets · Sorteos · Recomendados · (Gobierno, Muestras, Transparencia: planificados) | Sociedad, asociación, agrupación, ONG |
| **Coberturas y voluntariado** | Solicitudes y Coberturas · convocatorias · equipo · entregables | ONG tipo FOTOPOSITIVA; también un estudio que subcontrata |
| **Formación** | Cursos · Evaluaciones | Escuela, sociedad, estudio que da talleres |
| **Espacios** | Reservas (salas, equipamiento, tarifas socio / no socio) | Local, espacio, sociedad con sede |

## 3. Las piezas que se comparten (lo que hace que sea UN sistema y no seis)

1. **Un solo Contacto por persona u organización.** Hoy existen `Client` y `Member` por separado (ya
   unidos por `Client.memberId`). La regla: toda persona es un **Contacto**; ser socio, voluntario,
   alumno, cliente o proveedor son **roles** de ese contacto. Así un socio de SFPR que contrata una
   cobertura, o un alumno que después pide un presupuesto, tiene una sola ficha con toda su historia.
2. **Una sola Cobranza.** La cuota del socio (`MembershipCharge`), la cuota de un pedido, la inscripción
   a un curso y el pago de una reserva son lo mismo: **algo que alguien debe, con vencimiento, que se
   cobra por Mercado Pago o a mano y entra a Caja**. Un único módulo de Cobranzas, con el origen como
   dato (cuota societaria, pedido, curso, reserva). Recibos, recordatorios e informes se hacen una vez.
3. **Una sola Agenda.** Reservas de salas, citas de pedidos, eventos de proyectos, coberturas, clases
   de cursos y sorteos aparecen en el mismo calendario como capas, con sincronización a Google Calendar
   (que hoy sólo tiene Reservas).
4. **Un solo motor de etapas.** Circuitos de venta, flujos de proyecto, checklist de pedidos… y también
   el recorrido de una **Cobertura** (recibida → evaluación → convocatoria → equipo → realizada →
   entregada), que hoy está escrito a mano. Con el motor común, una ONG puede ajustar sus etapas igual
   que un estudio ajusta su embudo.
5. **Una sola Galería.** Sirve para la entrega de un pedido, para los **entregables de una cobertura**
   (FOTOPOSITIVA entrega fotos a la ONG que las pidió) y para **Muestras** de una sociedad.
6. **Una sola bandeja de entrada.** El formulario de presupuesto (`ServiceSalesLead`), el pedido de
   cobertura (`CoverageRequest`), la solicitud de ingreso de un socio y la consulta por un curso son
   **consultas** con distinto destino. Se ven juntas y cada una sigue su circuito.
7. **Un solo Portal.** La misma persona entra y ve lo suyo en cada workspace donde tenga un rol: su
   carnet y cuotas de SFPR, sus convocatorias de FOTOPOSITIVA, y la galería y el contrato de su
   casamiento con DNX Estudio.
8. **Palabras por workspace.** Extender `WorkspaceVocabulary` a más términos: socio/voluntario/alumno,
   cliente/organización, pedido, proyecto, cobertura. Coberturas ya tiene sus propios términos: se
   unifican ahí.

## 4. Cómo se habilita

1. **Al crear el workspace**, la pregunta de la portada ("¿qué sos?") **se guarda** como tipo de
   organización y enciende el **paquete sugerido** (núcleo + familias del tipo). Se ve antes de confirmar
   y se puede destildar.
2. **Configuración → Módulos**, para el dueño o administrador (hoy sólo lo hace el Super Admin): encender
   o apagar familias y módulos sueltos, con el motivo de cada uno escrito para su tipo (lo que ya hace la
   portada).
3. **Dependencias explícitas**: Cuotas necesita Socios; Pedidos necesita Contactos y Catálogo; Galería
   necesita Proyectos o Coberturas; Carnets necesita Socios. Encender uno ofrece encender lo que falta;
   apagar uno avisa qué deja de funcionar. **Apagar nunca borra datos**: los oculta.
4. **El menú se arma por familias**, en el orden del tipo: una sociedad ve primero Socios y Cuotas; un
   estudio ve primero Consultas y Pedidos.
5. **El plan comercial limita, el tipo sugiere.** Son dos cosas distintas: el tipo decide qué se propone;
   el plan (Fotógrafo, Estudio, Productora, Institución) decide cuánto se puede usar.

## 5. Paquetes sugeridos por tipo

| Tipo | Se enciende al crear | Opcionales frecuentes |
|---|---|---|
| Freelance | Núcleo + Negocio (sin Finanzas completas ni mostrador) | Formación |
| Estudio / productora | Núcleo + Negocio completo | Espacios, Formación, Coberturas |
| Local a la calle | Núcleo + Venta de mostrador, Catálogo, Pedidos | Espacios, Galería |
| Escuela | Núcleo + Formación | Espacios, Socios (egresados) |
| Sociedad / asociación | Núcleo + Institución | Espacios, Formación, Galería (muestras, concursos) |
| Agrupación | Núcleo + Socios (sin cuota) + Sorteos | Galería, Formación |
| ONG (FOTOPOSITIVA) | Núcleo + Coberturas + Socios (como voluntarios) | Galería (entregables), Institución |
| Espacio / coworking | Núcleo + Espacios | Socios y Cuotas (membresías del espacio) |

**Casos reales:**

- **DNX Estudio**: Negocio completo (migración de Alboom) + Formación (sus Workshops, que hoy son un
  embudo aparte en Alboom) + Galería con DNX FLUX.
- **SFPR**: Institución (socios, cuotas, carnets, sorteos, recomendados) + Espacios (reservas del salón)
  + Formación. Con el núcleo compartido, la cuota del socio y el alquiler del salón salen del mismo
  Cobranzas y de la misma Caja.
- **FOTOPOSITIVA**: Coberturas + Socios como voluntarios + Galería para entregar a cada organización. Con
  el motor de etapas común puede ajustar su recorrido sin programar.

## 6. Cómo se cobra según el tipo

| Tipo | Modelo |
|---|---|
| Negocios (freelance, estudio, productora, local) | Suscripción mensual (planes Fotógrafo / Estudio / Productora), 0 % sobre sus cobros |
| Instituciones (sociedad, agrupación, espacio) | Lo que ya existe: porcentaje sobre cuotas y reservas cobradas por el sistema (`WorkspaceModuleFee`), o plan Institución fijo si prefieren |
| ONG | Gratis o tarifa social (FOTOPOSITIVA es además un caso de impacto que vende el producto) |
| Mixtos | Se suma: la suscripción del negocio y la comisión de lo institucional |

## 7. Orden de trabajo para llegar ahí

Encaja con las etapas del mapa de Alboom:

1. **Etapa 0 (cimientos)** suma: guardar el tipo de organización, pantalla de Módulos para el dueño con
   dependencias, menú por familias, vocabulario ampliado.
2. **Contactos con roles** antes de Consultas: une `Client` y `Member` en la misma ficha.
3. **Cobranzas genéricas** en la etapa de Pedidos: nacen generales y las cuotas societarias se
   montan encima (sin romper lo que SFPR ya usa: migración con cuidado, las tablas van antes que el
   código).
4. **Agenda y motor de etapas** en la etapa de Proyectos: Reservas y Coberturas se suman como capas y
   como un tipo de recorrido más.
5. **Galería** sirve desde el día uno a pedidos y a entregables de coberturas.
