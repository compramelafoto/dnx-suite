# Mercado de cursos

Diseño acordado con Daniel el 2026-10-05. Amplía los cursos grabados que ya están en producción
(`2026-09-21-cursos-grabados-design.md` y `2026-10-04-cursos-en-el-portal-design.md`, PR 351).

Un docente sube sus cursos a FOTOFFICE y cualquier institución puede venderlos, cada una con su
propio porcentaje acordado. Un curso puede tener varios beneficiarios (por ejemplo la institución
que presta la sala de streaming, el productor del video y el docente), y cada pago se reparte
solo entre todos con el split de Mercado Pago.

---

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Comisión de la plataforma | **5% del precio de lista, cobrado encima al comprador.** Curso de $100.000 → el alumno paga $105.000. Con descuento para socios, el 5% sigue calculándose sobre la lista |
| Comisión de Mercado Pago | **Sale entera de la parte de un beneficiario marcado** (por defecto, el docente) |
| Beneficiarios | El dueño del curso define una lista con porcentajes que suman 100% (ej. 30% institución, 20% productor, 50% docente) |
| Quién puede ser beneficiario | **Un negocio en FOTOFFICE** (workspace) con Mercado Pago conectado. Así ya funcionan los cobros, y el split le deposita a esa cuenta |
| Reventa | Otra institución vende el curso con un % que **sale de arriba**: el resto se reparte entre los beneficiarios en proporción |
| Cómo se acuerda la reventa | **% sugerido + aprobación**: hasta el sugerido, se aprueba solo; por encima, lo aprueba el dueño |
| Descuento para socios | Quien vende puede dar hasta **su propio %** como descuento. Nunca toca la parte de los demás |
| "Gratis para socios" | Sólo si quien lo ofrece es **el único beneficiario** (100%) |
| Split de Mercado Pago | **Se programa completo y queda apagado** hasta que MP lo habilite para la suite |
| Simulador | El dueño ve, mientras carga el precio y los porcentajes, cómo queda repartida la plata, con **el mismo motor que después cobra** |
| Login | Una persona, una cuenta, varios perfiles. Nada nuevo en el inicio de sesión (sección 3) |

---

## 2. El reparto de cada venta

### 2.1 La cuenta

Todo en **centavos enteros** y porcentajes en **puntos básicos** (10000 = 100%).

Entradas:
- `L`: precio de lista del curso.
- `F`: comisión de la plataforma en puntos básicos (por defecto 500 = 5%, la de la configuración
  existente `WorkspaceModuleFee` del módulo de cursos de quien vende).
- Beneficiarios: `b_i` en puntos básicos, suman 10000; uno marcado `absorbeComisionMp`.
- Reventa (opcional): `R` en puntos básicos.
- Descuento (opcional): `D` en puntos básicos, con `D ≤` la parte propia de quien vende (`R` si
  revende; su `b_i` si es beneficiario y vende él; 10000 si es el único beneficiario).

Cálculo:
1. `comisionPlataforma = redondeo(L × F / 10000)`.
2. `descuento = redondeo(L × D / 10000)`.
3. `pagaElAlumno = L − descuento + comisionPlataforma`.
4. Con reventa: `parteRevendedor = redondeo(L × R / 10000) − descuento` (nunca negativa por el
   tope de `D`) y `aRepartir = L − redondeo(L × R / 10000)`. Sin reventa: `aRepartir = L`.
5. A cada beneficiario: `piso(aRepartir × b_i / 10000)`. Los centavos que sobran por redondeo van
   al que absorbe la comisión de MP.
6. Sin reventa y con descuento: el descuento se resta **sólo** de la parte del beneficiario que
   vende (nunca negativa por el tope de `D`).
7. La comisión de Mercado Pago no la calcula el motor: la descuenta MP al acreditar, sobre el
   beneficiario que absorbe (sección 5.2). El simulador la muestra como **estimación**.

La suma de todas las partes más la comisión de la plataforma es exactamente `pagaElAlumno`. Es un
test.

### 2.2 Ejemplos (curso de $100.000, beneficiarios 30% SFPR / 20% productor / 50% docente)

| Caso | Paga el alumno | Plataforma | SFPR | Productor | Docente (antes de MP) |
|---|---|---|---|---|---|
| SFPR vende al público | $105.000 | $5.000 | $30.000 | $20.000 | $50.000 |
| SFPR se lo da a un socio con 30% de descuento | $75.000 | $5.000 | $0 | $20.000 | $50.000 |

Mismo curso, revendido por "Fotoclub Norte" con un acuerdo del 25%:

| Caso | Paga el alumno | Plataforma | Fotoclub Norte | SFPR | Productor | Docente |
|---|---|---|---|---|---|---|
| Venta al público | $105.000 | $5.000 | $25.000 | $22.500 | $15.000 | $37.500 |
| Socio de Fotoclub Norte con 25% de descuento | $80.000 | $5.000 | $0 | $22.500 | $15.000 | $37.500 |

### 2.3 Cada venta guarda su reparto

Al abrir el pago se congela el reparto completo, una fila por parte. Si después cambian los
porcentajes o el acuerdo, lo ya vendido no cambia.

---

## 3. Quién es quién y cómo entra (login)

Una persona tiene **una sola cuenta**, que puede tener varios perfiles. Es el modelo que ya existe
(`lib/portal/profiles.ts`, selector `/elegir-perfil`).

| Persona | Perfil | Qué ve |
|---|---|---|
| Docente (ej. Maxi Oviedo) | Dueño de su negocio en FOTOFFICE | Panel: Mis cursos (su galería), Beneficiarios, Reventas, Cobros |
| Productor del video | Dueño de su productora | Panel: cursos donde es beneficiario, Cobros |
| Administrador de una institución | Equipo de la institución | Panel: Mercado de cursos, sus reventas, Cobros |
| Socio | Socio | Portal: Cursos (comprados, gratis o con descuento) |
| Alumno | Alumno | Portal: Mis cursos (ya en producción) |

**Por qué no se mezclan:** cada perfil lleva a un lugar distinto y cada pantalla comprueba el
suyo, como hoy. El panel exige ser equipo del negocio; el portal, ser socio o alumno.

**Crear el negocio propio ya existe** (`createOwnBusinessAction`): está en la portada del portal
del socio, en el selector de perfil y en la bienvenida. Siempre es un botón explícito. Se suma:
- La invitación en **Mis cursos del alumno**, que hoy no la tiene.
- Un texto para docentes: "¿Querés enseñar? Creá tu espacio, subí tus cursos y que las
  instituciones los vendan." En Mis cursos, en el portal del socio y en la página pública de cada
  curso. En la página pública, lleva a registrarse.

---

## 4. Beneficiarios, mercado y reventa

### 4.1 Beneficiarios

- El **dueño** del curso es el negocio que lo carga y el único que lo edita.
- Arma la lista de beneficiarios: busca un negocio de FOTOFFICE o invita por correo a quien todavía
  no tiene uno. Cada uno con su %, la suma tiene que dar 100%. Uno queda marcado como el que absorbe
  la comisión de MP (por defecto, el de rol Docente).
- Cada beneficiario **acepta** la invitación desde su panel. Al aceptar ve el curso, su %, el
  precio de lista y el simulador.
- El curso **sólo se vende con reparto** si todos aceptaron y tienen Mercado Pago conectado. Hasta
  entonces, la ficha dice qué falta y de quién.
- Máximo **10 beneficiarios más el revendedor**: es el límite de receptores de Mercado Pago
  (`MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS = 10`).
- Un curso con **un solo beneficiario que es el dueño** es el caso de hoy y funciona sin split.

### 4.2 Mercado de cursos

- El dueño activa **"Ofrecer a otras instituciones"** y fija el **% sugerido** para revendedores.
- Cualquier negocio con el módulo de cursos ve en su panel el **Mercado de cursos**: título,
  docente, precio de lista, % sugerido, cantidad de clases y la clase de muestra.

### 4.3 Acuerdo de reventa

- La institución toca **"Quiero venderlo"** e indica su %. Hasta el sugerido, el acuerdo queda
  **activo** al instante; por encima, queda **pendiente** y le llega al dueño para aprobar o
  rechazar.
- Al acordar, la institución también fija el **descuento para sus socios** (de 0 hasta su %).
  Lo puede cambiar cuando quiera; vale para las ventas nuevas.
- Cualquiera de los dos puede **pausar** o **terminar** el acuerdo. Los alumnos que ya compraron
  conservan su acceso.
- Un curso revendido aparece en el sitio público y en el portal de la institución que lo revende,
  con su marca, igual que sus cursos propios.

### 4.4 "Gratis para socios"

Sólo puede activarlo un negocio que es **el único beneficiario** del curso. En cualquier otro caso
el máximo es un descuento igual a su propio %. La regla está en el servidor, no sólo en la pantalla.

---

## 5. Venta y cobro

### 5.1 Con el split apagado (hoy)

- Cursos de **un solo beneficiario que es quien vende**: se venden como hoy, cobra quien vende con
  su Mercado Pago, con el 5% **encima** al comprador como comisión de la plataforma.
- Cursos con **varios beneficiarios o revendidos**: se pueden armar, invitar, acordar y simular,
  pero la página de venta muestra **"Disponible próximamente"** en lugar del botón de compra. Así
  ningún beneficiario queda sin cobrar.

### 5.2 Con el split encendido

- Una sola **orden de Mercado Pago** (Orders API) con reparto de montos fijos
  (`split_rules.amount_type = "fixed"`), calculados por el motor.
- El **beneficiario que absorbe la comisión de MP es el dueño de la orden** (`receiver_type:
  "owner"`) y el resto son socios del split (`partner`). MP cobra su comisión sobre el dueño de la
  orden, así que sale sola de esa parte. **A confirmar con Mercado Pago durante la homologación**;
  si no fuera así, el motor descuenta una estimación de esa parte.
- La comisión de la plataforma va en la misma orden como comisión de la plataforma.
- Antes de crear la orden se verifica que cada receptor tenga su consentimiento **ACTIVE** real.
- Si hay una devolución, MP revierte el reparto y el alumno pierde el acceso.

### 5.3 El interruptor

FOTOFFICE tiene hoy el split apagado a propósito (`lib/payments/split-1n.ts`, decisión del
2026-08-26 en `docs/payments/fotoffice-split-1n-disabled.md`: "todavía no hay un caso productivo").
Este diseño **es** ese caso. La etapa 4 actualiza esa decisión y su test, pero **la constante sigue
en `false`**: se pasa a `true` en un cambio de código revisado cuando Mercado Pago habilite el split
en producción para la suite. Además vale el guard general `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED`.

### 5.4 Cambio sobre lo que ya está en producción

Hoy, en un curso grabado, el 5% se descuenta de quien vende (`marketplaceFeeMinor`). Pasa a
**cobrarse encima** al comprador en todos los cursos grabados. Los presenciales no cambian.

---

## 6. El simulador de reparto

En la ficha del curso, junto al precio y a los beneficiarios, un panel **"Cómo se reparte"** que se
actualiza mientras se escribe.

**Qué muestra:**
- Tres escenarios lado a lado:
  1. **Venta directa** (vende el dueño, sin descuento).
  2. **Revendido al % sugerido.**
  3. **Socio con el descuento máximo** del que vende.
- Para cada uno, una fila por participante:
  - Paga el alumno.
  - Plataforma (5%).
  - Revendedor, si hay.
  - Cada beneficiario.
  - La comisión estimada de Mercado Pago, restada a quien la absorbe.
  - Lo que le queda neto a cada uno.
- Una barra apilada con la misma información en colores, para ver de un vistazo quién se lleva qué.
- Avisos en vivo:
  - "Los porcentajes suman 95%: faltan 5".
  - "El descuento no puede superar el 30% de SFPR".
  - "Con este precio, al docente le quedan $X después de Mercado Pago".

**De dónde salen los números:** el simulador llama al **mismo motor puro** de la sección 2, en el
navegador. La comisión de Mercado Pago es la única estimación: usa una tasa configurable de la
plataforma (la vigente de acreditación inmediata en Argentina al implementar) y lo dice en
pantalla: "estimado; Mercado Pago la descuenta al acreditar".

**Dónde más aparece:**
- Al **aceptar ser beneficiario**, en modo lectura: "Por cada venta de $100.000 recibís $X".
- Al **pedir una reventa**, con el % que se pide: "Tu parte: $X por venta; podés darles a tus
  socios hasta X% de descuento".

---

## 7. Modelo de datos

Todo nuevo, colgado del curso o del negocio, con borrado en cascada:

| Tabla | Qué guarda |
|---|---|
| `CourseBeneficiary` | Curso, negocio beneficiario (o correo invitado si todavía no tiene negocio), rol (Docente, Productor, Institución, Otro), % en puntos básicos, si absorbe la comisión de MP, estado (Invitado, Aceptado, Rechazado) |
| `CourseResaleAgreement` | Curso, negocio revendedor, % en puntos básicos, descuento para socios en puntos básicos, estado (Pendiente, Activo, Pausado, Rechazado, Terminado), quién y cuándo aprobó |
| `CourseSaleShare` | Por inscripción: cada parte del reparto (negocio, rol, monto en centavos). La comisión de la plataforma, en la inscripción |

Retoques:
- `Course.offeredToResellers` y `Course.suggestedResellerBps`.
- `CourseEnrollment` suma `listPriceArs`, `discountArs`, `resaleAgreementId` (opcional).
  `workspaceId` sigue siendo **quien vende**.
- `CourseAccess` no cambia: el acceso es de la persona, venda quien venda.

Migración aplicada a mano en las 5 bases, ensayada antes en una copia, como la anterior.

---

## 8. Etapas

| # | Qué entrega | Se usa con el split apagado |
|---|---|---|
| 1 | Beneficiarios (invitar, aceptar, %), el motor de reparto, el simulador y el 5% encima | Sí: armar y simular; vender si hay un solo beneficiario |
| 2 | Mercado de cursos y acuerdos de reventa (pedir, aprobar, pausar, descuento para socios) | Sí: acordar y simular |
| 3 | Venta del revendedor en su sitio y su portal, con descuento para socios | Sí, con "Disponible próximamente" |
| 4 | Split de Mercado Pago (apagado), pantalla Cobros, actualización de la decisión del guard | Cobros muestra lo vendido sin split |
| 5 | Invitación a enseñar (Mis cursos, portal, página pública del curso) | Sí |

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| MP no cobra su comisión al dueño de la orden como se espera | Confirmarlo en la homologación (sección 5.2); plan B: estimación en el motor |
| Un beneficiario desconecta su Mercado Pago | Antes de cada venta se verifica el consentimiento ACTIVE; si falta, la venta no se abre y se avisa al dueño |
| Redondeos que no cierran | Todo en centavos; los sobrantes van a quien absorbe MP; test de suma exacta |
| El simulador y el cobro discrepan | Usan el mismo motor puro, con tests |
| Cambiar el 5% a "encima" sorprende a quien ya vende | Hoy no hay ventas de cursos grabados en producción; se avisa en el panel |
| Una institución regala un curso ajeno | "Gratis" sólo para el único beneficiario; el descuento tiene tope en el servidor |

---

## 10. Lo que no se construye

- Precios distintos por revendedor (el precio de lista es uno solo).
- Cupones.
- Liquidaciones manuales o transferencias desde DNX.
- Beneficiarios que sean personas sin negocio en FOTOFFICE.
- Facturación ARCA de cada parte.
- Reventa de cursos presenciales.
