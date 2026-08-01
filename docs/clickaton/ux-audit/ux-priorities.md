# Prioridades UX — Clickatón

**Etapa:** 01 — Clasificación para implementación posterior  
**Fecha:** 2026-08-01  

| Nivel | Definición |
|---|---|
| **P0** | Impide completar una acción o genera confusión crítica en el recorrido principal |
| **P1** | Genera errores operativos o confusión importante |
| **P2** | Dificulta el uso o la comprensión |
| **P3** | Mejora de claridad o terminación |

Referencias cruzadas: `content-audit.md` (C-xx), `mobile-audit.md` (M-xx).

---

## 1. Resumen de conteos

| Prioridad | Contenido | Móvil | Total (aprox.) |
|---|---|---|---|
| P0 | 8 | 5 | 13 |
| P1 | 28 | 12 | 40 |
| P2 | 22 | 11 | 33 |
| P3 | 6 | 6 | 12 |

---

## 2. P0 — Impide o bloquea el recorrido

| ID | Tipo | Problema | Dónde | Impacto | Fix orientativo |
|---|---|---|---|---|---|
| P0-01 | Contenido | Estados de inscripción/pago en inglés/enum crudo | `/mi-cuenta`, detalle inscripción, postpago, resumen | Participante no entiende si está confirmado | Reusar `status-labels.ts` |
| P0-02 | Contenido | Checkout habla de webhook / Brick / Split 1:N | Resumen pago | Miedo a «pago no confirmado» o doble pago | Copy humano |
| P0-03 | Contenido | Consentimiento único opaco (imagen/redes/menores) | Wizard | Riesgo legal + confusión | LEGAL_REVIEW + helper visible |
| P0-04 | Contenido | Resumen muestra `PENDING PAYMENT` | Resumen | No sabe qué hacer | Labels ES + CTA «Pagar» |
| P0-05 | Móvil | Tablas catálogo 720–880px | Entradas / productos / precios | Ops no puede editar kit/talles en phone | Cards mobile |
| P0-06 | Móvil | Tabla kit en detalle inscripción | Admin detalle | No se puede entregar kit en sede con phone | Cards + form stack |
| P0-07 | Móvil | Card Brick overflow | Checkout | Formulario de tarjeta ilegible &lt;375px | Wrapper overflow |
| P0-08 | Contenido | Gate «backend» en mi-cuenta | Detalle inscripción | Parece falla del sistema | Mensaje de espera humano |

---

## 3. P1 — Confusión o error importante

| ID | Tipo | Problema | Dónde | Fix orientativo |
|---|---|---|---|---|
| P1-01 | Contenido | Fulfillment / welcome / consignas / social / envíos en enum | Admin + participante | Mapas ES nuevos |
| P1-02 | Contenido | Botones «Asegurar DRAFT», «Activar», «Asegurar config upload» | Cronograma, finanzas, envíos | Verbos concretos + confirmación |
| P1-03 | Contenido | Jargon Prisma / ClickatonRegistration / DNX Payments en headers | Inscripciones, promociones, dashboard | Copy operativo + técnico colapsado |
| P1-04 | Contenido | OAuth / collector / PKCE / env vars visibles | Finanzas MP | Solo CTA conectar; técnico avanzado; ocultar env |
| P1-05 | Contenido | CTA postpago «CUENTA DNX» | PaymentReturnView | «Creá tu cuenta para ver el QR» |
| P1-06 | Contenido | Legal: EXIF / upload / Welcome Card sin glosa | Bases | LEGAL_REVIEW |
| P1-07 | Contenido | Errores API crudos en upload / MP / escáner | Varios | Mapa de errores humanos |
| P1-08 | Móvil | Filtros densos + cards verbosas | Inscripciones | Acordeón + mobileCard reducido |
| P1-09 | Móvil | Hub edición / detalle con action clusters | Ediciones / inscripción | Stack + «Más» |
| P1-10 | Móvil | Topbar / header densos | Shell | Logout corto; avatar-only |
| P1-11 | Móvil | Wizard resumen ocupa fold | Inscripción | Colapsable / sticky total |
| P1-12 | Móvil | Finanzas overflow IDs | Distribución | Cards |
| P1-13 | Contenido | Identidad / assetId / hash visibles de más | Mi cuenta / admin | Colapsar; assetId = F |
| P1-14 | Contenido | Secciones sin description en AdminPageHeader | Varias admin | 1–2 frases por pantalla |

---

## 4. P2 — Dificulta el uso

| ID | Problema | Fix |
|---|---|---|
| P2-01 | `Continuar` genérico en wizard | Label por paso |
| P2-02 | Badges TEST / Pagar (TEST) en prod potencial | Condicionar a entorno |
| P2-03 | UUID / paymentOrderId en filtros y social | Labels humanos |
| P2-04 | Touch targets &lt;44px (media, cerrar drawer) | min 44×44 |
| P2-05 | CTAs cuenta no full-width | Stack `w-full` |
| P2-06 | Mi inscripción demasiado larga | Secciones colapsables + TOC |
| P2-07 | `whitespace-nowrap` en Button | Wrap en admin |
| P2-08 | Diagnóstico / flags EN | Españolizar labels |
| P2-09 | Empty states con nombres de modelo | Copy humano |
| P2-10 | Tabla marketing `JoinLevels` min-width | Scroll hint o cards |

---

## 5. P3 — Claridad / polish

| ID | Problema | Fix |
|---|---|---|
| P3-01 | «Scanner» → «Escanear credencial» | Rename |
| P3-02 | Documentar patrón mobileCard | Docs + lint opcional |
| P3-03 | Agrupar KPIs admisión | Core vs extra |
| P3-04 | Tipografía display en 320 | Ajuste scale |
| P3-05 | scroll-mt headings sticky | Offset |
| P3-06 | Glosario dashboard FotoRank/DNX | Frase educativa breve |

---

## 6. Pantallas con mayor confusión (ranking)

1. **Checkout / resumen / postpago** — enums + jargon de pagos + Brick.  
2. **Mi cuenta / inscripción participante** — estados crudos + densidad + legal implícito.  
3. **Admin finanzas + cuentas MP** — OAuth/collector/ACTIVE/DRAFT.  
4. **Admin inscripciones (listado + detalle)** — filtros técnicos + fulfillment + IDs.  
5. **Cronograma / consignas / envíos / admisión** — enums + botones ambiguos.  
6. **Catálogo / precios en mobile** — tablas anchas.  
7. **Hub de edición** — demasiadas acciones sin jerarquía mobile.

---

## 7. Orden recomendado de implementación (próximas etapas)

### Fase A — Copy compartido (alto impacto, bajo riesgo)

1. Extender y **reutilizar** mapas de estados en público + admin faltante.  
2. Reescribir banners de checkout / postpago / mi-cuenta (sin tocar lógica de pago).  
3. Españolizar botones admin ambiguos + descriptions de `AdminPageHeader`.  
4. Colapsar «Información técnica» (IDs, Prisma, OAuth detail, env).

### Fase B — Mobile ops (sin cambiar flujos)

5. Cards para tablas `min-w-*` (catálogo, precios, kit).  
6. Filtros colapsables + `mobileCard` reducido en inscripciones.  
7. Contenedor Brick + CTAs full-width cuenta/pago/acreditación.  
8. Headers / action clusters → stack + overflow.

### Fase C — Claridad operativa avanzada

9. Capas UX en finanzas/integraciones (simple vs técnico).  
10. Empty states, flash messages, errores humanos unificados.  
11. Loading / sin permiso / error admin (presentación).  

### Fase D — Legal (paralela, no bloqueante de A–B)

12. Pack LEGAL_REVIEW: checkbox funnel, bases, privacidad, imagen, reembolsos.  
    **No publicar rewrites legales sin aprobación humana.**

---

## 8. Riesgos técnicos antes de implementar

| Riesgo | Mitigación |
|---|---|
| Cambiar labels y romper tests que assertan strings EN | Actualizar selfchecks / snapshots de copy |
| Mapas de status incompletos → fallback a enum | Exhaustive maps + fallback «Estado desconocido» |
| Tocar checkout copy cerca de lógica MP | Solo strings UI; no actions/webhooks |
| LEGAL_REVIEW mezclado con polish | Branch/docs separados; no editar cláusulas en PR de UI |
| Cards mobile pierden datos ops | Desktop tabla intacta; mobile resume + detalle |
| Brick SDK no responsive | Solo wrapper; no fork del SDK |
| Ocultar IDs que ops usa en soporte | Sección «Información técnica» colapsable, no borrado |

---

## 9. Confirmación de alcance Etapa 01

- No se modificaron modelos Prisma, APIs, permisos, rutas ni lógica de pagos.  
- No se hizo commit, push ni deploy.  
- Esta clasificación alimenta Etapa 02 (implementación de copy/responsive).
