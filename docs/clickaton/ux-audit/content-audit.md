# Auditoría de contenidos — Clickatón

**Etapa:** 01 — Solo auditoría (sin cambios de lógica)  
**Fecha:** 2026-08-01  
**Categorías:** A comprensible · B mal explicada · C admin avanzado · D técnica secundaria · E no mostrar · F riesgo seguridad/privacidad  
**LEGAL_REVIEW:** textos de consentimiento, bases, privacidad, pagos, reembolsos, imagen, redes — identificar, no reescribir como definitivos.

---

## 1. Resumen cuantitativo

| Métrica | Cantidad (aprox.) |
|---|---|
| Pantallas auditadas | 66 |
| Hallazgos de copy documentados | 72 |
| Textos / anglicismos visibles | 38 |
| Conceptos técnicos visibles (enums, IDs, jargon) | 54 |
| Secciones sin explicación / description | 18+ |
| Ítems marcados LEGAL_REVIEW | 12 |
| Categoría E (no mostrar nunca, público) | 16 |
| Categoría F (riesgo) | 6 |

---

## 2. Mapas de estados existentes

### Ya traducidos (admin)

`lib/admin-registration/ui/status-labels.ts`

| Dominio | Ejemplos ES |
|---|---|
| Inscripción | Borrador, Pago pendiente, Confirmada, Lista de espera… |
| Pago | Cobro pendiente, Procesando cobro, Cobro aprobado… |
| Hold | Reserva activa, Consumida, Expirada, Liberada |

`EDITION_STATUS_LABELS` — Borrador, Inscripción abierta, etc.  
`salesStatusLabel` — Inactiva, En venta, etc.

### Sin mapa ES (se muestran crudos)

Fulfillment (`PENDING` / `READY` / `DELIVERED` / `CANCELLED`), welcome card (`GENERATED` / `FAILED` / `PENDING`), consignas (`LOCKED` / `RELEASED` / `CLOSED`), social publish, OAuth connection, envíos de foto, identidad check-in.

**Problema crítico:** los mapas admin **no se usan** en `/mi-cuenta` ni en pantallas de postpago.

---

## 3. Hallazgos — Participante / público

| ID | Ruta | Rol | Componente | Texto actual | Problema | Grav. | Cat. | Propuesta | Acción | Desktop | Smartphone |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-01 | `/mi-cuenta` | Participante | `mi-cuenta/page.tsx` | Badge `{reg.status}` (`CONFIRMED`) | Enum crudo | P0 | E | Usar `registrationStatusLabel` → «Confirmada» | Traducir | Badge ES | Badge ES + helper |
| C-02 | `/mi-cuenta` | Participante | idem | `Pago: {paymentStatus}` | Enum crudo | P0 | E | «Pago: Cobro aprobado» | Traducir | Texto ES | Texto ES corto |
| C-03 | `/mi-cuenta` | Participante | idem | `Soporte TEST:…` | Inglés / staging | P2 | B | «Soporte: usá el formulario de contacto. No compartas tu QR.» | Reescribir (ocultar TEST en prod) | Nota secundaria | Nota bajo CTA |
| C-04 | `/mi-cuenta/inscripciones/[id]` | Participante | page | `Estado: {status}` / `Pago: {paymentStatus}` | Enums | P0 | E | Labels ES + descripción corta | Traducir + helper | Badges + texto | Badges + 1 línea |
| C-05 | idem | Participante | page | «confirmada por el **backend**» | Jargon | P1 | B | «Todavía no está confirmada. Si ya pagaste, esperá unos minutos o contactanos.» | Reescribir | Párrafo | Destacado |
| C-06 | idem | Participante | page | `Foto: {profilePhotoStatus}` | Enum | P1 | D | «Foto de perfil: lista / pendiente / error» | Traducir | Secundario | Colapsar |
| C-07 | idem | Participante | page | `Imagen OK · Social OK` | Consent técnico | P1 | B | LEGAL_REVIEW — «Autorizaste uso de imagen / publicación social» | Clarificar | Labels | Labels |
| C-08 | idem | Participante | page | `Identidad: {identityStatus}` + source | Técnico | P2 | D | «Identidad verificada en acreditación» o mover a avanzado | Ocultar / técnico | Colapsable | Oculto |
| C-09 | idem | Participante | consignas | `{p.status}` LOCKED/RELEASED | Enum | P1 | B | «Bloqueada / Disponible / Cerrada» + qué hacer | Traducir | Badge | Badge + CTA |
| C-10 | idem | Participante | `WelcomeCardShareCard` | `GENERATED` / `FAILED` | Enum | P1 | B | «Lista para compartir» / «No pudimos generar la placa» | Traducir | Estado claro | Full-width CTA |
| C-11 | idem | Participante | `PromptPhotoUpload` | `Estado envío: {status}` + error API | Técnico | P1 | E | Labels ES; errores humanos | Mapear | Feedback | Feedback |
| C-12 | Postpago | Público | `PaymentReturnView` | `status ?? "CONFIRMED"` | Enum | P0 | E | «Inscripción confirmada» | Traducir | Hero status | Hero status |
| C-13 | Postpago | Público | idem | Credential `ACTIVE` | Enum | P1 | E | «Credencial activa» | Traducir | Badge | Badge |
| C-14 | Postpago | Público | idem | `CREAR / ACTIVAR MI CUENTA DNX` | Mayúsculas + marca interna | P1 | B | «Creá tu cuenta para ver el QR» | Reescribir | CTA primario | Full-width |
| C-15 | Resumen | Público | resumen page | `PENDING PAYMENT` | Enum | P0 | E | «Pago pendiente» + «Tenés tiempo hasta…» | Traducir | Estado | Sticky CTA pago |
| C-16 | Resumen | Público | idem | `registrationId` truncado | ID técnico | P2 | D | Solo código visible; ID en «Info técnica» admin | Ocultar público | — | — |
| C-17 | Checkout | Público | `CheckoutPayButton` | «webhook/reconciliación» | Técnico | P0 | E | «El pago se confirma en unos segundos. Si ya pagaste, no vuelvas a pagar.» | Reescribir | Banner | Banner |
| C-18 | Checkout | Público | idem | `Pagar (TEST)` | Staging EN | P2 | B | «Pagar (entorno de prueba)» o ocultar en prod | Condicional | — | — |
| C-19 | Checkout | Público | idem | «vía DNX Payments» / «Proveedor… DNX Payments» | Interno | P1 | D | «Pago seguro con Mercado Pago» | Reescribir / ocultar | — | — |
| C-20 | Checkout | Público | `CardPaymentBrickCheckout` | «Card Payment Brick + Orders Split 1:N… webhook» | Técnico | P0 | E | «Pagá con tarjeta. La inscripción se confirma al acreditarse el cobro.» | Reescribir | — | Scroll controlado |
| C-21 | Wizard | Público | `PublicRegistrationWizard` | Botón `Continuar` | Ambiguo | P2 | B | «Continuar a datos personales» / «Ir al pago» según paso | Contextualizar | — | Full-width |
| C-22 | Wizard | Público | idem | Un checkbox bases → setea image/social | Consent agrupado | P0 | F | LEGAL_REVIEW — ampliar copy o separar consentimientos sensibles | Marcar revisión legal | Helper bajo checkbox | Helper visible |
| C-23 | Home | Público | `UpcomingEventsSection` | `Inscripción abierta (TEST)` | EN | P2 | B | Quitar TEST en prod; «Inscripción abierta» | Condicional | Badge | Badge |
| C-24 | Legal | Público | `terminos/page` | `PUBLISHED` + version ID | Técnico | P2 | D | Ocultar PUBLISHED; versión en pie pequeño | Mover | Pie | Pie |
| C-25 | Legal | Público | `legal-funnel.ts` | «upload», EXIF, Welcome Card | Anglicismos | P1 | B | LEGAL_REVIEW — glosar «carga», «metadatos de captura», «placa de bienvenida» | Marcar legal | — | — |
| C-26 | Legal | Público | idem | Cancelaciones no reembolsables | Legal pagos | — | A | LEGAL_REVIEW — no reescribir aquí | Separar pack legal | — | — |
| C-27 | Legal | Público | idem | Licencia promocional / imagen / menores | Legal | — | F | LEGAL_REVIEW | Separar pack legal | — | — |
| C-28 | Postpago | Público | `ResendConfirmationButton` | `REENVIAR EMAIL` | EN parcial | P2 | B | «Reenviar email de confirmación» | Reescribir | — | Full-width |

---

## 4. Hallazgos — Admin operaciones

| ID | Ruta | Rol | Componente | Texto actual | Problema | Grav. | Cat. | Propuesta | Acción | Desktop | Smartphone |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-30 | `/admin/inscripciones` | Admin | page | Description con `ClickatonRegistration`, Prisma, Order | Jargon backend | P1 | D | «Gestión de inscripciones y cobros. El pago se confirma desde Mercado Pago.» | Reescribir; detalle Prisma en «Técnico» | Description corta | Description corta |
| C-31 | idem | Admin | card | «No existe `/admin/ordenes`…» | Interno | P2 | D | Mover a colapsable técnico | Colapsar | Colapsable | Oculto |
| C-32 | idem | Admin | filtros | `Con paymentOrderId` | Campo interno | P2 | D | «Con cobro vinculado» / «Sin cobro vinculado» | Traducir | Filtro | Acordeón filtros |
| C-33 | idem | Admin | filtros | Fulfillment `PENDING`… | Enums | P1 | B | «Pendiente / Listo / Entregado / Cancelado» | Mapear | — | — |
| C-34 | Detalle inscripción | Admin | page | Welcome status/codes + `profilePhotoAssetId` | IDs | P1 | D/F | Labels ES; assetId solo avanzado | Ocultar ID | Colapsable | Oculto |
| C-35 | Detalle | Admin | kit | `fulfillmentStatus ?? "PENDING"` | Enum | P1 | B | Labels ES | Mapear | Tabla | Cards |
| C-36 | Detalle | Admin | holds | `productVariantId ×n` | ID | P2 | D | Nombre de producto + talle | Humanizar | — | — |
| C-37 | Detalle | Admin | reconcile | status + findings crudos | Técnico | P2 | C | Sección «Reconciliación» avanzada | Colapsar | Avanzado | Oculto |
| C-38 | Detalle | Admin | copy | «hasta implementar webhook Resend» | Roadmap técnico | P2 | E | Quitar o «Aviso de email en revisión» | Ocultar | — | — |
| C-39 | Detalle | Admin | sección | «Comercial (soft refs DNX Payments)» | Jargon | P1 | D | «Referencias de cobro» | Reescribir | — | — |
| C-40 | Cronograma | Admin | header | `Timezone` · `ACTIVE` · `DRAFT` | EN/enums | P1 | B | «Zona horaria… Versión publicada inmutable; cambios = nuevo borrador.» | Reescribir | — | — |
| C-41 | Cronograma | Admin | botones | `Asegurar DRAFT` | Ambiguo + EN | P1 | B | «Crear borrador de cronograma» | Reescribir | — | Full-width |
| C-42 | Cronograma | Admin | botones | `Desplazar futuros → nueva DRAFT` | Técnico | P1 | B | «Pasar hitos futuros a un nuevo borrador» + confirmación | Reescribir + warn | Confirm | Confirm |
| C-43 | Finanzas | Admin | page | `ACTIVE`, `Fee policy`, `Webhook`, `OAuth`, `collector` | Técnico | P1 | C/D | ES operativo + bloque «Información técnica» | Separar capas | 2 niveles | Solo capa 1 |
| C-44 | Finanzas | Admin | botón | `Activar` | Ambiguo | P1 | B | «Publicar distribución» + advertencia irreversible | Clarificar | Confirm | Confirm |
| C-45 | Distribución | Admin | editor | `Recipient`, `Guardar DRAFT` | EN | P1 | B | «Beneficiario», «Guardar borrador» | Traducir | — | Stack |
| C-46 | Cuenta owner | Admin | page | collector, partner, OAuth, PKCE, env vars | Técnico / riesgo | P1 | D/F | UI: «Conectar cuenta Mercado Pago»; técnico colapsado; **no mostrar nombres de env en UI** | Separar | Avanzado | Solo CTA |
| C-47 | Diagnóstico | Admin | page | OAuth, Vault, flags EN | Técnico | P2 | C | Mantener como herramienta avanzada; españolizar labels | ES + disclaimer | OK | Stack |
| C-48 | Social | Admin | page | Estados crudos + UUID + env flag | Técnico | P1 | D | Labels ES; UUID en detalle; quitar env del header | Traducir | — | Cards |
| C-49 | Envíos | Admin | page | Estados crudos, hash, GPS OPTIONAL | Técnico | P1 | B/D | Labels ES; hash/técnico colapsado | Traducir | — | Cards |
| C-50 | Envíos | Admin | botón | `Asegurar config upload` | Ambiguo | P1 | B | «Crear configuración de carga de fotos» | Reescribir | — | Full-width |
| C-51 | Consignas | Admin | selects | DRAFT/READY/LOCKED + JSON dump | Técnico | P1 | C/E | Labels ES; JSON solo avanzado | Separar | — | — |
| C-52 | Admisión | Admin | botones | `Crear / obtener lote DRAFT`, `Reabrir (no frozen)` | EN/ambiguo | P1 | B | «Crear borrador de admisión» / «Reabrir lote (aún editable)» | Reescribir | — | — |
| C-53 | Escáner | Admin | header | «Scanner de acreditación» | EN | P3 | B | «Escanear credencial» | Reescribir | — | — |
| C-54 | Escáner | Admin | UI | error API + fulfillment crudo | Técnico | P1 | D | Errores humanos + labels | Mapear | — | Full-width |
| C-55 | Edición hub | Admin | FR sync | `Fallidos/retry`, keys PENDING | EN/enum | P2 | C | «Pendientes / Con error (reintento)» | Traducir | — | — |
| C-56 | Promociones | Admin | header | `DNX (@repo/promotions)` | Interno | P2 | D | «Códigos de descuento de la edición» | Reescribir | — | — |
| C-57 | Mensajes | Admin | empty | `ClickatonContactMessage` | Modelo | P2 | D | «Todavía no hay mensajes de contacto.» | Reescribir | — | — |
| C-58 | Varios | Admin | `AdminPageHeader` | Sin `description` | Sin explicación | P2 | B | Añadir 1–2 frases: qué es / qué hacer | Completar | — | — |
| C-59 | Dashboard | Admin | description | «competencia… FotoRank; cobros… DNX Payments» | Interno OK admin | P3 | C | Mantener pero glosar: «La competencia se gestiona en FotoRank» | Suave | — | — |

---

## 5. Secciones que necesitan explicación (checklist)

Para cada apartado, la UX debería responder: ¿qué es? ¿para qué? ¿qué hago? ¿qué pasa después? ¿riesgo? ¿puedo cambiarlo?

| Apartado | Falta | Tipo de ayuda recomendada |
|---|---|---|
| Wizard — checkbox legal | Qué autoriza (imagen, placa, redes, menores) | Descripción previa + helper — **LEGAL_REVIEW** |
| Resumen / checkout | Qué ocurre tras pagar | Texto «siguiente paso» |
| Mi cuenta — estados | Significado de cada estado | Descripción bajo badge |
| Consignas participante | Por qué LOCKED y cuándo se abre | Empty/locked state con horario |
| Placa bienvenida | Para qué sirve compartir | Intro + confirmación |
| Cronograma admin | ACTIVE vs DRAFT | Description + tooltip |
| Finanzas distribución | Activar = publicar | Advertencia irreversible |
| Conectar MP | Qué cuenta se conecta | Intro + checklist |
| Admisión técnica | Qué es un lote | Description |
| Escáner | Resultado esperado al escanear | Instrucción + empty |
| Filtros inscripciones | Para qué cada filtro | Labels humanos + acordeón |
| Social publish | Qué implica aprobar | Confirmación |
| Upload foto | Requisitos EXIF/GPS | Checklist ES (ya parcial) |
| Sponsors | Vacío sin roadmap UX | Empty con «próximamente» claro |
| Integraciones diagnóstico | Solo ops avanzados | Disclaimer «herramienta técnica» |

---

## 6. Textos legales — separación (LEGAL_REVIEW)

No reescribir como definitivos. Marcar para revisión legal posterior.

| Tema | Ubicación | Nota |
|---|---|---|
| Consentimiento único del funnel | `PublicRegistrationWizard` + `legal-funnel.ts` | Un checkbox implica imagen, placa, redes, licencia |
| Bases y condiciones | `/legal/terminos` | Versión ID visible; anglicismos técnicos |
| Privacidad | `/legal/privacidad` | Datos personales, Cuenta DNX |
| Pagos / Mercado Pago | Funnel + checkout copy | Proveedor y no-reembolso |
| Reembolsos / cancelaciones | `legal-funnel` § Cancelaciones | Texto sensible |
| Uso de imagen / Welcome Card | Funnel § Foto de perfil | Autorización social |
| Derechos de autor / licencia promocional | Funnel § Fotografías | Menores identificables |
| Publicación en redes | Funnel + `/admin/social` | Consent vs operación |
| Información personal | Mi cuenta / admin detalle | Documentos, asset IDs |

Flag interno: `legalV2HumanConfirmationPendingBeforeSales: true` en `legal-funnel.ts`.

---

## 7. Inconsistencias de terminología (misma acción, distintos textos)

| Concepto | Variantes actuales | Término unificado propuesto |
|---|---|---|
| Inscripción confirmada | CONFIRMED / Confirmada / «confirmada por backend» | Confirmada |
| Pago | PENDING / Cobro pendiente / Pagar (TEST) | Pago pendiente / Pagar |
| Cuenta | Cuenta DNX / Activar cuenta / Crear cuenta | Cuenta Clickatón (o «tu cuenta») — ver glosario |
| Placa | Welcome Card / placa de bienvenida | Placa de bienvenida |
| Cobro MP | collector / OAuth / Mi cuenta de cobro | Cuenta de Mercado Pago |
| Borrador | DRAFT / Borrador / Asegurar DRAFT | Borrador |
| Entrega kit | fulfillment / Entregar / READY | Entrega del kit |
| Carga de fotos | upload / envío / submission | Envío de fotografía |

Ver `content-glossary.md`.

---

## 8. Quick wins de copy (sin tocar lógica)

1. Reutilizar `registrationStatusLabel` / `paymentStatusLabel` en mi-cuenta y postpago.
2. Crear mapas ES: fulfillment, welcome, prompt, social, OAuth, photo submission.
3. Reemplazar banners de checkout (webhook / Brick / Split / DNX Payments).
4. Españolizar botones admin «Asegurar DRAFT», «Activar», «Asegurar config upload».
5. Colapsar IDs, env vars y Prisma jargon en «Información técnica».
6. Marcar pack legal para revisión (no editar cláusulas en Etapa 02 sin legal).
