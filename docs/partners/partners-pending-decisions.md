# DNX Partners — Decisiones humanas pendientes

**Fecha:** 2026-08-01  
**Etapa:** 00 / Implementación 01  
**Estado:** parcialmente resuelto en Etapa 01 (ver `PARTNERS_STAGE_01_IMPLEMENTATION_01_RESULT.md`). Restan D-01, D-04, L-*, portal y bridges.

---

## 1. Producto y naming

| ID | Decisión | Opciones | Impacto |
|----|----------|----------|---------|
| P-01 | ¿UI definitiva “Sponsors y beneficios” o “Partners DNX”? | Mantener Sponsors / renombrar más adelante | Copy, nav, docs |
| P-02 | ¿Quién es owner operativo del CRM global? | Ops Clickatón / equipo DNX central / ambos | Permisos admin |
| P-03 | ¿Los organizadores FotoRank/CLF pueden crear Partners globales o solo vincular existentes? | Solo staff DNX / org puede proponer / org puede crear | Duplicados vs autonomía |

---

## 2. Identidad y datos

| ID | Decisión | Opciones | Impacto |
|----|----------|----------|---------|
| D-01 | ¿Unificar DB Clickatón con suite antes del módulo? | Unificar primero / dual-write / módulo solo suite | Elegibilidad cruzada real |
| D-02 | ¿`DnxPartner` puede existir sin `User` dueño? | Sí (ficha institucional) / requiere ownerUser | Portal futuro |
| D-03 | ¿Link obligatorio a `DnxFinancialIdentity` cuando hay MONEY? | Obligatorio / opcional / solo si requiresPayment | Finanzas |
| D-04 | Fuente de verdad “socio SFPR” | ContestOrganization / Workspace / sistema externo / tabla nueva membresías | Audiencias FotoOffice |
| D-05 | ¿Migrar `OrganizerLandingSponsor` a `DnxPartner`? | No (v1) / vínculo opcional / migración | CLF |
| D-06 | Soft-delete: ¿ARCHIVED o isActive=false? | Status ARCHIVED (recomendado) / boolean | Consistencia |

---

## 3. Dominio funcional

| ID | Decisión | Opciones | Impacto |
|----|----------|----------|---------|
| F-01 | ¿Beneficio puede existir sin Participation? | Sí / no en v1 | Flexibilidad Tecnoflash multi-app |
| F-02 | Códigos: ¿siempre `DnxPromotion` o también código manual sin checkout? | Solo Promotion / híbrido (recomendado) | Vicario/Sony offline |
| F-03 | ¿Canjes y cupos requieren ledger de redenciones en v1? | Manual notes / tabla Redemption mínima | Complejidad |
| F-04 | Scope sede/categoría Clickatón: ¿contextType suficientes? | EDITION+VENUE+CATEGORY / tabla join | Modelo |
| F-05 | Valor estimado: ¿visible a partner / solo interno? | Interno (recomendado v1) / compartido | Confidencialidad |
| F-06 | ¿Participaciones monetarias generan factura/documento? | Fuera de módulo / fase legal posterior | Fiscal |

---

## 4. Permisos

| ID | Decisión | Opciones | Impacto |
|----|----------|----------|---------|
| A-01 | ¿Tabla nueva `DnxPartnerGrant` o extender grants genéricos? | Nueva (recomendado) / ApplicationMembership propuesto | Schema |
| A-02 | ¿Clickatón allowlist implica todas las capabilities partner? | Bundle ops / capabilities finas desde día 1 | Velocidad vs seguridad |
| A-03 | ¿Quién ve contactos sensibles? | Solo `partner.contact.sensitive` | Privacidad |
| A-04 | Separación UX finance partner vs commercial partner | Obligatoria (recomendado) | Evitar confusión |

---

## 5. Legales (obligatorio antes de publicar beneficios reales)

**No se redactan contratos en esta etapa.** Antes de publicar beneficios reales hay que definir:

| ID | Tema legal |
|----|------------|
| L-01 | Condiciones de uso de cada beneficio |
| L-02 | Vigencia y limitaciones |
| L-03 | Responsabilidad del partner |
| L-04 | Responsabilidad de DNX Suite |
| L-05 | Tratamiento de datos personales (contactos, audiencias, canjes) |
| L-06 | Uso de logos y marcas |
| L-07 | Autorización para publicar promociones |
| L-08 | Restricciones de códigos y vouchers (no transferencia, no publicación abierta, etc.) |
| L-09 | Condiciones para premios y sorteos |
| L-10 | Condiciones fiscales cuando exista aporte monetario |
| L-11 | Prohibición de compartir beneficios personales cuando corresponda |
| L-12 | Texto corto `termsSummary` vs documento legal externo |

**Acción legal en esta implementación técnica:** ninguna.

---

## 6. Integraciones de pago (explícitamente diferidas)

| ID | Decisión | Nota |
|----|----------|------|
| $01 | ¿Cuándo se permiten PaymentTerms con MP? | Fuera de Etapa 00; nunca default |
| $02 | ¿Cobros mensuales / suscripciones? | **Prohibido asumir**; solo si producto lo pide después |
| $03 | ¿Links de pago automáticos? | No en v1 |

---

## 7. Prioridad de apps

| ID | Decisión | Recomendación auditoría |
|----|----------|-------------------------|
| R-01 | Primer consumidor admin | Clickatón `/admin/sponsors` |
| R-02 | Primer consumidor beneficios elegibles | FotoOffice |
| R-03 | Primer bridge de premios | FotoRank |
| R-04 | CLF / InfoSpot | Fase posterior |

---

## 8. Criterio para desbloquear implementación

Mínimo humano para Etapa 01 (schema + admin Clickatón stub real):

1. Confirmar naming UI + dominio técnico (P-01).
2. Confirmar owner ops (P-02).
3. Confirmar que v1 **no** migra OrganizerLandingSponsor (D-05).
4. Confirmar PaymentTerms solo manual / opcional ($01–$03).
5. Confirmar que no se publican beneficios reales hasta checklist L-01…L-12.

El resto puede resolverse en paralelo durante fases posteriores.
