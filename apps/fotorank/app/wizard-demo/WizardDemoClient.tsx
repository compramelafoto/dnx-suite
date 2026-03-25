"use client";

import { useEffect, useState } from "react";
import {
  DesignSystemProvider,
  Modal,
  themeFotorank,
  WizardLayout,
  WizardSection,
  WizardField,
  Button,
  Text,
  spacing,
  radius,
  fontSize,
  useResolvedTheme,
} from "@repo/design-system";

const STEPS = [
  { id: "basics", label: "Datos" },
  { id: "dates", label: "Fechas" },
  { id: "rules", label: "Reglas" },
  { id: "review", label: "Revisión" },
];

function DemoFields() {
  const theme = useResolvedTheme();
  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: `${spacing[3]} ${spacing[4]}`,
    borderRadius: radius.input,
    border: `1px solid ${theme.border.default}`,
    background: theme.surface.overlay,
    color: theme.text.primary,
    fontSize: fontSize.sm,
    outline: "none",
  };

  return (
    <WizardSection
      title="Información básica"
      description="Esta información se muestra en el listado público de concursos."
    >
      <WizardField
        label="Nombre del concurso"
        htmlFor="demo-title"
        helperText="Nombre corto y claro. Recomendado 80 caracteres o menos."
        required
      >
        <input id="demo-title" defaultValue="Retrato de luz natural" style={inputStyle} />
      </WizardField>
      <WizardField
        label="Descripción breve"
        htmlFor="demo-desc"
        helperText="Opcional. Un párrafo que resuma el espíritu del concurso."
      >
        <textarea
          id="demo-desc"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", minHeight: "96px" }}
          defaultValue=""
        />
      </WizardField>
    </WizardSection>
  );
}

export default function WizardDemoClient() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DesignSystemProvider theme={themeFotorank.brand} mode="dark">
      <div style={{ minHeight: "100vh", background: "#050505", padding: spacing[8] }}>
        <Text variant="h1" as="h1">
          Demo Wizard Layout
        </Text>
        <Text variant="muted" as="p" style={{ marginTop: spacing[4], marginBottom: spacing[8], maxWidth: "36rem" }}>
          Ejemplo estructural de WizardLayout con WizardSection y WizardField. Sin backend. Abrí el modal para ver el flujo.
        </Text>
        <Button type="button" onClick={() => setOpen(true)}>
          Abrir wizard
        </Button>

        {mounted ? (
          <Modal open={open} onClose={() => setOpen(false)} maxWidth="48rem" maxHeight="90vh" zIndex={2000}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "min(88vh, 720px)",
                maxHeight: "90vh",
                minHeight: 0,
              }}
            >
              <WizardLayout
                brand={
                  <Text variant="h3" as="span" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    FotoRank
                  </Text>
                }
                organizationName="Estudio Fotográfico Demo"
                steps={STEPS}
                currentStep={step}
                title="Datos generales del concurso"
                description="Definí el nombre y la visibilidad. Podés ajustar estos datos más adelante desde el tablero."
                onClose={() => setOpen(false)}
                footerLeft={
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                }
                footerRight={
                  <>
                    <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                      Atrás
                    </Button>
                    <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
                      {step >= STEPS.length - 1 ? "Guardar" : "Siguiente"}
                    </Button>
                  </>
                }
              >
                <DemoFields />
              </WizardLayout>
            </div>
          </Modal>
        ) : null}
      </div>
    </DesignSystemProvider>
  );
}
