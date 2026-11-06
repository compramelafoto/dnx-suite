# Análisis de viabilidad técnica: SOYBELUZ sobre DNX Suite

**Versión 2 — 4/11/2026.** Código analizado: `origin/main` (`0507efb9a` del 2/11 para el análisis general;
`90b4234a1` del 4/11 para el probador de cuadros y los cursos).

> **Fuentes.**
> - El proyecto está descripto en [proyecto-soybeluz.md](proyecto-soybeluz.md), el brief de Belén recibido el
>   4/11. Reemplaza al `proyecto-comunidad-belen.md` que se citaba en el pedido original y que nunca existió.
> - La versión 1 de este análisis (3/11) suponía un club con kit mensual, "Actividad del mes" y entregas con
>   devolución. **El brief no menciona ni el kit, ni la actividad mensual, ni las entregas con cupo.** Lo que
>   pide es suscripción con renovación y cancelación, cursos grabados incluidos, descargables, encuentros
>   quincenales, clases gratuitas por Instagram y comunidad por WhatsApp. Esta versión reordena todo según el
>   brief. La Actividad del mes y las Entregas quedan como opcionales (sección 3.7 y pregunta abierta 1).
> - **Daniel confirmó el 4/11 que el kit mensual se mantiene** (sección 3.8).
> - Agregado por Daniel el 4/11: un **probador de cuadros** para que las alumnas armen cuadros con sus propias
>   obras y vean cómo quedan en la pared de su casa (sección 2.6).
> - El `main` local estaba 3.106 commits atrasado: todo lo citado sale de `origin/main`.
>
> Abreviaturas: `S` = `packages/db/prisma/schema.prisma`; `F` = `apps/fotoffice`.

---

## Resumen

1. **SOYBELUZ entra en FOTOFFICE como una institución más.** No hace falta una instalación aparte: FOTOFFICE ya
   separa instituciones en datos, acceso, textos, colores, módulos y dominio propio, y hoy aloja cuatro en
   producción (SFPR, fotoclub demo, Foto Positiva y Gus Barbers). Con dominio propio, SOYBELUZ se ve como una web
   independiente.
2. **Cerca de la mitad del brief ya existe:**
   - sitio público con dominio propio;
   - registro e inicio de sesión;
   - cursos grabados con video protegido, progreso, descargables por clase y certificado;
   - cobro mensual con Mercado Pago a la cuenta de Belén;
   - portal privado;
   - enlace al grupo de WhatsApp;
   - panel para administrar todo;
   - **probador de cuadros en la pared**, que ya funciona sin catálogo de precios.
3. **Lo que falta para lanzar (Fase 2), todo de tamaño medio o chico:**
   - que el pago **habilite y corte el acceso solo**;
   - que **todos los cursos queden incluidos** mientras dure la suscripción;
   - **módulos** dentro de cada curso;
   - una sección de **Descargables**;
   - un **calendario único** para encuentros quincenales y clases gratuitas;
   - la pantalla **Mi suscripción**, con renovación y cancelación;
   - el **despacho del kit mensual**: quién lo recibe cada mes, a qué domicilio, y el seguimiento del envío. La
     tienda ya cotiza con Andreani y Correo Argentino, pero no crea envíos. Para empezar, el despacho es manual
     con una planilla generada por el sistema, como el kit a domicilio de Clickatón.
4. **La decisión más importante que falta es el débito automático.** Hoy no existe: se paga mes a mes con un
   link. Se puede lanzar así ("vence el 5/12, renovar") y sumar la suscripción automática de Mercado Pago
   después, o construirla antes de lanzar. Ver la sección 2.3 y la pregunta abierta 2.

---

## 1. Pregunta bloqueante: ¿multi-institución o instancia separada?

### Resultado

**FOTOFFICE ya es multi-institución, y no de nombre: hoy conviven varias instituciones en la misma base de
producción.** La recomendación es **crear SOYBELUZ como una institución (`Workspace`)** dentro de la instalación
actual, con su dominio propio. **No conviene desplegar una instancia separada.**

### Evidencia

**El tenant es `Workspace`** (`S:7390`). La identidad de cada institución vive en tablas 1:1:

| Qué | Dónde |
|---|---|
| Slug público, nombre comercial, logo, colores, tipo de organización | `FotofficeWorkspaceBranding` (`S:7626`) |
| Cómo se llama a la persona del padrón ("socio", "suscripta", "alumna") | `WorkspaceVocabulary` (`S:20684`), cargado en `F/lib/vocabulario/load.ts:17-25` |
| Qué módulos tiene encendidos | `WorkspaceFeatureModule` (`S:7611`), leído en `F/lib/modules/gating.ts:23-68` |
| Dominio propio | `FotofficeWorkspaceDomain` (`S:7943`), resuelto en `F/proxy.ts:57-108` |

**El modelo de datos está separado por institución.** 264 modelos tienen `workspaceId`. Todos los modelos raíz
de socios, cuotas, cursos, reservas y sorteos lo tienen: `Member` (`S:8272`), `MembershipCharge` (`S:8645`),
`Course` (`S:10145`), `Raffle` (`S:9722`) y `BookingSpace` (`S:9346`). Los que no lo tienen son tablas hijas que
heredan la institución del padre. No encontré ningún modelo raíz de FOTOFFICE sin institución.

**La separación llega a todas las capas:**

| Capa | Cómo se resuelve la institución |
|---|---|
| Panel del administrador | Cookie `fotoffice_workspace_id`, validada contra la membresía del usuario (`F/lib/workspace.ts:62-107`) |
| Portal del socio | Cookie `fotoffice_perfil` = `MEMBER:<workspaceId>` (`F/lib/portal/access.ts:47-73`) |
| Sitio público | `/w/[workspaceSlug]` (`F/lib/website/public-site.ts:113`) o dominio propio |
| Textos | Vocabulario por institución (unos 72 archivos lo usan) |
| Colores | Branding por institución, con modo oscuro (`F/lib/website/site-theme.ts`) |

**Verificado en la base de producción** (Neon `divine-hall`, rama `development`, consulta de solo lectura del 3/11):

| Institución | Slug | Socios | Módulos encendidos | Dominio propio |
|---|---|---:|---:|---:|
| SFPR (`ws_sfpr_seed`) | `sfpr` | 160 | 13 | 1 |
| Fotoclub demo | `fotoclub-demo` | 160 | 13 | 0 |
| Foto Positiva | `foto-positiva` | 112 | 2 | 0 |
| Gus Barbers (`ws_gusbarbers`) | `gusbarbers` | 0 | 13 | 0 |

Gus Barbers es una barbería: ya es el primer cliente de FOTOFFICE fuera de la fotografía. Para la barbería se
agregaron funciones configurables por institución, como club con renovación voluntaria, alta sin aprobación y
agenda de profesionales. Se hizo sin tocar SFPR.

### Dónde se rompe la separación (lo poco que queda)

1. **Un ID fijo de SFPR con efecto en la lógica:** `F/lib/members/invitation-extras.ts:23-24` (nota y video en
   las invitaciones de `ws_sfpr_seed`). A SOYBELUZ no la afecta.
2. **DNX Estudio fijo por slug** (`SLUGS_DNX`, en 16 archivos). A SOYBELUZ no la afecta.
3. **Textos que no pasan por el vocabulario:**
   - unas 15 líneas con "socio" literal en el portal (por ejemplo `F/app/portal/cursos/page.tsx:72,97,159`);
   - textos de fotografía en el Inicio del portal (`F/components/portal/portal-home.tsx:434`);
   - la lista de especialidades del perfil (`F/lib/membership/specialties.ts:27-78`);
   - el último paso del probador: "Este estudio todavía no toma pedidos online".
4. **El vocabulario solo cubre la palabra "persona".** No cubre "cuota", "curso" ni "comisión". Para SOYBELUZ,
   "cuota" debería decir "suscripción".
5. **No hay un flujo para dar de alta una institución con socios.** Gus Barbers se armó por SQL. Para SOYBELUZ
   pasa lo mismo: alta asistida o un script reutilizable.
6. **Encender un módulo lo hace solo el super admin** (`F/app/workspace/configuracion/modulos/actions.ts:34-80`).

### Costo de cada camino

| | Institución dentro de FOTOFFICE (recomendado) | Instancia separada con el mismo código |
|---|---|---|
| Trabajo inicial | **Chico.** Alta de la institución, textos, colores, módulos, dominio y Mercado Pago de Belén | **Grande.** Proyecto de Vercel nuevo, base nueva, reconstruir el esquema (las migraciones no se reproducen desde cero), buckets, Google, MP, Resend, crons y dominio |
| Mantenimiento | Cada mejora llega a todas las instituciones | Cada migración se aplica a mano en una base más y cada deploy se duplica |
| Costo mensual | El de hoy | Otro proyecto de Vercel y otra base Neon |
| Lo que hay que construir para SOYBELUZ | Igual en los dos caminos | Igual en los dos caminos |

**Razonamiento.** La instancia separada no ahorra nada de lo que hay que construir y duplica la operación, que
hoy es el punto débil de la suite: migraciones a mano, registro `_prisma_migrations` poco confiable y bases
desparejas. Con dominio propio, SOYBELUZ se ve igual de independiente.

### Riesgo para la instalación de SFPR en cada camino

- **Institución dentro de FOTOFFICE:** el riesgo no está en convivir, sino en **las funciones nuevas**. Cada
  cambio a un módulo compartido (cuotas, portal, cursos) llega también a SFPR. La mitigación ya está probada con
  Gus Barbers:
  - todo lo nuevo entra **apagado por defecto y configurable por institución**;
  - antes de fusionar se verifica que SFPR no cambió.
- **Instancia separada:** SFPR no corre riesgo de datos, pero sí de **divergencia**: un schema compartido mal
  sincronizado puede terminar en una migración aplicada en la base equivocada, y cada arreglo hay que llevarlo a
  las dos.

---

## 2. Inventario de lo existente

### 2.1 Mapa de la suite

| Pieza | Stack | Base de datos | Estado |
|---|---|---|---|
| `apps/fotoffice` | Next.js 16.2, React 19.2, Prisma (`@repo/db`) | Neon `divine-hall` / `development` | Producción |
| `apps/fotorank` | Next.js 16.2 | **La misma** que FOTOFFICE | Producción (jurado); cobro y voto público sin terminar |
| `apps/muestras` | Next.js 16.2 + `packages/muestras` | **La misma** que FOTOFFICE | Producción (etapas 1–8; la venta está apagada) |
| `packages/auth` | Auth propia: cookie `dnx_session` con hash en la base, bcrypt y Google OAuth | — | Compartido por las tres apps |
| `packages/payments` | Checkout Pro de MP, OAuth de MP por institución, Orders API con split 1:N | — | Checkout Pro en producción; split 1:N apagado |
| `packages/db` | Un solo `schema.prisma` (875 modelos) para toda la suite | — | Migraciones a mano, base por base |

### 2.2 El brief de Belén contra lo que ya existe

| Lo que pide el brief | Qué hay en FOTOFFICE | Clasificación | Qué falta |
|---|---|---|---|
| **Web propia** con Inicio, Espacio creativo, Sobre SOYBELUZ, Suscripción | Sitio público por institución con páginas y secciones editables, dominio propio, logo y colores | **Usable con cambios menores** | Cargar el contenido. La "personalidad artística" puede pedir una plantilla de diseño propia (pregunta 7) |
| **Clases creativas gratuitas** (texto, día y horario, Instagram, WhatsApp gratuito, calendario) | Páginas y botones del sitio. **No hay calendario de clases** | **Requiere trabajo real** (el calendario) | El calendario de la sección 3.4 |
| **Cursos** (catálogo por temática, independientes, desde cero) | `Course` + `CourseLesson`: video protegido en Cloudflare Stream, marca de agua, clase de muestra, progreso real, certificado, catálogo público | **Usable con cambios menores** | Temática o disciplina (`Course` no tiene categoría) y **módulos** dentro del curso (las clases son una lista plana) |
| **Todos los cursos incluidos mientras dure la membresía** | `freeForMembers`: el socio activo se anota gratis **curso por curso**, solo en grabados; el acceso dura "mientras siga activo", no mientras pague | **Requiere trabajo real** | Modo "incluido en la suscripción", controlado por el pago (secciones 3.1 y 3.2) |
| **Descargables** (plantillas, ejercicios, PDF) | Adjuntos por clase (`CourseLessonAttachment`, `S:10220`). No hay una sección propia | **Requiere trabajo real** (chico) | Sección "Descargables" (3.3) |
| **Materiales** (guías de materiales, marcas) | Blog por institución con páginas públicas | **Usable con cambios menores** | Una categoría "Materiales" o una página del sitio |
| **Encuentros en vivo quincenales** (calendario, descripción, enlace, grabaciones) | Las ediciones de curso LIVE (`CourseInstance`, `S:10365`) tienen fecha, enlace y cupo, pero con precio propio y sin "incluido en la suscripción" | **Requiere trabajo real** | El calendario de 3.4, con el enlace visible solo para suscriptas vigentes |
| **Comunidad privada por WhatsApp** | `communityWhatsappUrl` en la configuración de cuotas; se muestra en el Inicio del portal solo a socios | **Usable tal cual** | Ojo: el enlace de WhatsApp se puede reenviar, y quien cancela sigue en el grupo hasta que Belén la saque (riesgo 7) |
| **Grupo gratuito de WhatsApp** | Botón en el sitio público | **Usable tal cual** | — |
| **Mi cuenta** con usuario y contraseña | Portal con login por email y contraseña o Google | **Usable tal cual** | — |
| **Mi suscripción** (estado, fecha de renovación, pagos, cancelar) | "Mis cuotas": cargos, pagos y botón de pago | **Requiere trabajo real** (chico/medio) | La pantalla de 3.5 |
| **Registro y pago online** | Alta autoaprobada con pago inmediato (`/w/<slug>/asociarse`) y categoría `selfRenew` | **Usable con cambios menores** | Textos de "suscribite" en lugar de "asociarse" |
| **Renovación mensual y cancelación** | Renovación manual con link (`selfRenew`); no hay débito automático | **Requiere trabajo real** | Sección 2.3 |
| **Control automático de acceso** | No existe: dejar de pagar no corta el acceso | **Requiere trabajo real** | Sección 3.1 |
| **Panel de administración** (cursos, videos, PDF, encuentros, participantes, pagos) | Panel de cursos con subida de video; padrón de socios; cobros | **Usable con cambios menores** | Lo que se agregue (módulos, descargables, encuentros) tiene que tener su pantalla |
| **Nuevas disciplinas sin rehacer** | — | Se resuelve con la temática o disciplina en los cursos (3.2) | — |
| **Pagos desde otros países** | Solo Mercado Pago Argentina. Stripe no opera en Argentina | **No existe** | Fase 3 en adelante (pregunta 9) |
| **Kit mensual a todo el país** (pedido de Daniel) | La tienda cotiza envíos con Andreani y Correo Argentino (`F/lib/store/shipping/quote.ts`), pero es pedido por pedido y el cliente de Andreani solo consulta tarifas y sucursales (`F/lib/integrations/andreani/client.ts:359,380`): **no crea envíos ni etiquetas**. El socio ya guarda su domicilio (`Member.address/city/province/postalCode`) | **Requiere trabajo real** | Sección 3.8 |
| **Probador de cuadros con obras propias** | Existe y funciona sin catálogo de precios | **Usable con cambios menores** para ver; **trabajo real** para guardar o compartir | Sección 2.6 |

### 2.3 Cobro: cómo funciona hoy y qué le falta para SOYBELUZ

**Cómo funciona hoy:**
- Hay un cargo por mes (`MembershipCharge`, período `YYYY-MM`, `S:8645`), con el precio definido por categoría y
  con vigencia (`MembershipFeeValue`, `S:8618`).
- Se paga con **Checkout Pro de Mercado Pago, cargo por cargo** (`startMemberDuesCheckout`,
  `F/lib/membership/dues-checkout.ts:28`).
- El dinero va a la **cuenta de MP de la institución, conectada por OAuth** (`F/lib/payments/connect/collector.ts:23`).
  La comisión de DNX se cobra con `marketplace_fee` en la misma operación.
- Hay conciliación cada hora con MP y recordatorio diario por email.
- **Para SOYBELUZ sirve la categoría `selfRenew`** (hecha para Gus Barbers, `S:8234`). La persona renueva desde
  el portal, el cargo se crea en ese momento y va directo a MP. **Si no paga ese mes, no genera deuda**, y el cargo
  sin pagar se borra a los 3 días. Esto es exactamente "renovación mensual sin deuda".

**Qué falta:**
1. **El acceso no depende del pago.** Quien deja de pagar sigue ACTIVE y conserva el portal y los cursos. La
   configuración de mora se guarda pero ningún proceso la aplica. Se resuelve con el período pagado (3.1).
2. **No hay débito automático:** no existe ningún "preapproval" ni suscripción de MP en `packages/payments`. Hay
   dos caminos:

| | A. Renovación con link (recomendado para lanzar) | B. Suscripción automática de Mercado Pago |
|---|---|---|
| Cómo se ve | "Tu suscripción vence el 5/12" + botón "Renovar". Recordatorio por email unos días antes | Se cobra sola todos los meses con la tarjeta |
| Cancelar | Es no renovar; el acceso dura hasta la fecha pagada | Botón "Cancelar" que da de baja la suscripción en MP |
| Esfuerzo | **Chico:** casi todo existe | **Medio/grande:** adaptador nuevo en `packages/payments`, webhook de suscripciones, conciliación de cada cobro, cambio de tarjeta y baja desde el portal |
| Riesgo | Más bajas por olvido de pago | **No pude verificar si las suscripciones de MP admiten la comisión de DNX con el token OAuth de Belén.** Si no la admiten, cambia el modelo de comisión |

**Recomendación:** lanzar con A y construir B en cuanto se confirme lo de la comisión con Mercado Pago. Belén
pide "renovación mensual" y "posibilidad de cancelar": A cumple las dos con menos fricción técnica, aunque no con
la comodidad de un débito automático.

3. **Payment Split 1:N:** no hace falta. Está apagado en FOTOFFICE (`FOTOFFICE_SPLIT_1N_ENABLED = false`,
   `F/lib/payments/split-1n.ts:28`) y con dos partes alcanza el `marketplace_fee`. Serviría recién con
   **docentes invitados** que cobren un porcentaje (el brief los menciona a futuro).
4. **Pagos internacionales:** no hay. Stripe no opera en Argentina (hace falta una entidad en un país soportado).
   Es un tema de Fase 3 o posterior.

### 2.4 Identidad y acceso

- FOTOFFICE, FotoRank y Muestras usan **la misma tabla `User`** y la misma sesión. Una suscripta de SOYBELUZ
  tiene una cuenta DNX que también sirve en las otras plataformas.
- **No hay SSO entre dominios.** La cookie `dnx_session` se comparte solo entre subdominios de `dnxsuite.com`
  (`COOKIE_DOMAIN`, `F/lib/auth.ts:13,34`). Con el dominio propio de SOYBELUZ, la sesión es aparte. Para la
  alumna no cambia nada: entra con su email y contraseña en la web de SOYBELUZ.
- **No hay control de acceso por membresía genérico.** Cada módulo decide por su cuenta:

| Punto de decisión | Qué mira | ¿Dejar de pagar corta el acceso? |
|---|---|---|
| Entrar al portal (`F/lib/portal/access.ts:58-75`) | `Member.status = ACTIVE` | **No** |
| Curso "Gratis para socios" (`F/lib/course-classroom/beneficio.ts:34`) | ACTIVE + `freeForMembers` + solo cursos grabados | **No** |
| Sorteos (`F/lib/raffles/eligibility.ts:55-73`) | ACTIVE + sin cargos vencidos | Sí |
| Carnet (`F/lib/carnet/status.ts:46-63`) | Mora calculada | Sí (lo marca en mora) |

  La solución es un resolvedor único (3.1) que usen Cursos, Descargables y Encuentros.

### 2.5 Módulos del portal del socio (punto D del pedido original)

| Módulo | Estado real | Para SOYBELUZ | Nota |
|---|---|---|---|
| Inicio | Completo | **Usable con cambios menores** | Sacar "Recomendá a un fotógrafo amigo" y la franja de concursos; sumar "próximo encuentro" |
| Mi carnet | Completo | No lo pide el brief | Se puede dejar apagado |
| Mis cuotas | Completo | **Requiere trabajo real** → pasa a ser "Mi suscripción" | Sección 3.5 |
| Mi perfil | Completo; la "presencia profesional" es de fotografía | **Usable con cambios menores** | Ocultar la presencia profesional en SOYBELUZ |
| Reservas | Alquiler de espacio o turno 1 a 1, sin cupo | **No sirve** para encuentros | Los encuentros van por el calendario de 3.4 |
| Sorteos | Completo | No lo pide el brief | Disponible si Belén lo quiere |
| Mis referidos | Completo (bonifica un % de una cuota) | No lo pide el brief | Con `selfRenew` hay que verificar que la bonificación funcione bien |
| Beneficios | Completo (comercios con beneficio) | No lo pide el brief | Podría servir con librerías artísticas, junto a la sección Materiales |
| Cursos | Completo | **Usable con cambios menores / trabajo real** | Ver 2.2 y 3.2 |

### 2.6 Probador de cuadros: armar cuadros con las propias obras en la pared de casa

**Estado: existe y está en producción** (PR 880 a 915, entre el 29/10 y el 2/11). Ruta pública
`/w/<slug>/probador-de-cuadros`, con un asistente de 6 pasos pensado para el celular
(`F/components/probador/asistente.tsx`):
1. sacar una foto de la pared;
2. marcar algo de medida conocida (una hoja A4, una puerta u otra cosa);
3. elegir el estilo (cuadro, díptico, tríptico, escalonado, con o sin marco, paspartú);
4. subir las fotos;
5. ver cómo queda, a escala real;
6. hacer el pedido.

**Cómo funciona:** la persona marca 4 puntos sobre la medida conocida, se calcula la perspectiva de la pared
(una homografía, `F/lib/probador/geometria.ts`) y los cuadros se dibujan encima con WebGL. **Las fotos se
procesan en el navegador y no se suben** salvo que se haga un pedido. Hay marcos reales cargables
(`FotofficeModeloMarco`, en `/probador/marcos`) y un marco negro genérico.

**Aclaración sobre el "3D":** no es un modelo 3D ni realidad aumentada. Es la foto real de la pared con los
cuadros puestos **en perspectiva y a escala**, lo que en la práctica se ve como 3D. La realidad aumentada en la
web se descartó el 29/10 porque no funciona en el Safari del iPhone y los cuadros "flotan". Para el uso de
SOYBELUZ la foto es mejor: la alumna ve **su** pared, con su luz.

**Encaje con SOYBELUZ:**
- **La página no depende de ningún módulo** (comentario en `F/app/w/[workspaceSlug]/probador-de-cuadros/page.tsx`).
  SOYBELUZ la tendría con solo existir como institución.
- **Funciona sin catálogo de precios:** las medidas quedan libres ("sin precio") y se oculta el presupuesto
  (`F/components/probador/motor.ts:579-586, 696`). Una alumna puede probar su dibujo en 30×40 o en 50×70 sin que
  haya nada a la venta.
- **Sin pedidos activos**, el último paso dice "Tocá «Ver imagen final», guardala y mandásela por WhatsApp". La
  alumna se lleva la imagen y la puede compartir en la comunidad.

**Qué falta para usarlo con obras propias:**

| Cambio | Esfuerzo | Detalle |
|---|---|---|
| Textos para artistas | Chico | "Subí tus fotos" → "Subí la foto de tu obra"; el paso 6 sin "este estudio no toma pedidos" |
| Ponerlo en el portal y en el menú del sitio | Chico | Hoy entra solo al menú de quien tiene Pedidos de impresión; para SOYBELUZ va como página del sitio y como ítem de Mi cuenta ("Probá tu obra en tu pared") |
| **Enderezar la foto de la obra** | Medio | La alumna fotografía su dibujo sobre la mesa, con el celular en ángulo. Hoy se recorta (`F/lib/probador/encuadre.ts`) pero no se corrige la perspectiva. La misma homografía de la pared sirve para enderezar el dibujo marcando sus 4 esquinas |
| Guardar la composición en su cuenta | Medio | Hoy no se guarda nada si no hay pedido. Haría falta guardar la imagen final y la composición por alumna (las fotos ya tienen un circuito de subida firmada a R2 y de purga) |
| Compartir en la comunidad o en una galería | Medio | Depende de si hay galería (3.7). Mientras tanto, compartir por WhatsApp alcanza |
| Vender impresiones o enmarcados de las obras | Medio | El pedido ya existe (`FotofficePrintOrder` con source PROBADOR), pero exige el módulo de Pedidos de impresión, Mercado Pago y un laboratorio. Solo si Belén quiere vender cuadros (pregunta 8) |

**Conclusión:** para que las alumnas **vean** sus obras enmarcadas en su pared, alcanza con cambios chicos y
puede estar desde el lanzamiento. Enderezar la foto del dibujo y guardar lo armado es la mejora que más valor
agrega después.

### 2.7 Muestras y FotoRank (preguntas E y F del pedido original)

El brief no los menciona; quedan para más adelante. Lo verificado:
- **Muestras** depende poco de la fotografía: no guarda EXIF y procesa cualquier imagen. Lo fotográfico pesa en:
  - unos 350 textos y el dominio fijo;
  - piezas impresas que imprimen la obra;
  - venta que solo ofrece copia digital o Fine Art (**no se puede vender el original físico**).

  Es un portal único, sin muestras por institución: `CulturalActivity.workspaceId` existe pero nunca se escribe,
  y aprueba solo el super admin. Generalizarlo para arte sin romper lo de fotógrafos es posible: no renombrar
  tablas, mantener `/fotografos/...` y no alterar los certificados emitidos. Hacerlo por institución y con marca
  propia es **grande**.
- **FotoRank** es un motor de concursos con jurado, completo, pero:
  - muy atado a la fotografía (exige EXIF y por defecto acepta solo JPEG);
  - sin cobro de inscripción online (queda en `PENDING_PAYMENT`);
  - sin voto del público en main;
  - sin una regla de "solo suscriptas vigentes".

  **Decisión de Daniel (4/11): FotoRank se mantiene como actividad esporádica.** No forma parte del día a día
  de la comunidad, que Belén quiere sin competencia ni comparación de resultados. Queda disponible para
  convocatorias puntuales que se usen cuando tengan sentido, por ejemplo:
  - un **desafío o concurso de fin de temporada** con jurado (Belén y una docente invitada), con diplomas;
  - una **convocatoria para una muestra**: FotoRank ya alimenta a Muestras (importación de finalistas,
    `CulturalContestImport`);
  - un **concurso abierto** que sirva para hacer conocer SOYBELUZ fuera de la comunidad.

  Para que sirva hace falta (**medio** en total):
  - una regla de elegibilidad "suscripta vigente de SOYBELUZ", junto a la de ARGRA en
    `registration-service.ts:246`, para los concursos internos;
  - una política de carga para obras de arte (PNG y JPEG, sin exigir EXIF ni fecha de captura);
  - textos neutros ("obra" en lugar de "fotografía");
  - inscripción gratuita, o terminar de conectar el cobro online, que hoy no funciona.

  El enfoque se puede ajustar al espíritu del proyecto: categorías por consigna y no por nivel, menciones en
  lugar de un ranking completo, y resultados publicados solo dentro de la comunidad.

---

## 3. Lo que falta construir

Todo vive en `apps/fotoffice`. Lo nuevo entra **apagado para todas las instituciones** y se enciende solo en
SOYBELUZ. Los nombres de los modelos son propuestas.

### 3.1 Acceso controlado por el pago — **Medio** (Fase 2)

```prisma
// En MembershipDuesSettings (por institución), apagado por defecto:
accessRequiresPaidPeriod Boolean @default(false)
accessGraceDays          Int     @default(3)

// En Member (se recalcula al acreditar o devolver un pago):
paidThrough DateTime?   // hasta cuándo cubre lo pagado
```

- Resolvedor único `F/lib/membership/acceso.ts` → `estadoDeMiembro(userId, workspaceId)`. Devuelve
  `vigente = ACTIVE && (!accessRequiresPaidPeriod || paidThrough + gracia >= hoy)`.
- `paidThrough` se actualiza en `creditMembershipPayment` (`F/lib/membership/credit-payment.ts`) y al devolver
  un pago. **El acceso se corta solo**, sin cron y sin suspender a nadie a mano, y vuelve solo al renovar.
- Regla común por contenido: `accessLevel: PUBLIC | MEMBERS`. La comparten Cursos, Descargables y Encuentros.
- **SFPR no cambia:** su opción queda en `false`.

### 3.2 Cursos incluidos en la suscripción, con módulos y temáticas — **Medio** (Fase 2)

```prisma
// En Course:
includedInMembership Boolean @default(false) // a diferencia de freeForMembers, no hace falta anotarse
discipline           String?  // "Dibujo", "Acuarela"… (lo que permite sumar disciplinas)
topic                String?  // temática dentro de la disciplina

model CourseModule {          // los "módulos" que pide Belén
  id        String @id @default(cuid())
  courseId  String
  title     String
  sortOrder Int    @default(0)
}
// En CourseLesson:
moduleId String? // opcional: los cursos que ya existen siguen con su lista plana
```

- Un curso `includedInMembership` se abre para cualquier suscripta **vigente** (3.1), sin inscripción previa. El
  progreso se sigue guardando por persona: el registro de acceso se crea solo la primera vez que entra.
- Si deja de estar vigente, ve el catálogo pero no las clases. Al renovar, recupera su progreso.
- El panel de cursos suma los módulos (crear, ordenar, mover clases).

### 3.3 Descargables — **Chico** (Fase 2)

Para no duplicar archivos: la sección **Descargables** de Mi cuenta lista los adjuntos de todos los cursos
incluidos (`CourseLessonAttachment`), agrupados por curso y temática, y suma archivos sueltos que no pertenecen a
ninguna clase:

```prisma
model MemberDownload {
  id          String   @id @default(cuid())
  workspaceId String
  title       String
  description String?
  category    String?  // "Plantillas", "Ejercicios"…
  storageKey  String   // R2; descarga con enlace firmado y vencimiento corto
  fileName    String
  accessLevel String   @default("MEMBERS")
  publishedAt DateTime?
  sortOrder   Int      @default(0)
}
```

La descarga va con un enlace firmado que vence en minutos, para que no se pueda pasar el link a alguien sin
suscripción. Tiene un riesgo menor: FOTOFFICE no tiene bucket privado de R2 (ver riesgo 6).

### 3.4 Calendario de encuentros y clases gratuitas — **Medio** (Fase 2)

Un solo modelo resuelve las dos agendas que pide el brief:

```prisma
model CommunitySession {
  id           String    @id @default(cuid())
  workspaceId  String
  kind         String    // FREE_INSTAGRAM | MEMBER_LIVE
  title        String
  description  String?   // la propuesta o el proyecto creativo
  startsAt     DateTime
  durationMin  Int       @default(90)
  accessLevel  String    // PUBLIC para las clases gratuitas, MEMBERS para los encuentros
  joinUrl      String?   // Instagram, o Meet/Zoom; en los encuentros solo se muestra a vigentes
  recordingVideoUid String? // grabación opcional, en Cloudflare Stream como los cursos
  status       String    @default("SCHEDULED") // SCHEDULED | DONE | CANCELLED
  createdAt    DateTime  @default(now())
  @@index([workspaceId, kind, startsAt])
}
```

- **Sitio público:** "Clases creativas gratuitas" muestra las próximas `FREE_INSTAGRAM`. "Encuentros en vivo"
  muestra las `MEMBER_LIVE` **sin el enlace** e invita a suscribirse.
- **Mi cuenta → Encuentros:** las próximas con enlace y las anteriores con su grabación.
- **Panel:** Belén crea, edita y reprograma sin tocar la estructura de la web, y sube la grabación con el mismo
  circuito de video de los cursos.
- **Opcional:** recordatorio por email el día del encuentro (existe infraestructura de correo) y un archivo de
  calendario (.ics) para agendarlo.
- No conviene usar `CourseInstance` (tiene precio y cupo propios de un curso presencial) ni Reservas (son
  alquileres de espacio).

### 3.5 Mi suscripción — **Chico/medio** (Fase 2)

Una pantalla que reemplaza "Mis cuotas" cuando la categoría es `selfRenew`:
- estado (vigente / vence pronto / vencida) y "vigente hasta el 5/12";
- botón **Renovar**, que ya existe (`renewMembershipAction`);
- historial de pagos, a partir de `MembershipPayment`;
- **Cancelar:** con el camino A significa dejar de renovar. Se registra la baja (para no mandar más
  recordatorios) y el acceso sigue hasta la fecha pagada. Con el camino B, cancela también la suscripción en MP.

### 3.6 Alta de la institución, sitio y textos — **Chico** (Fase 2)

- Alta de SOYBELUZ: `Workspace`, branding, vocabulario ("suscripta"/"suscriptas"), categoría `selfRenew` con el
  precio, módulos (`website`, `members`, `membership-dues`, `courses-sales` y lo nuevo), alta autoaprobada,
  dominio propio y Mercado Pago de Belén conectado. Conviene un script reutilizable: es el segundo caso después de
  Gus Barbers.
- Textos genéricos en el portal: Inicio, perfil, "cuota" → "suscripción", "asociarse" → "suscribirse".
- Páginas del sitio según el menú del brief (sección 9 de [proyecto-soybeluz.md](proyecto-soybeluz.md)).

### 3.7 Opcionales del análisis anterior (no están en el brief)

Quedan anotados por si Belén los quiere. Si se confirman, se diseñan con el mismo criterio que el resto:
acceso por suscripción vigente (3.1), cupo de entregas por persona y por mes, y consentimiento explícito del
autor para cada obra que se muestre.

| Pieza | Esfuerzo | Relación con el brief |
|---|---|---|
| **Actividad del mes** (ficha + consigna + materiales + fecha) | Medio | Se superpone con los encuentros quincenales: cada encuentro ya tiene su proyecto creativo |
| **Entregas con devolución y cupo** | Medio | El brief pide "espacios para consultas y devoluciones", pero los ubica en los encuentros y en WhatsApp |
| **Galería con consentimiento por obra** | Chico/medio | Encaja con "compartir dibujos" y con el probador, pero choca con "no comparar resultados". Debería ser sin "me gusta" ni ranking |

### 3.8 Kit mensual — **Medio** (Fase 2), con integración de envíos en Fase 3

**Qué existe:**
- La tienda cotiza envíos con Andreani y Correo Argentino, con zonas y tarifas propias (`StoreShippingSettings`,
  `StoreShippingZone`, `StoreShippingRate`, `S:23671-23721`). Pero cada envío nace de una compra en la tienda, y
  la integración con Andreani solo consulta tarifas y sucursales: **no da de alta envíos ni genera etiquetas**.
- El socio ya tiene domicilio personal (`Member.address`, `city`, `province`, `postalCode`), separado del
  domicilio de estudio.
- **Precedente en Clickatón:** el kit a domicilio de la maratón se despacha a mano, con un precio fijo de envío
  y un QR único en el instructivo (`/recibi-mi-kit`) para que cada persona confirme que lo recibió.

**Propuesta:**

```prisma
// En MemberCategory: qué planes llevan kit (permite "con kit" y "sin kit" con precios distintos).
includesMonthlyKit Boolean @default(false)

model MonthlyKit {              // el kit de cada mes
  id            String   @id @default(cuid())
  workspaceId   String
  period        String   // "YYYY-MM"
  title         String
  contents      String?  // qué trae; se muestra en Mi cuenta y en el sitio
  coverUrl      String?
  cutoffAt      DateTime // corte: quien está vigente a esta fecha recibe este kit
  dispatchFrom  DateTime? // cuándo empieza el despacho (para avisar)
  stockPlanned  Int?
  status        String   @default("DRAFT") // DRAFT | OPEN | CUT | DISPATCHING | CLOSED
  @@unique([workspaceId, period])
}

model MonthlyKitShipment {      // un envío por suscripta por mes
  id           String   @id @default(cuid())
  kitId        String
  memberId     String
  // domicilio congelado al corte: si después lo cambia, este envío no se mueve
  recipientName String
  street       String
  city         String
  province     String
  postalCode   String
  phone        String?
  deliveryMode String   // HOME | PICKUP_WORKSHOP (retiro en el taller de Rosario)
  status       String   @default("PENDING") // PENDING | PREPARED | SHIPPED | DELIVERED | RETURNED | CANCELLED
  carrier      String?  // ANDREANI | CORREO_ARGENTINO | MANUAL
  trackingCode String?
  shippedAt    DateTime?
  deliveredAt  DateTime? // la confirma la alumna ("Recibí mi kit") o se carga a mano
  @@unique([kitId, memberId])
}
```

**Flujo de cada mes:**
1. Belén carga el kit del mes, con su contenido y la fecha de corte.
2. Antes del corte, la alumna confirma o corrige su domicilio desde **Mi cuenta → Mi kit** (aviso por email unos
   días antes).
3. Al corte, el sistema crea un envío por cada suscripta **vigente** (3.1) con un plan que incluye kit. Con
   `@@unique([kitId, memberId])` nadie recibe dos.
4. El panel muestra la **lista de despacho**: cantidades, planilla para descargar (CSV con nombre, domicilio y
   teléfono, en el formato de carga masiva del correo) y una hoja de armado.
5. Belén o Daniel despachan y cargan los códigos de seguimiento, de a uno o pegando una planilla. A cada alumna
   le llega un email con su seguimiento.
6. La alumna marca "Recibí mi kit" en Mi cuenta. Es lo mismo que el QR de Clickatón.

**Reglas para definir** (pregunta 11):
- **Quien se suscribe o renueva después del corte:** ¿recibe el kit de ese mes (si queda stock) o arranca el mes
  siguiente?
- **Costo del envío:** ¿incluido en el precio, como precio fijo por zona (las zonas de la tienda sirven), o
  cotizado por domicilio? Para una suscripción, lo más simple es un precio fijo por zona sumado al plan.
- **Retiro en el taller de Rosario:** ¿con o sin descuento?

**Esto refuerza el débito automático.** Con la renovación por link (camino A), quien renueva tarde pierde el
corte, y Belén no sabe cuántos kits armar hasta último momento. Con débito automático (camino B), la cantidad se
sabe de antemano. Si el kit es central en la propuesta, el camino B sube de prioridad (pregunta 2).

**Fase 3:** alta automática de envíos y etiquetas por API de Andreani o Correo Argentino, a partir de las
credenciales que ya guarda la integración. No pude verificar desde el código si la cuenta de Andreani conectada
tiene habilitado el alta de envíos: hoy solo se usan tarifas y sucursales.

---

## 4. Orden de implementación sugerido

**Paso 0, antes de programar (lo pide Belén):** esquema visual de las secciones. Inicio, Clases gratuitas,
Espacio creativo, Cursos, Mi cuenta y Suscripción, en celular y en computadora, sobre los bloques del sitio que
ya existen.

**Fase 2 (lanzamiento):**
1. Alta de la institución, dominio y textos (3.6) — chico.
2. Acceso controlado por el pago (3.1) — medio. Es la base de todo lo demás.
3. Cursos incluidos, con módulos y temáticas (3.2) — medio.
4. Mi suscripción, con renovación y cancelación por el camino A (3.5) — chico/medio.
5. Calendario de clases gratuitas y encuentros (3.4) — medio.
6. Descargables (3.3) — chico.
7. Probador de cuadros con textos para artistas y en el menú (2.6, solo los cambios chicos) — chico.
8. Kit mensual con despacho manual: planes con kit, domicilio, corte, lista de despacho, seguimiento y "Recibí
   mi kit" (3.8) — medio. Tiene que estar listo antes del primer corte, no necesariamente el día del
   lanzamiento.

**Fase 3:**
- Alta automática de envíos y etiquetas con Andreani o Correo Argentino.
- FotoRank para convocatorias esporádicas: regla "suscripta vigente", carga de obras de arte y textos (2.7).
- Suscripción automática de Mercado Pago (camino B), una vez confirmada la comisión.
- Probador: enderezar la foto de la obra y guardar lo armado.
- Opcionales de 3.7, si Belén los quiere.
- Docentes invitados con reparto (split 1:N).
- Pagos internacionales.
- Muestras de arte.

---

## 5. Riesgos técnicos

**Para la instalación de producción de SFPR:**
1. **No hay staging en FOTOFFICE.** Todo lo que se fusiona va a producción, donde está SFPR. Mitigación: lo
   nuevo entra apagado por defecto y se verifica en producción que SFPR no cambió.
2. **Migraciones a mano en tablas compartidas** (`Member`, `Course`, `CourseLesson`, `MembershipDuesSettings`).
   Si una columna no existe en la base cuando se despliega el código, Prisma rompe **todo el modelo**, no solo la
   función nueva. Regla: aplicar y registrar la migración **antes** de fusionar, con columnas nullable o con un
   valor por defecto.
3. **El acceso por período pagado cambia una regla sensible.** Si por error queda encendido para SFPR, 160 socios
   que están en mora pero ACTIVE perderían el portal. El valor por defecto `false` y un test que lo verifique son
   obligatorios.
4. **Los módulos de curso tocan el aula de SFPR.** `moduleId` opcional y "sin módulo = lista plana como hoy"
   evitan que cambien los cursos existentes.
5. **Los crons son globales** (`generar-cuotas`, `conciliar-cuotas`): un error nuevo en esos procesos afecta a
   SFPR. Hay que probarlos con los datos de las cuatro instituciones.

**Otros riesgos:**
6. **Descargables y bucket privado.** Las imágenes de FOTOFFICE van al bucket público `fotoffice-media`. Para
   que una plantilla no se pueda pasar por link, los descargables tienen que ir al bucket privado
   `fotoffice-private` (creado el 20/10/2026) con enlace firmado. Según lo registrado ese día, falta confirmar
   que el token de R2 de Vercel tenga acceso a ese bucket.
7. **WhatsApp no se puede controlar desde la plataforma.** El enlace del grupo privado se puede reenviar, y quien
   cancela sigue en el grupo. Belén tiene que sacar a mano a quien se va, o se puede generar un listado semanal
   de "vencidas en el grupo" para ayudarla.
8. **Débito automático incierto:** si MP no admite la comisión de marketplace en suscripciones con OAuth, cambia
   el modelo de comisión de DNX.
9. **Videos:** Cloudflare Stream cobra por minutos guardados y reproducidos. Con muchas suscriptas mirando cursos
   y grabaciones de encuentros, hay que estimar el costo antes de fijar el precio de la suscripción.
10. **El probador corre en el navegador con WebGL.** En celulares viejos puede andar lento. Ya está en producción
    con DNX Estudio, pero no se probó con un público masivo.
11. **El kit agrega operación física todos los meses:** compra de insumos, armado, despacho y reclamos por
    envíos perdidos. Si el precio de la suscripción no contempla los envíos fallidos y las devoluciones, el kit
    puede comerse el margen. El domicilio congelado al corte evita discusiones sobre a dónde se mandó.

---

## 6. Preguntas abiertas

1. **Actividad del mes y Entregas con devolución:** estaban en el pedido original de Fase 2 pero no en el brief
   de Belén. ¿Las mantenemos, las pasamos a Fase 3 o se descartan?
2. **¿El débito automático es indispensable para lanzar,** o se puede arrancar con "vence el X, renovar" (camino
   A)? Si es indispensable, primero hay que confirmar con Mercado Pago si las suscripciones admiten la comisión
   de DNX con el token de Belén.
3. **Precio y condiciones:** precio mensual, si hay algún período de prueba, si hay precio anual, y la comisión
   de DNX.
4. **Grabaciones de los encuentros:** ¿se conservan para las suscriptas? Cambia el costo de video.
5. **Dominio:** ¿`soybeluz.com` u otro? ¿Ya está comprado?
6. **Los cursos, ¿son todos incluidos en la suscripción** o alguno se va a vender aparte, también a quien no está
   suscripta?
7. **Identidad visual:** ¿alcanza con logo, colores y tipografía sobre las plantillas del sitio, o Belén espera
   un diseño a medida? Lo segundo es más trabajo.
8. **Probador de cuadros:** ¿solo para que las alumnas vean sus obras, o también para vender impresiones o
   enmarcados? Lo segundo necesita laboratorio, Pedidos de impresión y Mercado Pago.
9. **Otros países:** ¿hay alumnas del exterior desde el lanzamiento? Hoy solo se cobra con Mercado Pago Argentina.
10. **¿Quién cobra y factura:** Belén con su cuenta de MP y DNX con comisión (como SFPR), u otro esquema?
11. **Kit mensual:**
    - ¿Hay un plan sin kit, más barato (por ejemplo, para el exterior)?
    - ¿El envío va incluido en el precio, fijo por zona o cotizado por domicilio?
    - ¿Quien se suma después del corte recibe el kit de ese mes o el del siguiente?
    - ¿Hay retiro en el taller de Rosario?
    - ¿Quién arma y despacha, y con qué correo?
