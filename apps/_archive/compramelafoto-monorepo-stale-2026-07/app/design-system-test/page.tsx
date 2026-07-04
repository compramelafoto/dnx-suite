"use client";

/**
 * Showroom de prueba: mismas reglas y componentes que FotoRank `/design-system-test`.
 * El tema viene de `ComprameLaFotoDesignProvider` en `app/layout.tsx`.
 * Abrir en: /design-system-test
 */

import {
  themeComprameLaFoto,
  Button,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  DialogIntro,
  Icon,
  spacing,
  radius,
  compositionSpacing,
  fontSize,
  useResolvedTheme,
  useDesignSystem,
} from "@repo/design-system";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useDesignSystem();
  return (
    <section style={{ marginBottom: spacing[16] }}>
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: theme.text.primary,
          marginBottom: spacing[6],
          paddingBottom: spacing[4],
          borderBottom: `1px solid ${theme.border.subtle}`,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ClfShowroomInner() {
  const { theme, mode, setMode } = useDesignSystem();
  const resolved = useResolvedTheme();

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
    <div
      style={{
        minHeight: "100vh",
        background: theme.background.primary,
        color: theme.text.primary,
        padding: spacing[8],
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: spacing[12], maxWidth: 960 }}>
        <p
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: resolved.brand.primary,
            marginBottom: spacing[2],
          }}
        >
          ComprameLaFoto · preview
        </p>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: spacing[2] }}>
          Design system (misma guía que FotoRank)
        </h1>
        <p style={{ color: theme.text.secondary, marginBottom: spacing[6], lineHeight: 1.6, maxWidth: 720 }}>
          Componentes y tokens de <code style={{ fontSize: "0.85em" }}>@repo/design-system</code> con{" "}
          <code style={{ fontSize: "0.85em" }}>themeComprameLaFoto</code>: primario{" "}
          <strong>{themeComprameLaFoto.brand.primary}</strong>, acento UI{" "}
          <strong>{themeComprameLaFoto.brand.accent}</strong>. En la app actual,{" "}
          <code style={{ fontSize: "0.85em" }}>globals.css</code> usa a veces{" "}
          <strong>#c27b3d</strong> — conviene alinear hacia un solo origen de verdad.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: theme.text.tertiary }}>Modo</span>
          <Button variant={mode === "dark" ? "primary" : "outline"} size="sm" onClick={() => setMode?.("dark")}>
            Oscuro
          </Button>
          <Button variant={mode === "light" ? "primary" : "outline"} size="sm" onClick={() => setMode?.("light")}>
            Claro (típico CLF)
          </Button>
        </div>
      </header>

      <Section title="Título de sección (SectionTitle)">
        <SectionTitle
          title="Álbumes y ventas"
          description="Mismo ritmo vertical que en FotoRank: bloque título → descripción con compositionSpacing."
        />
        <Card style={{ maxWidth: 640 }}>
          <p style={{ color: theme.text.secondary, fontSize: fontSize.sm, lineHeight: 1.6 }}>
            Las cards usan superficie elevada y bordes del tema resuelto para el modo actual.
          </p>
        </Card>
      </Section>

      <Section title="Intro de diálogo (DialogIntro)">
        <Card style={{ maxWidth: 480, margin: "0 auto" }}>
          <DialogIntro
            title="Bienvenido al panel"
            subtitle="Misma composición modalBrand / stack que en el showroom de FotoRank."
          >
            <p style={{ marginTop: spacing[6], color: theme.text.secondary, fontSize: fontSize.sm }}>
              Sin logo de marca aquí (flujo funcional); solo ejemplo de jerarquía tipográfica.
            </p>
          </DialogIntro>
        </Card>
      </Section>

      <Section title="Botones y badges">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], marginBottom: spacing[6] }}>
          <Button variant="primary">Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Eliminar</Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4] }}>
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Listo</Badge>
          <Badge variant="warning">Atención</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </Section>

      <Section title="Formulario (ritmo form.*)">
        <div style={{ maxWidth: 400 }}>
          <label
            htmlFor="clf-demo-email"
            style={{ display: "block", fontSize: fontSize.sm, fontWeight: 600, marginBottom: spacing[3] }}
          >
            Email
          </label>
          <input id="clf-demo-email" type="email" placeholder="tu@email.com" style={inputStyle} />
          <p style={{ fontSize: fontSize.xs, color: theme.text.tertiary, marginTop: spacing[2] }}>
            Helper bajo el control (form.controlToHelper).
          </p>
        </div>
      </Section>

      <Section title="Estado vacío (EmptyState)">
        <Card>
          <EmptyState
            icon={<Icon name="gallery" size="lg" />}
            title="Todavía no hay fotos"
            description="Subí el primer lote para ver el álbum con el mismo patrón DS."
            action={
              <Button
                variant="primary"
                size="sm"
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: spacing[2],
                  minWidth: "5.75rem",
                  textAlign: "center",
                }}
              >
                <Icon name="image" size="sm" aria-hidden />
                <span>Subir</span>
              </Button>
            }
          />
        </Card>
      </Section>

      <Section title="Composición (compositionSpacing)">
        <p style={{ color: theme.text.secondary, maxWidth: 720, marginBottom: spacing[6], lineHeight: 1.6 }}>
          Referencia alineada con{" "}
          <code style={{ fontSize: "0.85em" }}>packages/design-system/.../compositionSpacing.ts</code> (reglas
          equivalentes a las variables <code style={{ fontSize: "0.85em" }}>--fr-comp-*</code> en FotoRank).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: spacing[8] }}>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>stack</h3>
            {(Object.entries(compositionSpacing.stack) as [string, string][]).slice(0, 5).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[4],
                  marginBottom: spacing[2],
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ width: 140, color: theme.text.tertiary, flexShrink: 0 }}>{key}</span>
                <div
                  style={{
                    height: 8,
                    width: value,
                    minWidth: 4,
                    borderRadius: 2,
                    background: theme.brand.primary,
                  }}
                  title={value}
                />
                <span style={{ color: theme.text.secondary }}>{value}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 style={{ fontSize: "0.875rem", color: theme.text.secondary, marginBottom: spacing[4] }}>
              horizontal.cardGap
            </h3>
            <div
              style={{
                display: "flex",
                gap: compositionSpacing.horizontal.cardGap,
                flexWrap: "wrap",
              }}
            >
              <Card style={{ width: 120, height: 72 }} />
              <Card style={{ width: 120, height: 72 }} />
              <Card style={{ width: 120, height: 72 }} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Paleta marca (modo actual)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[6], alignItems: "center" }}>
          <div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.button,
                background: theme.brand.primary,
                border: `1px solid ${theme.border.subtle}`,
              }}
            />
            <p style={{ fontSize: "0.75rem", color: theme.text.secondary, marginTop: spacing[2] }}>brand.primary</p>
          </div>
          <div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.button,
                background: theme.brand.accent ?? theme.brand.primary,
                border: `1px solid ${theme.border.subtle}`,
              }}
            />
            <p style={{ fontSize: "0.75rem", color: theme.text.secondary, marginTop: spacing[2] }}>brand.accent</p>
          </div>
          <div>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.button,
                background: themeComprameLaFoto.brand.soft,
                border: `1px solid ${theme.border.subtle}`,
              }}
            />
            <p style={{ fontSize: "0.75rem", color: theme.text.secondary, marginTop: spacing[2] }}>brand.soft</p>
          </div>
        </div>
      </Section>

      <footer style={{ marginTop: spacing[16], paddingTop: spacing[8], borderTop: `1px solid ${theme.border.subtle}` }}>
        <p style={{ fontSize: "0.75rem", color: theme.text.tertiary }}>
          Ruta de prueba local · no afecta el resto de la app.
        </p>
      </footer>
    </div>
  );
}

export default ClfShowroomInner;
