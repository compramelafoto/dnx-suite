# Clickatón 2ª edición — inscripciones y cupones con condiciones

- **Fecha:** 2026-09-20
- **Estado:** diseño aprobado, pendiente de plan de implementación
- **Alcance:** Clickatón (`apps/clickaton`) y el paquete compartido `@repo/promotions`

---

## 1. Contexto

La 1ª edición se corrió el 19/09/2026 en Rosario, sede única. Números verificados en
producción (proyecto Neon `bitter-math-56019731`):

| Métrica | Valor |
|---|---|
| Inscripciones confirmadas | 31 (25 pagas, 6 gratuitas) |
| Acreditadas el día del evento | 29 |
| Subieron al menos una foto | 27 |
| Fotos entregadas | 275 |
| Inscripciones con cupón | 10 |
| Fases de precio | $25.000 → $30.000 → $35.000 |
| Sedes | 1 (Rosario) |

Las 31 inscripciones confirmadas tienen cuenta DNX asociada y 31 emails distintos.
No hay duplicados ni inscripciones sin identidad: **el universo de "participantes de
la edición anterior" es inequívoco**.

La 2ª edición es el **sábado 19/12/2026**, temática Navidad, misma jornada y horario,
con sede central confirmada en Rosario y vocación federal (varias sedes en el país).

El objetivo comercial inmediato es abrir una **venta anticipada dirigida a los
participantes de la 1ª edición**, con 50% de descuento, para arrancar la edición con
un piso de inscriptos.

## 2. Problema

El motor de cupones actual (`packages/promotions`) valida seis cosas: que el cupón esté
activo, que esté dentro de su ventana de fechas, que corresponda a la plataforma, que
corresponda a la edición, que se alcance un monto mínimo y que no se hayan agotado los
usos (totales o por persona).

**No sabe expresar "sólo para quien participó en la edición anterior".** Un cupón de
50% hoy es un código que funciona para cualquiera que lo tenga; si circula por WhatsApp,
lo usa cualquiera.

## 3. Decisión de diseño

Se agrega al motor un concepto nuevo y opcional: **condiciones de elegibilidad**.

El motor sigue siendo una función pura — no consulta la base de datos. Recibe la
elegibilidad **ya resuelta**, igual que hoy recibe los contadores de uso. Quien la
resuelve es el adaptador de cada plataforma.

### 3.1. Dónde se guarda la condición

En el campo `metadata` del modelo `DnxPromotion`, que ya existe y es `Json`:

```json
{
  "eligibility": {
    "kind": "PARTICIPATED_IN_EDITION",
    "editionIds": ["cms78cthj0000xpc4841bihf4"],
    "requireCheckIn": true
  }
}
```

**Consecuencia clave: no hace falta ninguna migración de base de datos.** El campo ya
está. Esto evita tener que aplicar SQL a mano en las 5 bases Neon que comparten
`schema.prisma`, que es donde históricamente se rompen las escrituras de las otras
aplicaciones.

### 3.2. Reparto de responsabilidades

| Capa | Responsabilidad | Archivo |
|---|---|---|
| `@repo/promotions` (puro) | Lee `metadata.eligibility`. Si existe y la elegibilidad resuelta es falsa, rechaza con `NOT_ELIGIBLE`. Si no existe, se comporta exactamente como hoy. | `packages/promotions/src/engine.ts`, `types.ts` |
| Adaptador Clickatón | Consulta si el email o la cuenta figura entre los participantes de las ediciones indicadas. | `apps/clickaton/lib/promotions/prisma-promotions-adapter.ts` |
| Panel de administración | Formulario para definir la condición al crear o editar un cupón. | `apps/clickaton/app/admin/(panel)/promociones/page.tsx`, `lib/admin/promotions/mutations.ts` |
| Asistente público | Mensaje de rechazo específico y verificación previa honesta. | `apps/clickaton/lib/public-registration/actions/preview-promotion.ts`, `components/public-registration/RegistrationPromoCodeField.tsx` |

**Compatibilidad:** el cambio es aditivo. Un cupón sin `metadata.eligibility` sigue
funcionando igual, y las otras cuatro plataformas que usan `@repo/promotions`
(CompraMeLaFoto, FotoRank, FOTOFFICE, InfoSpot) no se ven afectadas. No se agregan
dependencias nuevas al monorepo.

### 3.3. Cómo se resuelve la elegibilidad

La inscripción pública **no exige iniciar sesión**: la identidad se resuelve por email
(`resolveIdentityCandidate`). La verificación de elegibilidad sigue el mismo criterio,
con dos caminos que se evalúan en OR:

1. **Por email de inscripción** — el email normalizado coincide con el de una
   inscripción `CONFIRMED` y no `isOpsTest` en alguna de las ediciones indicadas.
2. **Por cuenta** — el `userId` resuelto desde el email coincide con el `userId` de una
   de esas inscripciones.

El email de la inscripción es una foto fija tomada al inscribirse, así que no se pierde
si la persona después cambia el email de su cuenta. El segundo camino cubre a quien se
inscribe con un email distinto pero desde la misma cuenta.

Con `requireCheckIn: true`, además se exige que exista un `ClickatonCheckIn` asociado a
esa inscripción.

**Decisión tomada:** califican los **29 acreditados**, no los 31 inscriptos. Los 6 que
entraron con cupón gratuito sí califican: son aliados que se quiere que vuelvan y traigan
gente.

### 3.4. Qué ve quien se inscribe

El mensaje de rechazo tiene que apuntar al error más probable, que no es el colado sino
el participante real escribiendo otro email:

> Este código es exclusivo para quienes participaron de la 1ª edición. Probá con el mismo
> email con el que te inscribiste en septiembre.

Además se corrige un defecto existente: `previewPublicPromotionAction` no pasa el
`userId` al motor, así que la verificación previa no controla el límite por persona. Hoy
la pantalla dice "código aplicado" y recién al confirmar la inscripción lo rechaza. La
verificación previa pasará a recibir el email, de modo que informe lo mismo que decidirá
el backend al confirmar.

**El email está disponible en ese momento.** El campo de cupón vive en el paso
`participant` (y se repite en `review`), después del campo de email dentro del mismo
formulario. Si la persona intenta aplicar un cupón con el email todavía vacío, la
verificación previa no consulta al servidor: pide completar el email primero
("Completá tu email para validar este código"). El campo de cupón del paso `review` no
tiene este problema, porque ahí el email ya es obligatorio.

## 4. Estructura comercial de la 2ª edición

Fechas y precios propuestos (los importes son decisión comercial y se cargan desde el
panel, no quedan en código):

| Etapa | Fechas | Precio | Con 50% |
|---|---|---|---|
| Preventa exclusiva | 22/09 – 05/10 | $30.000 | $15.000 |
| Etapa 1 | 06/10 – 15/11 | $35.000 | — |
| Etapa 2 | 16/11 – 10/12 | $40.000 | — |
| Etapa 3 | 11/12 – 19/12 | $45.000 | — |

Cupones de la venta anticipada:

| Código | Descuento | Vigencia | Condición | Límite |
|---|---|---|---|---|
| `VOLVI50` | 50% | 22/09 – 28/09 | Acreditado en la 1ª edición | 1 uso por persona |
| `VOLVI35` | 35% | 29/09 – 05/10 | Acreditado en la 1ª edición | 1 uso por persona |

El escalón entre las dos semanas crea urgencia sin dejar afuera a los indecisos. Ambos
cupones se atan explícitamente a la edición nueva (`editionId`).

## 5. Riesgos a resolver antes de abrir la venta

### 5.1. Cupones sueltos que contaminan la edición nueva

Un cupón con `editionId = null` vale para **todas** las ediciones de la plataforma. Hay
cinco activos en producción con esa configuración, y varios siguen vigentes después del
19/09:

| Código | Descuento | Vence | Riesgo |
|---|---|---|---|
| `CLICFREE` | **100%** | 02/10 | **Crítico** — sin límite total de usos |
| `MUCHA` | 10% | 11/10 | Alto |
| `ESTUDIANTES2026` | 20% | 19/09 | Medio |
| `ELBAUL` | 10% | 19/09 | Medio |
| `ESTUDIOFOTO` | 10% | 19/09 | Medio |

Apenas se cree la 2ª edición, esos cupones se aplican solos. **Antes de publicar la
edición nueva hay que desactivarlos o atarlos a la 1ª edición**, empezando por
`CLICFREE`. Se hace desde el panel, sin desplegar.

### 5.2. El aviso de pago de Mercado Pago sigue roto

Falta la variable `MERCADOPAGO_WEBHOOK_SECRET` y el cron de reconciliación no consulta
al proveedor. En la 1ª edición esto canceló sola una inscripción que estaba paga. Vender
con esto sin arreglar repite el problema, ahora con más volumen.

### 5.3. Abrir la inscripción son dos fechas, no una

La ventana de la edición (`registrationOpenAt` / `registrationCloseAt`) **y** la fase de
precio vigente. Con una sola configurada, la inscripción se rompe sola.

### 5.4. Multi-sede está construido pero nunca se ejecutó

El asistente público ya tiene un paso "elegí tu sede" que aparece sólo cuando hay más de
una (`PublicRegistrationWizard.tsx`, `Step = "venue"`), y existen cupo, acreditación y
entrega de kit por sede. **Nunca corrió en producción con más de una sede.** Se trata
como código nuevo: requiere prueba de punta a punta antes de abrir la venta con sedes
adicionales.

## 6. Fuera de alcance de esta etapa

- Cupo de cupón por sede (por ejemplo: "20 usos, sólo Córdoba").
- Descuento automático sin código.
- Códigos personales de un solo uso.
- El tipo de beneficio `RETURNING_PARTICIPANT_EARLY_PRICE`, que existe en el esquema con
  cero registros y sin código que lo use. No se implementa ni se borra en esta etapa.
- Envío del kit a domicilio (ver sección 7).

## 7. Etapa futura — envío del kit a domicilio

Pedido explícito: que quien no tenga una sede cerca pueda cargar su domicilio y recibir
el kit en su casa, con integración a una empresa de transporte.

Queda **fuera de esta etapa**, pero se documenta el análisis porque condiciona decisiones
comerciales que hay que tomar temprano.

### 7.1. Qué hay hoy

`ClickatonKitDelivery` modela una **entrega presencial**: exige un `operatorUserId` que
marca la entrega en mano, opcionalmente asociada a una sede. No tiene domicilio, ni
número de seguimiento, ni costo de envío, ni estados de tránsito.

`ClickatonRegistration` guarda `city`, `province` y `country`, pero **no** calle, número,
piso, código postal ni referencias. Un envío necesita todo eso, más el documento del
destinatario, que los correos argentinos suelen pedir.

### 7.2. Qué habría que construir

1. **Modalidad de entrega en el asistente**: elegir entre retirar en una sede o recibir
   en el domicilio. Hoy el paso de sede es obligatorio cuando hay más de una.
2. **Domicilio de envío**: modelo nuevo con calle, número, piso/departamento, localidad,
   provincia, código postal, referencias y documento. Con validación de código postal.
3. **Costo del envío**: si lo paga el participante, hay que cotizar contra el
   transportista **antes** de generar el pago y sumarlo al total. Esto toca el cálculo de
   precio, que hoy es únicamente fase + cupón. Si va incluido, no toca el precio pero sí
   el margen, y conviene decidirlo antes de fijar los precios de la tabla de la sección 4.
4. **Estados de envío y seguimiento**: preparado → despachado → en tránsito → entregado,
   más devuelto. Con número de seguimiento visible para el participante y un aviso por
   correo cuando se despacha.
5. **La integración propiamente dicha**: generar la etiqueta, obtener el seguimiento y
   recibir las actualizaciones de estado.

### 7.3. Decisión técnica principal: transportista único o agregador

Hay dos caminos y conviene elegirlo antes de escribir código:

- **Un transportista directo** (Correo Argentino, Andreani, OCA). Menos intermediarios y
  mejor precio por unidad, pero la integración queda atada a esa empresa: si no llega a
  una localidad, no hay alternativa sin escribir una integración nueva.
- **Un agregador** (por ejemplo Envíopack o Zippin). Una sola integración da acceso a
  varios correos, y se puede cambiar de transportista o elegir el más barato por destino
  sin tocar código. Cuesta una comisión por encima de la tarifa.

**Recomendación preliminar: agregador**, porque una edición federal implica destinos
dispersos donde la cobertura de un solo correo es justamente el punto débil. Esto **debe
verificarse** con cotizaciones y condiciones reales de cada proveedor antes de
comprometerlo — las condiciones comerciales, los requisitos de cuenta y la disponibilidad
de API no están confirmados en este documento.

### 7.4. Dos consecuencias que no son técnicas

1. **El envío obliga a cerrar esa modalidad mucho antes que la inscripción.** Para que un
   kit llegue antes del 19/12 al interior del país, con la carga de diciembre, la venta
   con envío a domicilio debería cerrarse alrededor del **5/12**. Son dos fechas de cierre
   distintas conviviendo en la misma edición.
2. **Un participante sin sede cambia el modelo del evento.** La acreditación actual es
   presencial: alguien escanea un QR en una sede. Un participante remoto necesita otra
   forma de acreditarse, y hay que decidir si compite en la misma categoría que quienes
   participan en una sede. Esta es una definición de las bases del concurso, no de
   software, y conviene resolverla antes de construir.

## 8. Pruebas

- **Motor (`@repo/promotions`)**: pruebas unitarias del rechazo `NOT_ELIGIBLE`; cupón sin
  condición se comporta igual que antes; condición presente con elegibilidad verdadera y
  falsa; `metadata` malformado no rompe el cálculo.
- **Adaptador Clickatón**: elegible por email de inscripción; elegible por cuenta; no
  elegible; `requireCheckIn` con y sin acreditación; inscripciones `isOpsTest` excluidas.
- **Verificación previa**: coincide con la decisión del backend al confirmar.
- **Panel**: crear y editar un cupón con condición; la lista muestra la restricción.
- **Multi-sede**: recorrido completo del asistente con dos sedes.

## 9. Criterios de aceptación

1. Un cupón con condición sólo funciona para participantes de la edición indicada; para
   cualquier otra persona falla con un mensaje que explica por qué.
2. Los cupones existentes sin condición siguen funcionando igual.
3. La verificación previa no dice "aplicado" sobre un código que el backend va a rechazar.
4. La condición se configura desde el panel, sin tocar código ni base de datos.
5. No hay migración de base de datos.
6. Las otras cuatro plataformas que usan `@repo/promotions` no cambian de comportamiento.
