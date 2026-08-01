# Integración Clickatón ↔ DNX Partners (por edición)

Ver cierre: [`PARTNERS_STAGE_02_IMPLEMENTATION_01_RESULT.md`](./PARTNERS_STAGE_02_IMPLEMENTATION_01_RESULT.md).

## Relación con ediciones

```
ClickatonEdition
  └── DnxPartnerParticipation (application=CLICKATON, contextType=EDITION, contextId=edition.id)
        ├── DnxPartner (ficha; no duplicada)
        ├── DnxPartnerContribution[] ──soft──► ClickatonPrizeBundle.id
        └── DnxPartnerBenefit[]
              ├── DnxPartnerBenefitAudience[]
              └── DnxPartnerBenefitAccess[]   (manual)
```

## Premios

- Clickatón define el premio y la asignación al ganador.
- Partners registra el aporte y el soft-link `prizeBundleId`.

## Beneficios / audiencias

Audiencias v1 tipadas; evaluación diferida. Ver sección elegibilidad en el documento de resultado Stage 02.
