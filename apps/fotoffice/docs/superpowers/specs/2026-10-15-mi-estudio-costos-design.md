# «Mi estudio»: la estructura de costos de un estudio con empleados en ¿Cuánto Cobro?

- **Fecha:** 15/10/2026
- **Estado:** **aprobado por Daniel el 16/10/2026** (con la tarifa por persona y lo no asignado al valor hora del estudio). Respuestas y cambios en §0. E1 (motor) y E2 (pantalla) implementadas en la rama `feat/fotoffice-mi-estudio-e1`.
- **Dónde vive:** FOTOFFICE → Configuración → Precios (el perfil de ¿Cuánto Cobro?) y el panel «Armar con ¿Cuánto Cobro?» de los presupuestos.
- **Primer usuario:** DNX Estudio (workspace `cmv5z6qxwwmmhf0q5gp8qja1j`).
- **Código de partida:** `origin/main` en `d2eb14a5e` (incluye PR 598 «cámara por trabajo», PR 602 «Etapa A: el precio completo» y PR 604 «seña al aceptar»).

---

## 0. Decisiones de Daniel (16/10/2026) y cambios a este diseño

Daniel aprobó el enfoque completo, incluida la recomendación de §7 (tarifa por persona; lo no asignado al valor hora del estudio). Sus respuestas cambian estas partes:

| Tema | Lo que dijo | Cómo queda |
|---|---|---|
| Jornada de Sabi y Cami | Lunes a sábado, pero los sábados rotan: cada una trabaja 5 días de semana + un sábado sí y otro no. Las horas por día no las dio. | **Días por semana con decimales** ("5,5") y un atajo «5 + sábados alternados» en la pantalla. Las horas por día quedan para cargar. |
| Contratación | Son informales («en negro») pero cobran todo como si estuvieran registradas: aguinaldo y vacaciones pagas, sin cargas. | Tipo nuevo **`informal`**: aguinaldo sí, vacaciones pagas, cargas 0 %. Además, `paidVacations` por persona (si no se pagan, el costo baja en la misma proporción que las horas). |
| Retiro | $1.000.000 por mes. | Sin cambios en el modelo. |
| Ganancia del estudio | Unos $500.000 por mes, **monto fijo**, para reinvertir. | `desiredProfitMode`: **"amount"** (por omisión) o "percent". |
| Impuestos | El estudio es monotributo. | Ya existe en «Impuestos, cobros y recargos» (`pricingExtras.monotributoMonthly`); se suma una sola vez. Falta cargar el monto. |
| Carnets | Sabi y Cami atienden el estudio y sacan fotos carnet: 3 disparos por carnet en OTRA cámara, de $500.000 con 150.000 disparos de vida útil → **$10 de desgaste por carnet**. | **Varias cámaras** (§5.1): la principal sigue siendo la #1; las demás en `profile.cameras`. Cada concepto elige `cameraId` y si los disparos son por unidad (carnet) o por trabajo (evento). |
| Usuarios | Van a tener su usuario de FOTOFFICE. | Cada persona se vincula con un **miembro del workspace** (`link.userId`). **No se manda ninguna invitación**: eso se le pregunta a Daniel aparte. |
| Márgenes de productos | No los conoce; quiere verlos siempre que un producto tenga costo y precio cargados. | Requisito para la etapa de catálogo (§15, «Catálogo: margen a la vista»). No entra en E1/E2. |

### 0.1 Ejemplo con los números de Daniel

Supuestos (marcados): **8 horas por día** para las tres personas (Daniel no lo dio); 2 semanas de vacaciones; 70 % de tiempo vendible para Sabi y Cami y 60 % para Daniel; Daniel trabaja 6 días (sus 48 horas por semana del perfil actual). Gastos fijos: sólo los que ya están en su perfil (alquiler $450.000, software $30.000, publicidad $100.000 = $580.000); faltan luz, internet, contador, etc. Reservas del perfil: equipo $41.667 + emergencia $50.000. El monotributo todavía no está cargado.

| Persona | Jornada | Horas/mes | Vendibles | Costo/mes | Costo/hora | Tarifa |
|---|---|---|---|---|---|---|
| Daniel (retiro) | 6 × 8 | 199,9 | 119,9 | $1.000.000 | $8.340 | **$11.453** |
| Sabi (informal) | 5,5 × 8 | 183,2 | 128,2 | $900.000 × 13/12 = $975.000 | $7.603 | **$10.716** |
| Cami (informal) | 5,5 × 8 | 183,2 | 128,2 | $975.000 | $7.603 | **$10.716** |
| **Estudio** | | | **376,4** | | | **$10.951** |

```
necesidad = 580.000 + 1.950.000 + 91.667 + 1.000.000 + 500.000 (ganancia fija) = 4.121.667
valor hora del estudio = 4.121.667 / 376,38 = 10.951
estructura por hora    = (4.121.667 − 1.950.000 − 1.000.000) / 376,38 = 3.113
```

- **Carnet:** 3 disparos × ($500.000 / 150.000) = **$10** de desgaste, sumado al costo del producto.
- **Sesión** (1 h Daniel + 2 h Cami): por persona $32.885; al promedio $32.853.
- **Evento** (6 h + 1 h de viaje Daniel y Sabi, 10 h de edición Cami): por persona $262.346; al promedio $262.822.
- Con estos números las tarifas quedan cerca entre sí porque los tres cuestan parecido por hora; la diferencia crece cuando alguien cobra mucho más o mucho menos que el resto.

---

## 1. Resumen para Daniel

Hoy ¿Cuánto Cobro? piensa como un fotógrafo que trabaja solo: suma tus gastos personales y los del negocio, todo junto, y lo divide por tus horas. Para un estudio con local y empleadas eso falla de tres maneras:

1. **Los sueldos de Sabi y Cami se reparten sólo entre tus horas.** Si cargás 2 empleados, su costo entra en la cuenta, pero las horas que ellas trabajan no. Resultado: tu hora sale carísima y la hora de ellas no existe.
2. **Todo se mezcla.** El alquiler del local, tu sueldo de dueño y los gastos de tu casa son un solo número. No se puede ver cuánto cuesta abrir la puerta cada mes, ni cuánto te llevás vos.
3. **Todas las horas valen lo mismo.** Una hora tuya y una hora de edición de Cami se cobran igual.

«Mi estudio» es un modo nuevo del perfil de precios, que sólo aparece en workspaces de tipo estudio y que se enciende a mano. Con el modo encendido, el perfil se arma con cuatro bloques:

- **Gastos fijos del estudio:** lo que pagás todos los meses haya trabajo o no (alquiler, luz, internet, contador, software, publicidad…).
- **Tu retiro:** lo que te llevás vos por mes, aparte del estudio.
- **Equipo:** cada persona con su forma de contratación, su sueldo, sus cargas, su jornada (días por semana × horas por día) y sus insumos.
- **Lo que dejan otras líneas:** si las impresiones o los cursos ya pagan una parte de los gastos fijos, se descuenta para no cobrársela dos veces a las sesiones y a los eventos.

Con eso el sistema calcula dos cosas:

- **El valor hora del estudio:** todo lo que cuesta el estudio en un mes, dividido por las horas que el equipo entero puede vender.
- **El valor hora de cada persona:** lo que cuesta esa persona por hora, más su parte de la estructura. Al cotizar, podés decir quién hace cada parte del trabajo («la cobertura la hacemos Sabi y yo, la edición Cami»), y cada hora se cobra a la tarifa de quien la hace. Las horas que no le asignás a nadie se cobran al valor hora del estudio.

Si apagás el modo, el perfil vuelve exactamente a lo de antes: no se borra nada. Los fotógrafos que trabajan solos y CompraMeLaFoto no ven ningún cambio.

Más adelante (no en este diseño) Caja va a poder proponer los gastos fijos reales con el promedio de los últimos 3 meses. Los datos ya quedan preparados para eso.

---

## 2. Lo que hay hoy (leído en el código)

### 2.1 El motor (`packages/cuanto-cobro-core`)

- `CuantoCobroProfileInput` (`src/types.ts`) es **un objeto plano con montos en texto**. Para el negocio tiene sólo `businessRent`, `businessSoftware` y `businessMarketing`. Para el equipo tiene sólo **`employeesCount` + `employeeMonthlyCost`**: una cantidad y un costo total. No hay personas, ni horas de esas personas, ni cargas sociales.
- `getProfileMonthlyNeed` (`src/hourly-rates.ts`) = personales + negocio + equipo + reservas (renovación y ampliación de equipo, fondo de emergencia, ahorro) + fijos de `pricingExtras` (monotributo y seguro de equipo anual ÷ 12) − ingresos externos.
- `getProfileCostHour` = necesidad mensual ÷ (`weeklyHours` × 4,33). **Divide por TODAS las horas de la semana, no por las facturables.** La distribución del tiempo (`timeDistribution`: coberturas, edición, administración…) es sólo informativa: el comentario lo dice explícitamente («La distribución semanal de tiempo no modifica este valor»).
- `getQuoteLaborRates` arma una tabla de tarifas por tipo de hora (cobertura, edición, entrega, viaje, administración…) donde **todas valen lo mismo** (`buildUniformLaborRates`). `calculateQuoteItem` multiplica las horas de cada concepto por esa tarifa; el servicio propio no lleva margen (el margen lo pone el posicionamiento comercial, ×1 a ×2); productos y tercerizados sí llevan su %.
- El precio completo (PR 602, `src/pricing-extras/`) se aplica **después**, sobre el precio que da el motor: recargos de día y exprés sobre la parte de servicio propio, retoque (horas × `costHour`), viáticos, inflación, IIBB, comisión, IVA, redondeo, seña. Sólo aparece si está encendido (`priceBuildUp` opcional): ése es el patrón de compatibilidad que copiamos.
- El desgaste de la cámara (PR 598) se cobra por trabajo como costo directo del servicio propio, con **una sola cámara** (la principal del perfil).
- La lista de pasos (`CC_WIZARD_STEPS`) es compartida con el asistente de CompraMeLaFoto. El paso `team` se llama «Empleados y estructura».

### 2.2 FOTOFFICE

- **Guardado:** `FotofficePerfilPrecios` tiene una fila por workspace con **`profileData Json`** y `schemaVersion`. `lib/precios/perfil.ts` → `guardarPerfilPrecios` con concurrencia optimista por `updatedAt` (sin migración). `lib/precios/perfil-datos.ts` → `normalizarPerfil` / `validarPerfil` (tope de 150 KB). **No hace falta migración:** el bloque nuevo es una clave más del JSON, igual que hizo PR 602 con `pricingExtras`.
- **Pantalla:** `app/workspace/configuracion/precios/perfil-form.tsx` es un formulario por pasos que toma los pasos del perfil de `CC_WIZARD_STEPS` y agrega el paso propio «Impuestos, cobros y recargos» (`PASO_COBROS`, `motor: false`).
- **Resumen:** `lib/precios/resumen.ts` copia a mano la lista `PROFILE_RESULT_STEPS` del motor (porque no se exporta).
- **Presupuestos:** `lib/presupuestos/panel-cuanto-cobro.ts` (puro) arma `{ perfil, presupuesto }`, lo corre y guarda esa entrada en el ítem (`calculo.entrada`); el servidor lo vuelve a correr al guardar. Los datos internos se sacan con `itemSinDatosInternos` antes de mostrarlos al cliente. Leer costos exige `configurar` (`veCostos`).
- **DNX Bot:** `lib/dnx-bot/motor.ts` (`esquemaParchePerfil`: en `negocio` tiene `colaboradores` y `costoColaboradores`), `motor-trabajo.ts` (`esquemaTrabajoBot`), `guia/perfil.ts` («colaboradores y su costo») y `guia/cotizar.ts`.
- **Tipo de workspace:** `FotofficeWorkspaceBranding.organizationType` y `activityType`. Ver §9 (hay dos vocabularios en la misma columna).
- **Equipo de trabajo:** los miembros del workspace son `Membership` (ADMIN/MEMBER). Los participantes de consultas y proyectos son **contactos** (`Client` con perfil `COLABORADOR`) con un rol de `FotofficeRolParticipante` (los 16 roles DNX vienen de `ROLES_PARTICIPANTE_DNX`: «Fotógrafo Principal», «Fotógrafo Secundario», «Asistente de Fotógrafo», «Filmaker»…).
- **Caja:** `CashAccount`, `CashCategory` (INGRESO/EGRESO, por workspace, envuelta por `FotofficeRubro`), `CashMovement` (con `sourceModule`, `categoryId`, `clientId`), `CashShift`.

### 2.3 DNX Estudio hoy (lectura de la base, sin escribir)

- `organizationType = "local"`, `activityType = "PHOTO_STUDIO"`.
- Tiene perfil de precios, **armado con DNX Bot** el 15/10 a la madrugada (hora argentina): 2 colaboradores con un costo total cargado, 48 horas por semana, alquiler cargado, sin `pricingExtras`. Es decir: hoy el costo de Sabi y Cami ya se está repartiendo sólo entre las 48 horas de Daniel.
- Un solo miembro en el workspace (Daniel). Sabi y Cami no son miembros ni contactos colaboradores.
- **Caja: 0 movimientos en los últimos 90 días y 0 categorías.** La etapa de Caja (§11) no tiene con qué trabajar hasta que haya unos meses de movimientos.

---

## 3. Decisiones de diseño (resumen)

| # | Decisión | Por qué |
|---|---|---|
| D1 | «Mi estudio» es un **bloque opcional** del perfil (`studioStructure`) con un interruptor `enabled`. El motor sólo cambia si `enabled === true`. | Mismo patrón que `pricingExtras`: perfil viejo = resultado idéntico. |
| D2 | Encendido, el bloque **reemplaza** (no suma) a: gastos personales, ingresos externos, gastos del negocio, empleados, horas y distribución del tiempo, ahorro personal. **No se borran**: quedan guardados y vuelven si se apaga. | Evita contar dos veces el alquiler o los sueldos. Interruptor reversible. |
| D3 | Se mantienen igual: moneda, equipamiento (renovación, ampliación, cámara), fondo de emergencia, posicionamiento comercial y todo `pricingExtras` (monotributo, seguro de equipo, impuestos, recargos…). | Ya existen; duplicarlos es la trampa principal (ver §12). |
| D4 | El dueño es **una persona más del equipo** (`role: "owner"`), con su jornada y su % vendible. Su costo es el **retiro**. | Un solo cálculo de capacidad para todos. |
| D5 | La capacidad usa **horas vendibles** (jornada × % vendible × semanas trabajadas), no todas las horas. | En un estudio, una parte grande del tiempo (atender, ordenar, redes) no aparece en ningún presupuesto. Ver §6.4 sobre la diferencia con el modo solo. |
| D6 | Precio por persona: **costo de la persona por hora + parte de la estructura por hora**. Lo que no se asigna, al valor hora del estudio. | Ver §7: es exacto en el total y justo en cada trabajo. |
| D7 | Quien cobra «por trabajo» no es estructura: no suma a la capacidad ni a los fijos, y en el presupuesto entra como **tercerizado**. | Es exactamente lo que ya modela el tipo `outsourced`. |
| D8 | «Lo que dejan otras líneas» (productos, cursos) se resta, como hoy se restan los ingresos externos. | Mismo concepto que ya entiende el motor. Es el punto de enganche con Caja (ingresos por línea). |
| D9 | Ganancia deseada del estudio: un % opcional sobre la estructura; entra en el **precio mínimo**. El posicionamiento sigue encima, sólo en el recomendado. | El retiro es tu sueldo; la ganancia es lo que el estudio deja para crecer. Son cosas distintas. |
| D10 | Visible sólo en workspaces de tipo estudio, empresa o productora. | Pedido de Daniel; un freelance no lo necesita. |

---

## 4. Pantallas (UX)

En Configuración → Precios, si el workspace es de tipo estudio (§9), arriba del formulario aparece:

> **¿Trabajás con equipo?** Encendé «Mi estudio» para separar los gastos del local, tu retiro y los sueldos, y para que cada hora se cobre según quién la hace.
> [ Encender Mi estudio ]

Al encenderlo, el formulario cambia de pasos (los del modo solo quedan guardados, ocultos):

| Modo solo (hoy) | Modo estudio |
|---|---|
| Situación laboral | — (oculto) |
| Gastos personales | — (oculto; se ofrece como ayuda en «Tu retiro») |
| Gastos del negocio | **1. Gastos fijos del estudio** |
| Empleados y estructura | **2. Equipo** |
| Disponibilidad y tiempo facturable | **3. Vos en el estudio** (retiro + tu jornada) |
| Equipamiento | Equipamiento (igual) |
| Fondo de emergencia | Fondo de emergencia (igual; pasa a ser del estudio) |
| Vacaciones y ahorro | — (oculto; es personal, va dentro del retiro) |
| — | **4. Otras líneas y ganancia** |
| Posicionamiento comercial | Posicionamiento comercial (igual) |
| Impuestos, cobros y recargos | Impuestos, cobros y recargos (igual) |
| — | **5. Resumen del estudio** |

Al encender por primera vez se precargan los datos que ya hay (§10.2), para no empezar de cero.

### 4.1 Paso 1 · Gastos fijos del estudio

Lista por rubro, con la misma forma que «Gastos personales» (rubros con renglones, renglones propios, subtotal por rubro). Rubros sugeridos y ejemplo:

| Rubro | Renglón | Ejemplo |
|---|---|---|
| Local | Alquiler | $450.000 |
| | Expensas / ABL | $0 |
| Servicios | Luz, gas y agua | $120.000 |
| | Internet y teléfono | $40.000 |
| Software y suscripciones | Lightroom, Drive, FOTOFFICE… | $60.000 |
| Publicidad | Redes y anuncios | $150.000 |
| Administración | Contador, banco | $80.000 |
| Mantenimiento | Limpieza, reparaciones | $50.000 |
| Seguros del local | Responsabilidad civil, incendio | $30.000 |
| **Total** | | **$980.000** |

Avisos en la pantalla:

- «El monotributo y el seguro del equipo se cargan en *Impuestos, cobros y recargos*: no los repitas acá.» Si `pricingExtras` los tiene, se muestran acá como renglones de sólo lectura con un enlace a ese paso.
- «Los sueldos van en *Equipo*, y tu retiro en *Vos en el estudio*.»
- «La inversión en equipo (lentes, tarjetas) va en *Equipamiento*.»

### 4.2 Paso 2 · Equipo

Una tarjeta por persona (el dueño no aparece acá: tiene su paso). Botón «Sumar una persona».

Campos de cada persona:

| Campo | Ejemplo Sabi | Ejemplo Cami | Notas |
|---|---|---|---|
| Nombre | Sabi | Cami | Obligatorio. |
| Su usuario (opcional) | — | — | Vincular a un **miembro** del workspace (decisión 16/10: van a tener usuario). Sólo para reconocerla; el cálculo no lo necesita. No se invita a nadie desde acá. |
| Qué hace | Asistente de fotógrafo | Edición y atención | Texto libre, con sugerencias de los roles de participante del workspace. |
| Sabe hacer | Fotografía, atención | Edición, impresión, atención | Fichas: fotografía, video, edición, retoque, impresión, atención al público, redes, administración. Sirven para sugerir quién hace cada parte al cotizar. |
| Cómo está contratada | Relación de dependencia | Monotributista | Relación de dependencia / **Sin registrar, con aguinaldo y vacaciones pagas** (§0) / Monotributista (factura fija por mes) / Jornal (por día trabajado) / Por trabajo. |
| Sueldo bruto por mes | $900.000 | — | Relación de dependencia. |
| Cargas sociales (%) | 27 % | — | Relación de dependencia. Ayuda: «Aportes patronales, ART y seguro de vida. Suele andar entre 25 % y 30 %: confirmalo con tu contador.» Sin valor por omisión: si está vacío, avisa. |
| Aguinaldo | Sí (encendido) | — | Relación de dependencia. Suma 1/12 del sueldo con cargas por mes. |
| Factura por mes | — | $900.000 | Monotributista. |
| Jornal por día | — | — | Jornal. El costo del mes es jornal × días por semana × 4,33. |
| Por trabajo: cuánto cobra | — | — | Por trabajo: monto y si es «por hora» o «por trabajo». |
| Días por semana | 5 | 4 | No aplica a «por trabajo». Admite decimales; atajos «5», «5 + sábados alternados» (5,5) y «6». |
| Las vacaciones se pagan | Sí | — | Dependencia, informal y jornal. Si no se pagan, el costo baja como las horas. |
| Horas por día | 6 | 8 | |
| Semanas de vacaciones por año | 2 | 2 | Bajan la capacidad, no el costo. |
| % del tiempo que se puede cobrar | 70 % | 75 % | Ayuda: «De sus horas, ¿cuántas terminan en un presupuesto? Sesiones, eventos, edición, retoque, impresión. No cuentes atender el teléfono, ordenar o redes.» Por omisión 70 %. |
| Insumos y gastos por mes | $30.000 | $20.000 | Viáticos, celular, uniforme, capacitación. |
| Activa | Sí | Sí | Una persona inactiva no cuenta (licencia, baja) pero no se borra. |

Debajo de cada tarjeta, en vivo:

> **Sabi** cuesta **$1.268.250 por mes** (sueldo + cargas + aguinaldo + insumos) y puede cobrar **87 horas por mes**. Su costo por hora es **$14.505**; con su parte de la estructura, **su hora se cobra $19.596**.

Para «por trabajo» la tarjeta dice: «No suma a los gastos fijos. Al cotizar, elegila y entra como trabajo tercerizado a $X».

### 4.3 Paso 3 · Vos en el estudio

| Campo | Ejemplo | Notas |
|---|---|---|
| Tu retiro por mes | $2.000.000 | Lo que te llevás vos. Botón de ayuda: «Usar mis gastos personales» copia el total del paso de gastos personales del modo solo (menos ingresos externos, más ahorro) si existe. |
| Días por semana | 6 | |
| Horas por día | 8 | Se precarga con las horas por semana del modo solo. |
| Semanas de vacaciones por año | 3 | |
| % del tiempo que se puede cobrar | 60 % | Ayuda: «Vos también vendés, administrás y atendés. Si ya cargaste la distribución del tiempo, te sugerimos coberturas + edición.» |

En vivo: «Tu hora cuesta $17.020 de retiro; con tu parte de la estructura, **tu hora se cobra $22.110**.»

### 4.4 Paso 4 · Otras líneas y ganancia

- **Líneas del estudio** (lista editable, con sugerencias): Eventos · Sesiones en estudio · Productos e impresiones · Cursos. Cada una tiene nombre y si «vende horas» (eventos, sesiones) o «vende otra cosa» (productos, cursos). En esta etapa la lista sirve para etiquetar presupuestos; con Caja servirá para medir.
- **Lo que dejan por mes las líneas que no venden horas:** $200.000. Ayuda: «Lo que te queda de impresiones, productos o cursos después de pagar sus costos. Eso ya paga una parte del local: se descuenta de lo que tienen que cubrir las horas. Si no sabés, dejalo en cero.»
- **Ganancia del estudio:** un monto por mes (por omisión; Daniel: $500.000) o un %. En el ejemplo de abajo, 10 %. Ayuda: «Aparte de tu retiro: lo que el estudio deja para crecer o para un mes malo. Entra en el precio mínimo. El posicionamiento comercial se suma después, sólo al precio recomendado.»

### 4.5 Paso 5 · Resumen del estudio

Tarjeta de cierre (también la usa el resumen de la página y DNX Bot):

| | Por mes |
|---|---|
| Gastos fijos del estudio | $980.000 |
| Equipo (Sabi $1.268.250 + Cami $920.000) | $2.188.250 |
| Reservas (equipamiento $150.000 + emergencia $100.000) | $250.000 |
| Tu retiro | $2.000.000 |
| − Lo que dejan otras líneas | −$200.000 |
| + Ganancia del estudio (10 %) | $521.825 |
| **Lo que tienen que cubrir las horas** | **$5.740.075** |
| Horas que el equipo puede cobrar | 305 h (vos 118 · Sabi 87 · Cami 100) |
| **Valor hora del estudio** | **$18.828** |

Y la tabla «¿Cuánto vale una hora de cada uno?»: vos $22.110 · Sabi $19.596 · Cami $14.297 · promedio del estudio $18.828.

Aviso si la estructura no cierra: «Con estas horas, el estudio necesita facturar $5.740.075 por mes antes del posicionamiento. Eso son X sesiones como la de tu último presupuesto.» (sólo si hay datos para decirlo).

---

## 5. Modelo de datos (motor, todo opcional)

Nuevo archivo `packages/cuanto-cobro-core/src/studio/types.ts`. Montos y porcentajes como texto, igual que el resto del perfil.

```ts
export type StudioEmploymentType = "" | "employee" | "informal" | "monotributista" | "daily" | "per-job";
export type StudioSkill = "photo" | "video" | "editing" | "retouch" | "printing" | "front-desk" | "social" | "admin";

/** Renglón de gasto fijo: el de siempre + el enganche con Caja (§11). */
export type StudioFixedCostItem = MonthlyExpenseItem & {
  /** Categorías de egreso de Caja que alimentan este renglón (etapa Caja). */
  cashCategoryIds?: string[];
  /** De dónde salió el monto: a mano o propuesto por Caja. */
  amountSource?: "manual" | "cash-average";
};
export type StudioFixedCostGroup = Omit<MonthlyExpenseGroup, "items"> & { items: StudioFixedCostItem[] };

export type StudioPerson = {
  id: string;                       // "sp-…", estable: lo usan las asignaciones de los presupuestos
  role: "owner" | "staff";          // exactamente un "owner"
  name: string;
  link?: { kind: "member"; userId: number };
  jobTitle: string;
  skills: StudioSkill[];
  employmentType: StudioEmploymentType;   // el dueño: ""
  monthlySalary: string;            // employee: bruto; monotributista: factura mensual
  socialChargesPercent: string;     // employee
  includeSac: boolean;              // employee / informal (aguinaldo)
  paidVacations: boolean;           // employee / informal / daily
  dailyRate: string;                // daily
  perJobRate: string;               // per-job
  perJobUnit: "" | "hour" | "job";  // per-job
  workdaysPerWeek: string;
  hoursPerWorkday: string;
  vacationWeeksPerYear: string;
  billablePercent: string;          // vacío = 70
  monthlySupplies: string;
  active: boolean;
  cashCategoryIds?: string[];       // etapa Caja: dónde se registran sus pagos
};

export type StudioBusinessLine = {
  id: string;
  name: string;
  sellsHours: boolean;
  cashCategoryIds?: string[];       // etapa Caja: categorías de ingreso de esta línea
};

export type CuantoCobroStudioStructure = {
  enabled: boolean;
  fixedCostGroups: StudioFixedCostGroup[];
  ownerDrawMonthly: string;
  people: StudioPerson[];           // incluye al dueño
  businessLines: StudioBusinessLine[];
  otherLinesMonthlyContribution: string;
  desiredProfitMode: "amount" | "percent";   // 16/10: por omisión, monto fijo
  desiredProfitMonthly: string;
  desiredProfitPercent: string;
  /** Etapa Caja: la última vez que se propusieron montos desde Caja. */
  cashSync?: { from: string; to: string; computedAt: string } | null;
};
```

En `CuantoCobroProfileInput` se agrega **una sola clave opcional**:

```ts
/** Mi estudio (FOTOFFICE, 2026-10). Opcional: sin ella, o con enabled=false, el motor da lo mismo que antes. */
studioStructure?: import("./studio/types").CuantoCobroStudioStructure;
```

Nombre: `studioStructure` y no `studio`, porque `pricingExtras.studioLatitude/studioLongitude` ya usa «studio» para el punto de partida de los viáticos.

En el trabajo, el concepto (`CuantoCobroQuoteItem`) suma una clave opcional:

```ts
/** Quién hace cada parte (sólo modo estudio). Horas-persona: dos fotógrafos 6 h = 12 h de cobertura. */
assignments?: Array<{
  personId: string;
  activity: "coverage" | "editing" | "delivery" | "travel" | "production" | "management";
  hours: string;
}>;
```

Y el presupuesto (`CuantoCobroQuoteInput`) suma `businessLineId?: string` (la línea del trabajo: informativo ahora, Caja después).

### 5.1 Varias cámaras (16/10/2026)

```ts
/** Cámaras además de la principal. La principal sigue en `primaryCamera*` y es la #1 (id "primary"). */
cameras?: Array<{ id: string; name: string; presetId: string; shutterRating: string; currentShutterCount: string; replacementValue: string }>;

// En el concepto:
cameraId?: string;            // ausente o "primary" = la principal
shotsPer?: "unit" | "job";    // "unit" (por omisión, lo de siempre): disparos × cantidad; "job": del trabajo entero
```

- **Migración en la normalización, sin mover datos:** los campos `primaryCamera*` SON la cámara #1 (`resolveProfileCameras`). No se copian a la lista: un perfil viejo (y CompraMeLaFoto) sigue igual y no hay dos fuentes para la misma cámara.
- Servicio propio: como siempre (con `cameraId` puede usar otra cámara). **Producto físico:** el desgaste se suma sólo si eligió una cámara (`cameraId`), así un producto viejo con disparos sueltos no cambia de precio.
- Los disparos en otra cámara no gastan el obturador de la principal (el aviso de vida útil sigue mirando sólo la principal).
- Cámara borrada o sin valor de reposición / vida útil: sin desgaste y con aviso.
- En la pantalla, «Otras cámaras» aparece en Equipamiento sólo en modo estudio (E2). Elegir la cámara en cada concepto del presupuesto es E3.

**Lo que NO se agrega:** monotributo, IVA, IIBB, seguro de equipo, recargos, hora extra, viáticos (ya están en `pricingExtras`); cámara y equipamiento (ya están en el perfil).

---

## 6. Fórmulas

Constante: `WEEKS_PER_MONTH = 4,33` (la del motor).

### 6.1 Por persona

```
semanasTrabajadas_p = (52 − vacaciones_p) / 52
horasMes_p          = días_p × horasDía_p × 4,33 × semanasTrabajadas_p
horasVendibles_p    = horasMes_p × (vendible_p / 100)              (vendible vacío = 70)

costoMes_p:
  employee        = sueldo × (1 + cargas/100) × (aguinaldo ? 13/12 : 1) × (vacacionesPagas ? 1 : semanasTrabajadas) + insumos
  informal        = igual que employee, con cargas 0
  monotributista  = factura + insumos
  daily           = jornal × días_p × 4,33 × (vacacionesPagas ? 1 : semanasTrabajadas_p) + insumos
  per-job         = 0   (no es estructura; no suma horas)
  owner           = retiro

costoHora_p = costoMes_p / horasVendibles_p
```

(Desde el 16/10, si las vacaciones se pagan o no es una opción por persona.)

### 6.2 Estudio

```
fijos       = Σ renglones de gastos fijos
equipo      = Σ costoMes_p de las personas activas que no son el dueño ni "per-job"
reservas    = renovación + ampliación de equipo (las del motor) + fondo de emergencia
fijosExtras = monotributo + seguro de equipo anual / 12   (pricingExtrasFixedMonthly, ya existe)
base        = fijos + equipo + reservas + fijosExtras + retiro − otrasLíneas
ganancia    = monto fijo por mes  |  max(0, base) × ganancia% / 100
necesidad   = max(0, base + ganancia)

capacidad   = Σ horasVendibles_p   (activas, sin "per-job", con el dueño)
valorHoraEstudio = necesidad / capacidad

estructuraPorHora = (necesidad − Σ costoMes de quienes tienen horas vendibles) / capacidad
                    (el costo de alguien con 0 % vendible, como una recepcionista, va a la estructura)
tarifa_p          = costoHora_p + estructuraPorHora
```

Propiedad (se prueba): `Σ tarifa_p × horasVendibles_p = necesidad`. El promedio de las tarifas, pesado por horas, **es** el valor hora del estudio. Por eso cobrar «por persona» y cobrar «al promedio» recuperan lo mismo si el estudio llena su capacidad; la diferencia es cómo se reparte entre trabajos.

### 6.3 Ejemplo resuelto (los números de §4)

| Persona | Jornada | Horas/mes | Vacaciones | Vendible | Horas vendibles | Costo/mes | Costo/hora | Tarifa |
|---|---|---|---|---|---|---|---|---|
| Daniel (dueño) | 6 × 8 | 207,8 | 3 sem | 60 % | 117,5 | $2.000.000 (retiro) | $17.020 | **$22.110** |
| Sabi (dependencia) | 5 × 6 | 129,9 | 2 sem | 70 % | 87,4 | $900.000 × 1,27 × 13/12 + $30.000 = $1.268.250 | $14.505 | **$19.596** |
| Cami (monotributo) | 4 × 8 | 138,6 | 2 sem | 75 % | 99,9 | $900.000 + $20.000 = $920.000 | $9.207 | **$14.297** |
| **Estudio** | | | | | **304,9** | | | **$18.828** |

```
base      = 980.000 + 2.188.250 + 250.000 + 0 + 2.000.000 − 200.000 = 5.218.250
ganancia  = 10 % = 521.825
necesidad = 5.740.075
valorHoraEstudio  = 5.740.075 / 304,87 = 18.828
estructuraPorHora = (5.740.075 − 2.188.250 − 2.000.000) / 304,87 = 5.090
```

**Trabajo 1 · Sesión en estudio:** 1 h de sesión (Daniel) + 2 h de edición (Cami).
- Por persona: 22.110 + 2 × 14.297 = **$50.705** de costo de horas.
- Al promedio: 3 × 18.828 = $56.485.
- Después, igual que hoy: costos directos, desgaste de cámara, posicionamiento (estable ×1,25), precio completo.

**Trabajo 2 · Evento:** 6 h de cobertura con dos fotógrafos (Daniel y Sabi) + 1 h de viaje cada uno + 10 h de edición (Cami) = 24 horas-persona.
- Por persona: 7 × 22.110 + 7 × 19.596 + 10 × 14.297 = **$434.913**.
- Al promedio: 24 × 18.828 = $451.878.

**Para comparar, el modo solo de hoy** con los mismos costos metidos en los campos viejos: (980.000 + 2.188.250 + 250.000 + 2.000.000) / (48 × 4,33) = **$26.069 por hora**, cobrada igual sea quien sea, y las 24 horas del evento darían $625.664. Las horas de Sabi y Cami no cuentan como capacidad, por eso la hora queda inflada.

### 6.4 Por qué «horas vendibles» y no «todas las horas»

El modo solo divide por todas las horas de la semana y cobra en cada presupuesto las horas de cobertura, edición, entrega, viaje y con el cliente. Funciona porque el fotógrafo solo cobra casi todo lo que hace. En un estudio, buena parte del tiempo del equipo (atender la puerta, ordenar, redes) no aparece en ningún presupuesto: si se divide por todas las horas, la hora queda barata y el mes no cierra. Por eso el modo estudio pide un % vendible por persona. **El modo solo no cambia** (no se toca `getProfileCostHour` sin el bloque).

---

## 7. Presupuestos: tarifa del estudio o tarifa por persona

| | A · Todo al valor hora del estudio | B · Costo de la persona + parte de la estructura |
|---|---|---|
| Cómo se cobra | Cada hora, sea de quien sea, a $18.828 | Cada hora a la tarifa de quien la hace ($22.110 / $19.596 / $14.297) |
| Recupera el mes si se llena la capacidad | Sí | Sí (misma necesidad; §6.2) |
| Trabajo con mucha edición de Cami | Sale caro frente al mercado | Sale a su costo real |
| Trabajo con mucho tiempo del dueño | Sale barato: el dueño subsidia con su hora | Sale a su costo real |
| Esfuerzo al cotizar | Ninguno: horas totales | Decir quién hace qué (opcional) |
| Cambios en el motor | Casi ninguno | Asignaciones en el concepto + tarifas por persona |
| Riesgo | Que los trabajos «baratos de hacer» se pierdan por caros y queden sólo los que dejan poco | Asignar mal (por ejemplo, poner todo a la persona más barata) |

**Recomendación: B, con A como respaldo automático.** Las horas que se asignan a una persona van a su tarifa; las que no se asignan van al valor hora del estudio. Así:

- Quien no quiere detallar cotiza como hoy (horas totales) y obtiene A.
- Quien detalla obtiene el precio justo del trabajo, y el total del mes sigue cerrando, porque la tarifa promedio es el valor hora del estudio.
- El panel avisa si un trabajo usa a alguien por encima de sus horas vendibles del mes («Cami tiene 100 h vendibles por mes y este trabajo le asigna 120»).

Reglas del motor para B:

1. Por concepto y por actividad: `horasAsignadas = Σ assignments(actividad)`. Si `horasAsignadas > 0`, el costo de esa actividad = Σ horas × tarifa de esa persona + `max(0, horasDelConcepto − horasAsignadas)` × valor hora del estudio. Si las asignaciones superan las horas del concepto, **mandan las asignaciones** (son horas-persona) y el motor avisa que las horas del concepto se ajustaron. El panel mantiene las horas del concepto = suma de asignaciones cuando las hay.
2. Una persona inexistente o inactiva en el perfil → esas horas van al valor hora del estudio y se avisa.
3. Una persona «por trabajo» no se asigna en servicio propio: el panel la ofrece como concepto **tercerizado** (costo = tarifa × horas o tarifa por trabajo, con el % de margen del tercerizado).
4. Las horas con el cliente (ventas, reuniones, coordinación) van al valor hora del estudio en esta etapa (pregunta P5).
5. El retoque de `pricingExtras` sigue usando el valor hora del estudio (`costHour`); asignarlo a una persona queda para después.
6. Hora extra (`overtimeHourPrice` del precio completo): sobre el valor hora del estudio, igual que hoy.

### 7.1 En el panel «Armar con ¿Cuánto Cobro?»

En cada concepto de servicio propio, si el perfil está en modo estudio, debajo de cada tipo de hora aparece «¿Quién?» con fichas de personas (las que «saben hacer» esa actividad primero). Ejemplo:

```
Cobertura   [Daniel 6 h] [Sabi 6 h] [+ persona]      → 12 h-persona
Edición     [Cami 10 h]                               → 10 h
Viaje       [Daniel 1 h] [Sabi 1 h]                   → 2 h
```

Y una línea «Este trabajo usa: Daniel 7 h · Sabi 7 h · Cami 10 h». Selector de línea del estudio arriba del trabajo («Eventos»).

`TrabajoPanel` suma `asignaciones?: { persona: string; actividad: …; horas: string }[]`; `armarItemsDelAsistente` las pasa a `item.assignments`. La instantánea del ítem ya guarda `{ perfil, presupuesto }`: las asignaciones y el perfil con sueldos quedan adentro y **son internos** (los saca `itemSinDatosInternos`, igual que hoy).

---

## 8. Cambios en el motor (puros y probados)

Todos en `packages/cuanto-cobro-core`, sin React, Next ni Prisma (lo vigila `architecture.purity.test.ts`).

1. **`src/studio/types.ts`**: los tipos de §5 + `INITIAL_STUDIO_STRUCTURE` + rubros sugeridos (`createDefaultStudioFixedCostGroups`).
2. **`src/studio/normalize.ts`**: `normalizeStudioStructure(raw): CuantoCobroStudioStructure | null` (como `normalizePricingExtras`): completa con iniciales, filtra personas sin id, garantiza un solo dueño (si no hay, lo crea), topes (30 personas, 20 líneas, 60 renglones, `cashCategoryIds` ≤ 10).
3. **`src/studio/capacity.ts`**: `computeStudioPerson(person, structure)` → `{ monthlyHours, billableHours, monthlyCost, costPerHour }` y `computeStudioBreakdown(profile, model)` → `{ fixed, team, reserves, fixedFromExtras, ownerDraw, otherLines, profit, monthlyNeed, capacityHours, studioHourRate, overheadPerHour, people: [{ id, name, billableHours, monthlyCost, costPerHour, rate }], warnings }`.
4. **`isStudioModeActive(profile)`** = `profile.studioStructure?.enabled === true`.
5. **`hourly-rates.ts`**: `getProfileMonthlyNeed` y `getProfileMonthlyHours` derivan a `computeStudioBreakdown` si el modo está activo (para el estudio, `getProfileMonthlyHours` devuelve la capacidad vendible). Así `getProfileCostHour`, `getQuoteLaborRates`, el resumen de FOTOFFICE y el bot reciben el valor hora del estudio sin tocarlos. `QuoteLaborRates` suma `byPerson?: Record<string, number>` (sólo en modo estudio).
6. **`quote-item-calculations.ts`**: `calculateQuoteItem` aplica las reglas de §7 cuando el concepto trae `assignments` y `rates.byPerson` existe. Sin `byPerson`, ignora las asignaciones (un presupuesto armado en modo estudio y recalculado con el modo apagado da el precio del modo solo, con aviso). El resultado del ítem suma `laborByPerson?: { personId, hours, cost }[]`.
7. **Validación por modo**: `getProfileResultSteps(profile)` (nuevo, exportado) devuelve los pasos del modo; con el estudio: `currency`, `studio-costs`, `studio-team`, `studio-owner`, `investment`, `emergency-fund`, `commercial-positioning`. `getCuantoCobroMissingFields` acepta los ids nuevos (tipo `CuantoCobroStudioStepId`, **fuera** de `CC_WIZARD_STEPS`, que comparte CompraMeLaFoto). Faltantes del estudio: dueño con retiro > 0 y jornada > 0; cada persona activa con tipo de contratación y su monto; cargas sociales vacías en relación de dependencia → aviso, no bloqueo; capacidad > 0.
8. **`calculateCuantoCobro`**: en modo estudio, `personalExpenses` = retiro, `businessExpenses` = fijos, `teamExpenses` = equipo, `externalIncome` = otras líneas, `monthlyAvailableHours`/`monthlyBillableHours` = capacidad vendible, `coveragePercentage` = capacidad / horas totales. Suma la clave opcional **`studio?: CuantoCobroStudioBreakdown`** sólo si el modo está activo (mismo patrón que `priceBuildUp`).
9. **Exportar** desde `index.ts` y `package.json` (`./studio/*`).

Pruebas (vitest, en el paquete):

- `studio/capacity.test.ts`: el ejemplo de §6.3 exacto; cada tipo de contratación; aguinaldo prendido y apagado; personas inactivas; «por trabajo» no suma; capacidad 0 → incompleto.
- Propiedad: `Σ tarifa_p × horasVendibles_p ≈ necesidad` (al centavo) con perfiles generados.
- `studio/backward-compat.test.ts` (como `pricing-extras/backward-compat.test.ts`): con los fixtures de caracterización, sin bloque / con `enabled: false` / con bloque vacío → resultado idéntico y sin clave `studio`.
- `calculate-cuanto-cobro.characterization.test.ts` y `adapter-shape-contract.test.ts` siguen verdes sin tocar los snapshots.
- Asignaciones: sin asignar = A; todo asignado = B; parcial; exceso; persona borrada.
- Interacción con PR 602: recargos sobre la parte de servicio propio calculada con tarifas por persona; monotributo sumado una sola vez.

---

## 9. Quién lo ve (gating)

El tipo de workspace está en dos columnas y con **dos vocabularios en la misma columna**:

- `organizationType` lo escribe `setOrganizationType` (Configuración → Módulos) con los ids de la portada (`lib/landing/tipos.ts`: `freelance`, `local`, `estudio`, `escuela`…). DNX Estudio tiene `"local"`.
- El mismo `organizationType` también puede tener los ids en mayúsculas de `FOTOFFICE_ORGANIZATION_TYPES` (`PHOTO_STUDIO`…), que es lo que miran las pruebas de DNX Bot.
- `activityType` tiene los ids en mayúsculas o los viejos (`studio`, `agency`), normalizados por `normalizeFotofficeOrganizationType`.

Regla nueva, pura, en `lib/precios/estudio.ts`:

```ts
export function ofreceMiEstudio(b: { organizationType: string | null; activityType: string | null } | null): boolean
// true si organizationType ∈ {"local", "estudio"}
//   o normalizeFotofficeOrganizationType(organizationType || activityType) ∈ {PHOTO_STUDIO, PHOTOGRAPHY_COMPANY, AGENCY_PRODUCTION}
```

- Decide **sólo si se ofrece el interruptor** en la pantalla y en el bot. El motor nunca mira el tipo: mira `studioStructure.enabled`.
- Si un perfil tiene el modo encendido y el workspace cambia de tipo, se sigue calculando igual (no cambian precios en silencio) y la pantalla muestra «Tu organización ya no es de tipo estudio; podés apagar Mi estudio».
- Permisos: los de siempre. Ver y guardar exige `configurar` (`veCostos`). Los sueldos son tan privados como los gastos personales: un STAFF (Sabi o Cami, si algún día son miembros) no los ve.

---

## 10. Compatibilidad

### 10.1 Garantías

- **Solo y CompraMeLaFoto:** sin `studioStructure` (o con `enabled: false`) el motor da exactamente lo mismo; probado con los fixtures de caracterización. CompraMeLaFoto no guarda la clave y su asistente usa `CC_WIZARD_STEPS`, que no cambia.
- **`normalizarPerfil`** (FOTOFFICE) hoy hace `{ ...INITIAL, ...raw }`: una clave desconocida pasa sin validar. Se agrega `normalizeStudioStructure` igual que con `pricingExtras` (si no es válido, se borra la clave) y `validarPerfil` revisa montos y porcentajes del bloque.
- **Presupuestos guardados:** su instantánea tiene el perfil de ese momento; se recalculan igual. Uno armado con el modo encendido conserva su perfil con el bloque.
- **Apagar el modo:** vuelve el cálculo del modo solo con los campos viejos, que nunca se tocaron.
- **Tamaño:** 30 personas + 60 renglones ≈ 25 KB, lejos del tope de 150 KB.
- **`schemaVersion`** sigue en 1 (la clave es opcional y aditiva).

### 10.2 Al encender por primera vez (precarga, sólo en la pantalla)

- Gastos fijos: `businessRent` → Local/Alquiler; `businessSoftware` → Software; `businessMarketing` → Publicidad.
- Equipo: si `employeesCount = N > 0`, N tarjetas «Persona 1…N» con `employeeMonthlyCost / N` como monto y **sin tipo de contratación** (falta elegirlo). Para DNX Estudio: 2 tarjetas para renombrar a Sabi y Cami.
- Dueño: horas por día = `weeklyHours / días`; vendible sugerido = % de coberturas + edición de `timeDistribution`; retiro sugerido = gastos personales − ingresos externos + ahorro (botón, no automático).
- Nada de esto se guarda hasta tocar «Guardar».

---

## 11. Enganche con Caja (la etapa siguiente; acá sólo los datos)

Lo que queda preparado:

- Cada renglón de gasto fijo, cada persona y cada línea del estudio puede llevar `cashCategoryIds` (categorías de Caja que le corresponden) y el renglón, `amountSource` (`manual` o `cash-average`).
- `cashSync` guarda el período que se usó (desde, hasta, cuándo).
- El presupuesto lleva `businessLineId`; el pedido podrá heredarlo para etiquetar el ingreso.

Cómo va a funcionar (para la próxima spec, no se diseña acá):

- Una función de servidor lee los `CashMovement` de EGRESO de los últimos 3 meses calendario completos (hora argentina, excluyendo transferencias `transferId` y anulaciones), los agrupa por `categoryId`, y propone para cada renglón el promedio mensual de sus categorías. Clasificación de cada categoría: fijo / retiro / sueldo de una persona / de trabajo (costo directo, no entra) / ignorar.
- Los ingresos por línea (categorías de INGRESO etiquetadas con una línea) permiten medir «lo que dejan otras líneas» en vez de estimarlo.
- **La propuesta nunca pisa sola**: muestra «Caja dice $X (promedio jul–sep), vos tenés $Y» y la persona acepta renglón por renglón. El motor sigue puro: nunca lee Caja; lee el perfil.
- Advertencia: DNX Estudio hoy tiene 0 movimientos y 0 categorías en Caja. Esta etapa recién sirve después de unos 3 meses de cargar movimientos con categorías.

---

## 12. DNX Bot

- **Etapa 1 (perfil):** si el workspace `ofreceMiEstudio` y la persona habla de empleados o de local, el bot ofrece el modo estudio. `esquemaParchePerfil` suma un bloque `estudio`: `activar`, `gastosFijos[]` (rubro, renglón o etiqueta, monto), `retiro`, `personas[]` (nombre, contratación, sueldo o factura o jornal, cargas %, aguinaldo, días, horas, vacaciones, % vendible, insumos), `otrasLineas`, `ganancia`. Con el modo activo, `negocio.colaboradores/costoColaboradores` se rechazan con un mensaje («en modo estudio, cada persona va en el equipo»).
- `ver_perfil_de_precios` y la tarjeta de perfil muestran el resumen de §4.5 (valor hora del estudio y tarifa de cada persona).
- **Guía de perfil** (`guia/perfil.ts`): en modo estudio, preguntar en orden: gastos fijos del local, el equipo de a una persona (contratación y jornada primero), retiro, % vendible, otras líneas, ganancia. Nunca inventar el % de cargas sociales: si no lo sabe, queda vacío y se le dice que lo confirme con el contador.
- **Etapa 2 (cotizar):** `esquemaTrabajoBot` suma `asignaciones?: { persona: nombre o id, actividad, horas }[]`. Guía de cotizar: «Si el perfil está en modo estudio, preguntá quién hace cada parte (cobertura, edición, viaje). Si no lo dice, va al valor hora del estudio y se lo decís». Nunca calcular tarifas a mano: salen del resultado (`studio.people[].rate`).
- **Evals:** un perfil de prueba de estudio (los números de §6.3) y dos escenarios: la sesión y el evento de §6.3, con y sin asignaciones.

---

## 13. Decisiones para que Daniel confirme

> **16/10/2026: confirmadas.** Cambios: ganancia por monto fijo (6), tipo «informal» y vacaciones pagas por persona (4, 5), vínculo con miembros del workspace (no con contactos).

1. **Modo encendible y reversible** que reemplaza los pasos del modo solo, sin borrarlos (D1, D2).
2. **Precio por persona (B) con respaldo al promedio (A)** para lo no asignado (§7).
3. **% vendible por persona, 70 % por omisión** para empleados; para vos se sugiere desde tu distribución del tiempo. Cambia la base del cálculo respecto del modo solo (que divide por todas las horas).
4. **Aguinaldo incluido** en relación de dependencia (13/12) y **cargas sociales sin valor por omisión** (sólo una ayuda de 25–30 % para confirmar con el contador).
5. **Vacaciones bajan la capacidad, no el costo** (salvo jornal, que no cobra los días que no trabaja).
6. **Ganancia del estudio** como % aparte del retiro, dentro del precio mínimo; el posicionamiento sigue encima, sólo en el recomendado. Ojo: con 10 % de ganancia y ×1,25 de posicionamiento, el recomendado queda 37,5 % arriba del costo.
7. **«Por trabajo» = tercerizado**, fuera de la estructura.
8. **«Lo que dejan otras líneas» resta**, como hoy los ingresos externos.
9. **Fondo de emergencia pasa a ser del estudio; el ahorro y las vacaciones personales van dentro del retiro.**
10. **Gating**: estudio, local, empresa de fotografía o productora; el interruptor lo decide la persona.
11. Las **horas con el cliente** y el **retoque** van al valor hora del estudio en esta etapa.

---

## 14. Preguntas abiertas para Daniel

> **16/10/2026, contestadas:** P1 (lunes a sábado con sábados alternados; informales con todo pago; horas por día sin dato), P3 (vacaciones pagas), P4 (retiro $1.000.000), P7 ($500.000 fijos), P9 (van a tener usuario), P10 (monotributo). P8: la cámara de carnets es otra (§5.1). **Siguen abiertas:** horas por día de cada una, P2 (% vendible), P5, P6, P11, y cuánto paga de monotributo.

- **P1.** ¿Cómo están contratadas Sabi y Cami (dependencia, monotributo, jornal)? ¿Qué jornada tiene cada una (días y horas)?
- **P2.** ¿Qué hace cada una en la práctica, y qué parte de su tiempo termina en un presupuesto (sesiones, eventos, edición, impresión) frente a atención, orden y redes?
- **P3.** Si alguna cobra jornal: ¿se le pagan las vacaciones o los feriados?
- **P4.** ¿Cuánto querés retirar por mes? ¿Y el fondo de emergencia del estudio es el mismo que tenías cargado?
- **P5.** Las horas con el cliente (reuniones, ventas, coordinación): ¿las hacés siempre vos? Si sí, convendría cobrarlas a tu tarifa y no al promedio.
- **P6.** ¿Qué dejan por mes, aproximadamente, las impresiones, los productos y los cursos después de sus costos?
- **P7.** ¿Querés una ganancia del estudio aparte de tu retiro? ¿De cuánto?
- **P8.** En eventos con dos fotógrafos, ¿Sabi usa una cámara del estudio? Hoy el desgaste se calcula con una sola cámara (PR 598); el segundo cuerpo no se cuenta.
- **P9.** ¿Sabi y Cami van a ser miembros de FOTOFFICE (con usuario) o sólo contactos colaboradores? Define con qué se vincula cada tarjeta.
- **P10.** Hoy el estudio, ¿es monotributo o responsable inscripto? Con empleados en relación de dependencia suele ser RI, y eso cambia el IVA del precio completo (paso «Impuestos, cobros y recargos»).
- **P11.** ¿Las horas extra de las empleadas (que se pagan con recargo) deberían entrar al costo de un evento largo? Hoy la «hora extra» del precio completo es lo que le cobrás al cliente, no lo que les pagás a ellas.

---

## 15. Plan por etapas

| Etapa | Qué | Tareas aprox. | Resultado visible |
|---|---|---|---|
| **E1 · Motor** ✅ | §5 y §8: tipos, normalización, capacidad y tarifas, desvío en `hourly-rates`, validación por modo, clave `studio` en el resultado, pruebas de compatibilidad y propiedad. **Más (16/10): tipo informal, vacaciones pagas, días con decimales, ganancia fija y varias cámaras con disparos por unidad o por trabajo.** Sin asignaciones todavía. | 10–12 | Nada para el usuario; CLF y FOTOFFICE idénticos (pruebas). |
| **E2 · Configuración → Precios** ✅ | `ofreceMiEstudio`, «Otras cámaras» en Equipamiento, vínculo con miembros, interruptor, pasos 1–5, precarga, `normalizarPerfil`/`validarPerfil`, `resumen.ts` usando `getProfileResultSteps` (deja de copiar la lista), tarjeta de resumen. | 9–11 | DNX Estudio puede cargar Sabi, Cami, fijos y retiro y ver el valor hora del estudio. Los presupuestos ya usan ese valor (modo A). |
| **E3 · Asignaciones en presupuestos** ✅ (más cámara por concepto, disparos por unidad o por trabajo, y «Quién lo hace» en la tarjeta del ítem) | `assignments` en el motor (§7), «¿Quién?» en el panel, persona «por trabajo» como tercerizado, aviso de capacidad, `businessLineId`, instantánea. | 7–9 | Cotizar «Daniel 6 h + Sabi 6 h + Cami 10 h» (modo B). |
| **E4 · DNX Bot** | Parche `estudio`, tarjeta, guías de perfil y cotizar, asignaciones en `cotizar_trabajo`, evals. | 6–8 | Armar el estudio y cotizar con quién hace qué, conversando. |
| **Catálogo: margen a la vista** | Pedido de Daniel (16/10): en el catálogo (lista y ficha del producto), siempre que haya costo y precio cargados, mostrar costo, precio y **margen %** = (precio − costos) / precio. Los costos-plantilla ya existen (`lib/catalogo/costos.ts`: fijos y por unidad); el margen se calcula con una unidad. | 3–4 | Ver el margen de cada producto sin hacer cuentas. |
| **E5 · Caja (spec aparte)** | Clasificar categorías, promedio de 3 meses, propuesta renglón por renglón, ingresos por línea. | (a diseñar) | Gastos fijos reales propuestos desde Caja. |

E1 y E2 se pueden fusionar juntas; E3 depende de E1; E4 depende de E2 y E3. Sin migraciones en E1–E4 (todo va en `profileData` y en la instantánea del ítem, que ya son JSON). Como FOTOFFICE va directo a producción, E2 se prueba con `next dev` contra la base real sólo leyendo, y el primer guardado en DNX Estudio lo hace Daniel.
