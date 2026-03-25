# Wizard premium — integración

## Uso rápido

```tsx
import {
  ContestCreateWizardPremium,
  ContestWizardStepOnePremium,
  WizardPremiumFooter,
} from "@/app/components/contest-wizard-premium";

<ContestCreateWizardPremium
  isOpen={open}
  onClose={() => setOpen(false)}
  currentStep={step}
  headline="Información básica"
  intro="Completá los datos principales del concurso…"
  footer={
    <WizardPremiumFooter
      showBack={false}
      onNext={() => setStep(2)}
      nextLabel="Siguiente"
    />
  }
>
  {step === 1 ? (
    <ContestWizardStepOnePremium
      title={title}
      slug={slug}
      /* … */
    />
  ) : (
    /* pasos 2–4 con las mismas cards si aplica */
    <div />
  )}
</ContestCreateWizardPremium>
```

## Archivos

| Componente | Rol |
|------------|-----|
| `WizardModalPremium` | Overlay, shell, header con logo dorado, scroll, footer slot |
| `ContestWizardStepperPremium` | 4 pasos + línea de progreso dorada |
| `ContestWizardProgressBlock` | Título + descripción del paso |
| `WizardSectionCardPremium` | Card interna con `»` dorado |
| `WizardPremiumFormField` | Label, asterisco dorado, hint |
| `WizardPremiumUploadZone` | Dropzone portada |
| `WizardPremiumFooter` | Atrás + Siguiente |
| `ContestCreateWizardPremium` | Composición lista para cablear estado |

## Notas

- Logo: por defecto `/fotorank-isologo.png` (ajustá `logoSrc` si hace falta).
- El hint de formato de imagen va solo en **Imagen de portada** (no bajo descripción completa).
- Pasos 2–4: reutilizá `WizardSectionCardPremium` para mantener la misma estética.
